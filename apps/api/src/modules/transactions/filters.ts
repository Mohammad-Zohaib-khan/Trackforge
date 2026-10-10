import type { Types } from 'mongoose';
import type { CurrencyCode, ListTransactionsQuery } from '@trackforge/shared';
import { escapeRegex } from '../../utils/regex.js';
import { amountOrThrow } from '../../services/amounts.js';
import { badRequest } from '../../utils/httpError.js';

/** Builds an owner-scoped Mongo filter from validated query values. ownerId always comes from the session. */
export function buildTransactionFilter(
  ownerId: Types.ObjectId,
  q: Pick<ListTransactionsQuery, 'q' | 'type' | 'categoryId' | 'paymentMethod' | 'recurring' | 'from' | 'to' | 'minAmount' | 'maxAmount'>,
  currency: CurrencyCode,
): Record<string, unknown> {
  const filter: Record<string, unknown> = { ownerId };
  if (q.type) filter['type'] = q.type;
  if (q.categoryId) filter['categoryId'] = q.categoryId;
  if (q.paymentMethod) filter['paymentMethod'] = q.paymentMethod;
  if (q.recurring) filter['recurring'] = q.recurring === 'true';
  if (q.from || q.to) {
    const range: Record<string, string> = {};
    if (q.from) range['$gte'] = q.from;
    if (q.to) range['$lte'] = q.to;
    filter['date'] = range;
  }
  if (q.minAmount || q.maxAmount) {
    const range: Record<string, number> = {};
    if (q.minAmount) range['$gte'] = amountOrThrow(q.minAmount, currency, 'minAmount');
    if (q.maxAmount) range['$lte'] = amountOrThrow(q.maxAmount, currency, 'maxAmount');
    if (range['$gte'] !== undefined && range['$lte'] !== undefined && range['$gte'] > range['$lte']) {
      throw badRequest('VALIDATION_ERROR', 'Some fields need attention', { minAmount: 'Minimum must not exceed maximum' });
    }
    filter['amountMinor'] = range;
  }
  if (q.q) {
    const pattern = escapeRegex(q.q);
    filter['$or'] = [
      { merchant: { $regex: pattern, $options: 'i' } },
      { note: { $regex: pattern, $options: 'i' } },
    ];
  }
  return filter;
}
