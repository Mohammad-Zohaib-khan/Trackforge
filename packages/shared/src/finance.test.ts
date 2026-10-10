import { describe, expect, it } from 'vitest';
import { budgetProgress, buildMonthlySeries, changeBps, savingsRateBps, summarizeTotals } from './finance.js';
import { addMonths, inclusiveDayCount, isIsoDate, monthBounds, monthsBetween, todayInTimeZone } from './dates.js';

describe('summarizeTotals', () => {
  it('computes income, expense, net, count and savings rate', () => {
    const totals = summarizeTotals([
      { type: 'income', totalMinor: 500000, count: 2 },
      { type: 'expense', totalMinor: 125050, count: 7 },
    ]);
    expect(totals).toEqual({
      incomeMinor: 500000,
      expenseMinor: 125050,
      netMinor: 374950,
      transactionCount: 9,
      savingsRateBps: 7499,
    });
  });

  it('returns zeros and a null savings rate for an empty ledger', () => {
    expect(summarizeTotals([])).toEqual({
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
      transactionCount: 0,
      savingsRateBps: null,
    });
  });

  it('allows a negative savings rate when spending exceeds income', () => {
    expect(savingsRateBps(1000, 1500)).toBe(-5000);
    expect(savingsRateBps(0, 1500)).toBeNull();
  });
});

describe('budgetProgress', () => {
  it('is on track below the warning threshold', () => {
    expect(budgetProgress(7999, 10000, 80)).toMatchObject({ status: 'on_track', usedBps: 7999, remainingMinor: 2001 });
  });
  it('warns at and above the threshold, including exactly at the limit', () => {
    expect(budgetProgress(8000, 10000, 80).status).toBe('warning');
    expect(budgetProgress(10000, 10000, 80).status).toBe('warning');
  });
  it('is over when strictly above the limit', () => {
    expect(budgetProgress(10001, 10000, 80)).toMatchObject({ status: 'over', remainingMinor: -1 });
  });
});

describe('changeBps', () => {
  it('handles growth, decline and a zero baseline', () => {
    expect(changeBps(1000, 1500)).toBe(5000);
    expect(changeBps(1000, 500)).toBe(-5000);
    expect(changeBps(0, 500)).toBeNull();
  });
});

describe('buildMonthlySeries', () => {
  it('fills gaps with zeros and ignores rows outside the window', () => {
    const series = buildMonthlySeries(
      ['2025-11', '2025-12', '2026-01'],
      [
        { month: '2025-11', type: 'income', totalMinor: 1000 },
        { month: '2026-01', type: 'expense', totalMinor: 400 },
        { month: '2024-01', type: 'expense', totalMinor: 999 },
      ],
    );
    expect(series).toEqual([
      { month: '2025-11', incomeMinor: 1000, expenseMinor: 0, netMinor: 1000 },
      { month: '2025-12', incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
      { month: '2026-01', incomeMinor: 0, expenseMinor: 400, netMinor: -400 },
    ]);
  });
});

describe('date helpers', () => {
  it('validates calendar dates including leap years', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2025-02-29')).toBe(false);
    expect(isIsoDate('2025-13-01')).toBe(false);
    expect(isIsoDate('2025-1-01')).toBe(false);
  });
  it('computes month bounds and arithmetic across year ends', () => {
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-03', -14)).toBe('2025-01');
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('counts days inclusively', () => {
    expect(inclusiveDayCount('2026-01-01', '2026-01-01')).toBe(1);
    expect(inclusiveDayCount('2026-01-01', '2026-12-31')).toBe(365);
  });
  it('derives "today" in the user time zone', () => {
    const instant = new Date('2026-03-31T20:00:00Z');
    expect(todayInTimeZone('Asia/Kolkata', instant)).toBe('2026-04-01');
    expect(todayInTimeZone('America/New_York', instant)).toBe('2026-03-31');
    expect(todayInTimeZone('Not/AZone', instant)).toBe('2026-03-31');
  });
});
