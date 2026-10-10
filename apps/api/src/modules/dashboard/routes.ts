import { Router } from 'express';
import { addMonths, buildMonthlySeries, dateRangeQuery, monthOf, monthsBetween, type DashboardDto } from '@trackforge/shared';
import { Transaction } from '../../models/transaction.js';
import { parse } from '../../middleware/validate.js';
import { authOf } from '../../middleware/auth.js';
import { budgetsForMonth, expenseByCategory, monthlyTypeRows, totalsForRange } from '../../services/aggregates.js';
import { toTransactionDtos } from '../../services/transactionDto.js';

const TREND_MONTHS = 12;
const RECENT_LIMIT = 6;

export function createDashboardRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const range = parse(dateRangeQuery, req.query);
    const endMonth = monthOf(range.to);
    const startMonth = addMonths(endMonth, -(TREND_MONTHS - 1));
    const months = monthsBetween(startMonth, endMonth);

    const [totals, trendRows, slices, recentRows, budgets] = await Promise.all([
      totalsForRange(ownerId, range),
      monthlyTypeRows(ownerId, startMonth, endMonth),
      expenseByCategory(ownerId, range),
      Transaction.find({ ownerId, date: { $gte: range.from, $lte: range.to } })
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .limit(RECENT_LIMIT)
        .lean(),
      budgetsForMonth(ownerId, endMonth, currency),
    ]);

    const body: DashboardDto = {
      range,
      currency,
      totals,
      trend: buildMonthlySeries(months, trendRows),
      expenseByCategory: slices,
      recent: await toTransactionDtos(ownerId, recentRows),
      budgetAlerts: budgets.budgets.filter((b) => b.status !== 'on_track'),
      budgetMonth: endMonth,
    };
    res.json(body);
  });

  return router;
}
