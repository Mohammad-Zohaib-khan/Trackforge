/**
 * Pure financial calculations. All inputs and outputs are integer minor units
 * or basis points so results are exact and independently testable.
 */

export interface TypeTotalRow {
  type: 'income' | 'expense';
  totalMinor: number;
  count: number;
}

export interface Totals {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  transactionCount: number;
  /** Share of income kept, in basis points (10000 = 100%). Null when there is no income. */
  savingsRateBps: number | null;
}

export function savingsRateBps(incomeMinor: number, expenseMinor: number): number | null {
  if (incomeMinor <= 0) return null;
  return Math.round(((incomeMinor - expenseMinor) * 10_000) / incomeMinor);
}

export function summarizeTotals(rows: readonly TypeTotalRow[]): Totals {
  let incomeMinor = 0;
  let expenseMinor = 0;
  let transactionCount = 0;
  for (const row of rows) {
    if (row.type === 'income') incomeMinor += row.totalMinor;
    else expenseMinor += row.totalMinor;
    transactionCount += row.count;
  }
  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    transactionCount,
    savingsRateBps: savingsRateBps(incomeMinor, expenseMinor),
  };
}

export type BudgetStatus = 'on_track' | 'warning' | 'over';

export interface BudgetProgress {
  spentMinor: number;
  limitMinor: number;
  remainingMinor: number;
  /** Spent as basis points of the limit (may exceed 10000). */
  usedBps: number;
  status: BudgetStatus;
}

/**
 * `warningThresholdPct` is a whole percentage (e.g. 80). Reaching it is a warning;
 * spending strictly more than the limit is "over". Spending exactly the limit is a warning.
 */
export function budgetProgress(
  spentMinor: number,
  limitMinor: number,
  warningThresholdPct: number,
): BudgetProgress {
  const usedBps = limitMinor > 0 ? Math.round((spentMinor * 10_000) / limitMinor) : 0;
  let status: BudgetStatus = 'on_track';
  if (spentMinor > limitMinor) status = 'over';
  else if (spentMinor * 100 >= limitMinor * warningThresholdPct) status = 'warning';
  return {
    spentMinor,
    limitMinor,
    remainingMinor: limitMinor - spentMinor,
    usedBps,
    status,
  };
}

/** Change from previous to current in basis points; null when previous is zero. */
export function changeBps(previous: number, current: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) * 10_000) / Math.abs(previous));
}

export interface MonthTypeRow {
  month: string;
  type: 'income' | 'expense';
  totalMinor: number;
}

export interface MonthlyPoint {
  month: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

/** Builds a dense month-by-month series, filling months with no records with zeros. */
export function buildMonthlySeries(months: readonly string[], rows: readonly MonthTypeRow[]): MonthlyPoint[] {
  const series: MonthlyPoint[] = months.map((month) => ({
    month,
    incomeMinor: 0,
    expenseMinor: 0,
    netMinor: 0,
  }));
  const byMonth = new Map(series.map((point) => [point.month, point]));
  for (const row of rows) {
    const point = byMonth.get(row.month);
    if (!point) continue;
    if (row.type === 'income') point.incomeMinor += row.totalMinor;
    else point.expenseMinor += row.totalMinor;
  }
  for (const point of series) {
    point.netMinor = point.incomeMinor - point.expenseMinor;
  }
  return series;
}
