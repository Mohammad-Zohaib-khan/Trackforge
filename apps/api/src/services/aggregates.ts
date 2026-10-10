import type { Types } from 'mongoose';
import {
  budgetProgress,
  summarizeTotals,
  type BudgetDto,
  type BudgetMonthDto,
  type CategoryIcon,
  type CategorySlice,
  type CurrencyCode,
  type MonthTypeRow,
  type Totals,
  type TransactionType,
} from '@trackforge/shared';
import { Transaction } from '../models/transaction.js';
import { Category } from '../models/category.js';
import { Budget } from '../models/budget.js';

/**
 * Every aggregate starts with a $match on ownerId taken from the session, so
 * no pipeline can ever read another user's records. Pipelines use only
 * field-path grouping on stored fields (`type`, `month`, `categoryId`) to stay
 * portable and index-friendly.
 */

/**
 * Each $group uses a single accumulator; sums and counts run as two small indexed
 * pipelines. This keeps results identical on MongoDB and on MongoDB-compatible
 * servers (FerretDB, DocumentDB) that mishandle several accumulators in one stage.
 */
async function groupSumAndCount<K>(match: Record<string, unknown>, key: unknown): Promise<Array<{ key: K; total: number; count: number }>> {
  const [sums, counts] = await Promise.all([
    Transaction.aggregate<{ _id: K; total: unknown }>([{ $match: match }, { $group: { _id: key, total: { $sum: '$amountMinor' } } }]),
    Transaction.aggregate<{ _id: K; count: unknown }>([{ $match: match }, { $group: { _id: key, count: { $sum: 1 } } }]),
  ]);
  const countBy = new Map(counts.map((c) => [JSON.stringify(c._id), toNumber(c.count)]));
  return sums.map((s) => ({ key: s._id, total: toNumber(s.total), count: countBy.get(JSON.stringify(s._id)) ?? 0 }));
}

const toNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

interface DateWindow {
  from: string;
  to: string;
}

export async function totalsForRange(ownerId: Types.ObjectId, range: DateWindow): Promise<Totals> {
  const rows = await groupSumAndCount<TransactionType>({ ownerId, date: { $gte: range.from, $lte: range.to } }, '$type');
  return summarizeTotals(rows.map((r) => ({ type: r.key, totalMinor: r.total, count: r.count })));
}

export async function totalsForMonths(ownerId: Types.ObjectId, months: readonly string[]): Promise<Totals> {
  const rows = await groupSumAndCount<TransactionType>({ ownerId, month: { $in: [...months] } }, '$type');
  return summarizeTotals(rows.map((r) => ({ type: r.key, totalMinor: r.total, count: r.count })));
}

export async function monthlyTypeRows(ownerId: Types.ObjectId, fromMonth: string, toMonth: string): Promise<MonthTypeRow[]> {
  const rows = await Transaction.aggregate<{ _id: { month: string; type: TransactionType }; total: unknown }>([
    { $match: { ownerId, month: { $gte: fromMonth, $lte: toMonth } } },
    { $group: { _id: { month: '$month', type: '$type' }, total: { $sum: '$amountMinor' } } },
  ]);
  return rows.map((r) => ({ month: r._id.month, type: r._id.type, totalMinor: toNumber(r.total) }));
}

interface CategoryRow {
  categoryId: Types.ObjectId;
  type: TransactionType;
  month: string;
  totalMinor: number;
}

export async function categoryRowsForMonths(ownerId: Types.ObjectId, months: readonly string[]): Promise<CategoryRow[]> {
  const rows = await Transaction.aggregate<{
    _id: { categoryId: Types.ObjectId; type: TransactionType; month: string };
    total: unknown;
  }>([
    { $match: { ownerId, month: { $in: [...months] } } },
    { $group: { _id: { categoryId: '$categoryId', type: '$type', month: '$month' }, total: { $sum: '$amountMinor' } } },
  ]);
  return rows.map((r) => ({
    categoryId: r._id.categoryId,
    type: r._id.type,
    month: r._id.month,
    totalMinor: toNumber(r.total),
  }));
}

export interface CategoryMeta {
  name: string;
  icon: CategoryIcon;
  color: string | null;
  archived: boolean;
}

export async function categoryMeta(ownerId: Types.ObjectId): Promise<Map<string, CategoryMeta>> {
  const categories = await Category.find({ ownerId }).select({ name: 1, icon: 1, color: 1, archived: 1 }).lean();
  return new Map(
    categories.map((c) => [
      c._id.toString(),
      { name: c.name, icon: c.icon, color: c.color ?? null, archived: c.archived },
    ]),
  );
}

export async function expenseByCategory(ownerId: Types.ObjectId, range: DateWindow): Promise<CategorySlice[]> {
  const rows = await groupSumAndCount<Types.ObjectId>(
    { ownerId, type: 'expense', date: { $gte: range.from, $lte: range.to } },
    '$categoryId',
  );
  const meta = await categoryMeta(ownerId);
  const grand = rows.reduce((sum, r) => sum + r.total, 0);
  return rows
    .map((r) => {
      const m = meta.get(r.key.toString());
      const totalMinor = r.total;
      return {
        categoryId: r.key.toString(),
        name: m?.name ?? 'Deleted category',
        icon: m?.icon ?? 'tag',
        color: m?.color ?? null,
        totalMinor,
        count: r.count,
        shareBps: grand > 0 ? Math.round((totalMinor * 10_000) / grand) : 0,
      } satisfies CategorySlice;
    })
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

export async function budgetsForMonth(ownerId: Types.ObjectId, month: string, currency: CurrencyCode): Promise<BudgetMonthDto> {
  const budgets = await Budget.find({ ownerId, month }).lean();
  const categoryIds = budgets.map((b) => b.categoryId);
  const [spentRows, meta] = await Promise.all([
    categoryIds.length
      ? Transaction.aggregate<{ _id: Types.ObjectId; total: unknown }>([
          { $match: { ownerId, type: 'expense', month, categoryId: { $in: categoryIds } } },
          { $group: { _id: '$categoryId', total: { $sum: '$amountMinor' } } },
        ])
      : Promise.resolve([]),
    categoryMeta(ownerId),
  ]);
  const spentBy = new Map(spentRows.map((r) => [r._id.toString(), toNumber(r.total)]));

  const items: BudgetDto[] = budgets.map((b) => {
    const categoryId = b.categoryId.toString();
    const m = meta.get(categoryId);
    const progress = budgetProgress(spentBy.get(categoryId) ?? 0, b.amountMinor, b.warningThresholdPct);
    return {
      id: b._id.toString(),
      month: b.month,
      category: {
        id: categoryId,
        name: m?.name ?? 'Deleted category',
        icon: m?.icon ?? 'tag',
        color: m?.color ?? null,
        archived: m?.archived ?? true,
      },
      limitMinor: b.amountMinor,
      warningThresholdPct: b.warningThresholdPct,
      spentMinor: progress.spentMinor,
      remainingMinor: progress.remainingMinor,
      usedBps: progress.usedBps,
      status: progress.status,
    };
  });
  items.sort((a, b) => b.usedBps - a.usedBps || a.category.name.localeCompare(b.category.name));

  const limitMinor = items.reduce((s, b) => s + b.limitMinor, 0);
  const spentMinor = items.reduce((s, b) => s + b.spentMinor, 0);
  return { month, currency, budgets: items, totals: { limitMinor, spentMinor, remainingMinor: limitMinor - spentMinor } };
}
