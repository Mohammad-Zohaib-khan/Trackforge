import { Router } from 'express';
import type { Types } from 'mongoose';
import {
  createTransactionSchema,
  listTransactionsQuery,
  updateTransactionSchema,
  type Paginated,
  type TransactionDto,
  type TransactionType,
} from '@trackforge/shared';
import { Transaction } from '../../models/transaction.js';
import { Category } from '../../models/category.js';
import { idParam, parse } from '../../middleware/validate.js';
import { authOf } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { toTransactionDtos } from '../../services/transactionDto.js';
import { buildTransactionFilter } from './filters.js';
import { amountOrThrow } from '../../services/amounts.js';

/** Category must belong to the caller, match the transaction type, and be active for new use. */
async function assertUsableCategory(
  ownerId: Types.ObjectId,
  categoryId: string,
  type: TransactionType,
  allowArchivedId?: string,
): Promise<void> {
  const category = await Category.findOne({ _id: categoryId, ownerId }).select({ type: 1, archived: 1 }).lean();
  if (!category) throw badRequest('VALIDATION_ERROR', 'Some fields need attention', { categoryId: 'Choose one of your categories' });
  if (category.type !== type) {
    throw badRequest('VALIDATION_ERROR', 'Some fields need attention', {
      categoryId: `Choose an ${type} category for an ${type}`,
    });
  }
  if (category.archived && category._id.toString() !== allowArchivedId) {
    throw badRequest('VALIDATION_ERROR', 'Some fields need attention', {
      categoryId: 'This category is archived. Restore it or choose another.',
    });
  }
}

const SORT_FIELD = { date: 'date', amount: 'amountMinor', merchant: 'merchantKey', createdAt: 'createdAt' } as const;

export function createTransactionsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const query = parse(listTransactionsQuery, req.query);
    const filter = buildTransactionFilter(ownerId, query, currency);
    const direction = query.order === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [SORT_FIELD[query.sort]]: direction };
    if (query.sort !== 'createdAt') sort['createdAt'] = direction;
    sort['_id'] = direction;

    const [total, rows] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean(),
    ]);
    const body: Paginated<TransactionDto> = {
      items: await toTransactionDtos(ownerId, rows),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
    res.json(body);
  });

  router.get('/:id', async (req, res) => {
    const { ownerId } = authOf(req);
    const id = idParam(req);
    const row = await Transaction.findOne({ _id: id, ownerId }).lean();
    if (!row) throw notFound('Transaction');
    const [dto] = await toTransactionDtos(ownerId, [row]);
    res.json({ transaction: dto });
  });

  router.post('/', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const input = parse(createTransactionSchema, req.body);
    const amountMinor = amountOrThrow(input.amount, currency);
    await assertUsableCategory(ownerId, input.categoryId, input.type);
    const created = await Transaction.create({
      ownerId,
      type: input.type,
      amountMinor,
      currency,
      categoryId: input.categoryId,
      date: input.date,
      paymentMethod: input.paymentMethod,
      merchant: input.merchant ?? '',
      note: input.note ?? '',
      recurring: input.recurring,
    });
    const [dto] = await toTransactionDtos(ownerId, [created.toObject()]);
    res.status(201).json({ transaction: dto });
  });

  router.patch('/:id', async (req, res) => {
    const { ownerId } = authOf(req);
    const id = idParam(req);
    const input = parse(updateTransactionSchema, req.body);
    const tx = await Transaction.findOne({ _id: id, ownerId });
    if (!tx) throw notFound('Transaction');

    const nextType = input.type ?? tx.type;
    const nextCategoryId = input.categoryId ?? tx.categoryId.toString();
    if (input.type !== undefined || input.categoryId !== undefined) {
      await assertUsableCategory(ownerId, nextCategoryId, nextType, tx.categoryId.toString());
    }

    // Explicit allowlist: only these fields can ever change.
    if (input.amount !== undefined) tx.amountMinor = amountOrThrow(input.amount, tx.currency);
    if (input.type !== undefined) tx.type = input.type;
    if (input.categoryId !== undefined) tx.set('categoryId', input.categoryId);
    if (input.date !== undefined) tx.date = input.date;
    if (input.paymentMethod !== undefined) tx.paymentMethod = input.paymentMethod;
    if (input.merchant !== undefined) tx.merchant = input.merchant;
    if (input.note !== undefined) tx.note = input.note;
    if (input.recurring !== undefined) tx.recurring = input.recurring;
    await tx.save();

    const [dto] = await toTransactionDtos(ownerId, [tx.toObject()]);
    res.json({ transaction: dto });
  });

  router.delete('/:id', async (req, res) => {
    const { ownerId } = authOf(req);
    const id = idParam(req);
    const result = await Transaction.deleteOne({ _id: id, ownerId });
    if (result.deletedCount === 0) throw notFound('Transaction');
    res.status(204).end();
  });

  return router;
}
