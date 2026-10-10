import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addTransaction, categoryId, mutate, registerUser, startHarness, type Harness, type TestUser } from './harness.js';

let h: Harness;
let user: TestUser;

beforeAll(async () => {
  h = await startHarness();
  user = await registerUser(h.app);
  // January
  await addTransaction(user, { type: 'income', amount: '4000', category: 'Salary', date: '2026-01-01' });
  await addTransaction(user, { amount: '0.10', category: 'Groceries', date: '2026-01-01' });
  await addTransaction(user, { amount: '0.20', category: 'Groceries', date: '2026-01-31' });
  await addTransaction(user, { amount: '1500', category: 'Housing', date: '2026-01-05' });
  // February
  await addTransaction(user, { type: 'income', amount: '4000', category: 'Salary', date: '2026-02-01' });
  await addTransaction(user, { type: 'income', amount: '500.55', category: 'Freelance', date: '2026-02-14' });
  await addTransaction(user, { amount: '1500', category: 'Housing', date: '2026-02-05' });
  await addTransaction(user, { amount: '310.40', category: 'Groceries', date: '2026-02-10' });
  await addTransaction(user, { amount: '89.60', category: 'Dining', date: '2026-02-28' });
});
afterAll(async () => {
  await h.stop();
});

describe('dashboard', () => {
  it('computes exact totals, net and savings rate from stored records', async () => {
    const res = await user.agent.get('/api/v1/dashboard?from=2026-02-01&to=2026-02-28');
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      incomeMinor: 450055,
      expenseMinor: 190000,
      netMinor: 260055,
      transactionCount: 5,
      savingsRateBps: 5778,
    });
    expect(res.body.expenseByCategory.map((s: { name: string; totalMinor: number }) => [s.name, s.totalMinor])).toEqual([
      ['Housing', 150000],
      ['Groceries', 31040],
      ['Dining', 8960],
    ]);
    const shares = res.body.expenseByCategory.reduce((s: number, c: { shareBps: number }) => s + c.shareBps, 0);
    expect(Math.abs(shares - 10_000)).toBeLessThanOrEqual(2);
    expect(res.body.recent[0].date).toBe('2026-02-28');
  });

  it('respects inclusive date boundaries and avoids float drift', async () => {
    const res = await user.agent.get('/api/v1/dashboard?from=2026-01-01&to=2026-01-31');
    expect(res.body.totals.expenseMinor).toBe(150030);
    const edge = await user.agent.get('/api/v1/dashboard?from=2026-01-31&to=2026-02-01');
    expect(edge.body.totals).toMatchObject({ incomeMinor: 400000, expenseMinor: 20 });
  });

  it('builds a 12-month trend with zero-filled months', async () => {
    const res = await user.agent.get('/api/v1/dashboard?from=2026-02-01&to=2026-02-28');
    expect(res.body.trend).toHaveLength(12);
    expect(res.body.trend[0].month).toBe('2025-03');
    expect(res.body.trend.at(-1)).toEqual({ month: '2026-02', incomeMinor: 450055, expenseMinor: 190000, netMinor: 260055 });
    expect(res.body.trend.at(-2)).toEqual({ month: '2026-01', incomeMinor: 400000, expenseMinor: 150030, netMinor: 249970 });
    expect(res.body.trend[5]).toEqual({ month: '2025-08', incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  });

  it('returns a null savings rate and zeros for an empty range', async () => {
    const res = await user.agent.get('/api/v1/dashboard?from=2025-06-01&to=2025-06-30');
    expect(res.body.totals).toEqual({ incomeMinor: 0, expenseMinor: 0, netMinor: 0, transactionCount: 0, savingsRateBps: null });
    expect(res.body.expenseByCategory).toEqual([]);
  });

  it('rejects inverted and oversized ranges', async () => {
    expect((await user.agent.get('/api/v1/dashboard?from=2026-03-01&to=2026-02-01')).status).toBe(400);
    expect((await user.agent.get('/api/v1/dashboard?from=2020-01-01&to=2026-02-01')).status).toBe(400);
  });
});

describe('budgets', () => {
  it('calculates progress, warning and overspending for the month', async () => {
    const groceries = await categoryId(user, 'Groceries');
    const housing = await categoryId(user, 'Housing');
    const dining = await categoryId(user, 'Dining');
    expect((await mutate(user, 'post', '/api/v1/budgets').send({ categoryId: groceries, month: '2026-02', amount: '400' })).status).toBe(201);
    expect((await mutate(user, 'post', '/api/v1/budgets').send({ categoryId: housing, month: '2026-02', amount: '1400', warningThresholdPct: 90 })).status).toBe(201);
    const diningBudget = await mutate(user, 'post', '/api/v1/budgets').send({ categoryId: dining, month: '2026-02', amount: '200' });
    expect(diningBudget.body.budget).toMatchObject({ spentMinor: 8960, status: 'on_track', usedBps: 4480 });

    const dupe = await mutate(user, 'post', '/api/v1/budgets').send({ categoryId: groceries, month: '2026-02', amount: '1' });
    expect(dupe.status).toBe(409);

    const salary = await categoryId(user, 'Salary');
    const income = await mutate(user, 'post', '/api/v1/budgets').send({ categoryId: salary, month: '2026-02', amount: '1' });
    expect(income.status).toBe(400);

    const month = await user.agent.get('/api/v1/budgets?month=2026-02');
    const byName = Object.fromEntries(month.body.budgets.map((b: { category: { name: string } }) => [b.category.name, b]));
    expect(byName['Housing']).toMatchObject({ spentMinor: 150000, limitMinor: 140000, remainingMinor: -10000, status: 'over' });
    expect(byName['Groceries']).toMatchObject({ spentMinor: 31040, status: 'on_track', usedBps: 7760 });
    expect(month.body.totals).toEqual({ limitMinor: 200000, spentMinor: 190000, remainingMinor: 10000 });

    const edited = await mutate(user, 'patch', `/api/v1/budgets/${byName['Groceries'].id}`).send({ warningThresholdPct: 75 });
    expect(edited.body.budget.status).toBe('warning');

    const dash = await user.agent.get('/api/v1/dashboard?from=2026-02-01&to=2026-02-28');
    expect(dash.body.budgetAlerts.map((b: { category: { name: string } }) => b.category.name).sort()).toEqual(['Groceries', 'Housing']);
  });

  it('copies budgets into another month without duplicating', async () => {
    const first = await mutate(user, 'post', '/api/v1/budgets/copy').send({ fromMonth: '2026-02', toMonth: '2026-03' });
    expect(first.body).toEqual({ copied: 3, skipped: 0 });
    const again = await mutate(user, 'post', '/api/v1/budgets/copy').send({ fromMonth: '2026-02', toMonth: '2026-03' });
    expect(again.body).toEqual({ copied: 0, skipped: 3 });
    const march = await user.agent.get('/api/v1/budgets?month=2026-03');
    expect(march.body.budgets.every((b: { spentMinor: number }) => b.spentMinor === 0)).toBe(true);
  });
});

describe('reports', () => {
  it('compares a month with the previous one, overall and by category', async () => {
    const res = await user.agent.get('/api/v1/reports/comparison?month=2026-02');
    expect(res.status).toBe(200);
    expect(res.body.previousMonth).toBe('2026-01');
    expect(res.body.current).toMatchObject({ incomeMinor: 450055, expenseMinor: 190000 });
    expect(res.body.previous).toMatchObject({ incomeMinor: 400000, expenseMinor: 150030 });
    expect(res.body.change).toEqual({ incomeBps: 1251, expenseBps: 2664, netMinor: 10085 });
    const groceries = res.body.categories.find((c: { name: string }) => c.name === 'Groceries');
    expect(groceries).toMatchObject({ currentMinor: 31040, previousMinor: 30, type: 'expense' });
    const dining = res.body.categories.find((c: { name: string }) => c.name === 'Dining');
    expect(dining).toMatchObject({ previousMinor: 0, changeBps: null });
    const housing = res.body.categories.find((c: { name: string }) => c.name === 'Housing');
    expect(housing.changeBps).toBe(0);
  });

  it('returns a trend with totals and average monthly expense across year boundaries', async () => {
    const res = await user.agent.get('/api/v1/reports/trend?from=2025-12&to=2026-02');
    expect(res.body.series.map((p: { month: string }) => p.month)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(res.body.totals).toMatchObject({ incomeMinor: 850055, expenseMinor: 340030 });
    expect(res.body.averageMonthlyExpenseMinor).toBe(113343);
    expect((await user.agent.get('/api/v1/reports/trend?from=2023-01&to=2026-02')).status).toBe(400);
  });
});
