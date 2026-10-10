import { Router } from 'express';
import {
  addMonths,
  buildMonthlySeries,
  changeBps,
  comparisonQuery,
  monthsBetween,
  trendQuery,
  type ComparisonDto,
  type ComparisonRow,
  type TrendDto,
} from '@trackforge/shared';
import { parse } from '../../middleware/validate.js';
import { authOf } from '../../middleware/auth.js';
import { categoryMeta, categoryRowsForMonths, monthlyTypeRows, totalsForMonths } from '../../services/aggregates.js';

export function createReportsRouter(): Router {
  const router = Router();

  /** Month-over-month comparison: totals and per-category change versus the previous month. */
  router.get('/comparison', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const { month } = parse(comparisonQuery, req.query);
    const previousMonth = addMonths(month, -1);

    const [current, previous, rows, meta] = await Promise.all([
      totalsForMonths(ownerId, [month]),
      totalsForMonths(ownerId, [previousMonth]),
      categoryRowsForMonths(ownerId, [month, previousMonth]),
      categoryMeta(ownerId),
    ]);

    const byKey = new Map<string, ComparisonRow>();
    for (const row of rows) {
      const id = row.categoryId.toString();
      const key = `${row.type}:${id}`;
      const m = meta.get(id);
      const entry =
        byKey.get(key) ??
        ({
          categoryId: id,
          name: m?.name ?? 'Deleted category',
          icon: m?.icon ?? 'tag',
          type: row.type,
          currentMinor: 0,
          previousMinor: 0,
          changeBps: null,
        } satisfies ComparisonRow);
      if (row.month === month) entry.currentMinor += row.totalMinor;
      else entry.previousMinor += row.totalMinor;
      byKey.set(key, entry);
    }
    const categories = [...byKey.values()]
      .map((r) => ({ ...r, changeBps: changeBps(r.previousMinor, r.currentMinor) }))
      .sort((a, b) => (a.type === b.type ? b.currentMinor - a.currentMinor : a.type === 'expense' ? -1 : 1));

    const body: ComparisonDto = {
      month,
      previousMonth,
      currency,
      current,
      previous,
      change: {
        incomeBps: changeBps(previous.incomeMinor, current.incomeMinor),
        expenseBps: changeBps(previous.expenseMinor, current.expenseMinor),
        netMinor: current.netMinor - previous.netMinor,
      },
      categories,
    };
    res.json(body);
  });

  /** Monthly series over an explicit window (max 24 months) with totals and averages. */
  router.get('/trend', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const { from, to } = parse(trendQuery, req.query);
    const months = monthsBetween(from, to);
    const [rows, totals] = await Promise.all([monthlyTypeRows(ownerId, from, to), totalsForMonths(ownerId, months)]);
    const body: TrendDto = {
      from,
      to,
      currency,
      series: buildMonthlySeries(months, rows),
      totals,
      averageMonthlyExpenseMinor: Math.round(totals.expenseMinor / months.length),
    };
    res.json(body);
  });

  return router;
}
