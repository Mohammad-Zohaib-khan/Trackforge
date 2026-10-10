import { Router } from 'express';
import { copyBudgetsSchema, createBudgetSchema, listBudgetsQuery, updateBudgetSchema } from '@trackforge/shared';
import { Budget } from '../../models/budget.js';
import { Category } from '../../models/category.js';
import { idParam, parse } from '../../middleware/validate.js';
import { authOf } from '../../middleware/auth.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { budgetsForMonth } from '../../services/aggregates.js';
import { amountOrThrow } from '../../services/amounts.js';

export function createBudgetsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const { month } = parse(listBudgetsQuery, req.query);
    res.json(await budgetsForMonth(ownerId, month, currency));
  });

  router.post('/', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const input = parse(createBudgetSchema, req.body);
    const amountMinor = amountOrThrow(input.amount, currency);
    const category = await Category.findOne({ _id: input.categoryId, ownerId }).select({ type: 1, archived: 1 }).lean();
    if (!category || category.type !== 'expense' || category.archived) {
      throw badRequest('VALIDATION_ERROR', 'Some fields need attention', { categoryId: 'Choose one of your active expense categories' });
    }
    if (await Budget.exists({ ownerId, categoryId: input.categoryId, month: input.month })) {
      throw conflict('BUDGET_EXISTS', 'This category already has a budget for that month. Edit it instead.');
    }
    const budget = await Budget.create({
      ownerId,
      categoryId: input.categoryId,
      month: input.month,
      amountMinor,
      warningThresholdPct: input.warningThresholdPct,
    });
    const view = await budgetsForMonth(ownerId, budget.month, currency);
    res.status(201).json({ budget: view.budgets.find((b) => b.id === budget._id.toString()) });
  });

  router.patch('/:id', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const id = idParam(req);
    const input = parse(updateBudgetSchema, req.body);
    const budget = await Budget.findOne({ _id: id, ownerId });
    if (!budget) throw notFound('Budget');
    if (input.amount !== undefined) budget.amountMinor = amountOrThrow(input.amount, currency);
    if (input.warningThresholdPct !== undefined) budget.warningThresholdPct = input.warningThresholdPct;
    await budget.save();
    const view = await budgetsForMonth(ownerId, budget.month, currency);
    res.json({ budget: view.budgets.find((b) => b.id === budget._id.toString()) });
  });

  router.delete('/:id', async (req, res) => {
    const { ownerId } = authOf(req);
    const id = idParam(req);
    const result = await Budget.deleteOne({ _id: id, ownerId });
    if (result.deletedCount === 0) throw notFound('Budget');
    res.status(204).end();
  });

  /** Copies limits from one month into another, skipping categories that already have a budget there. */
  router.post('/copy', async (req, res) => {
    const { ownerId } = authOf(req);
    const input = parse(copyBudgetsSchema, req.body);
    const [source, existing, activeCategories] = await Promise.all([
      Budget.find({ ownerId, month: input.fromMonth }).lean(),
      Budget.find({ ownerId, month: input.toMonth }).select({ categoryId: 1 }).lean(),
      Category.find({ ownerId, type: 'expense', archived: false }).select({ _id: 1 }).lean(),
    ]);
    const taken = new Set(existing.map((b) => b.categoryId.toString()));
    const active = new Set(activeCategories.map((c) => c._id.toString()));
    const toCreate = source.filter((b) => !taken.has(b.categoryId.toString()) && active.has(b.categoryId.toString()));
    if (toCreate.length) {
      await Budget.insertMany(
        toCreate.map((b) => ({
          ownerId,
          categoryId: b.categoryId,
          month: input.toMonth,
          amountMinor: b.amountMinor,
          warningThresholdPct: b.warningThresholdPct,
        })),
      );
    }
    res.json({ copied: toCreate.length, skipped: source.length - toCreate.length });
  });

  return router;
}
