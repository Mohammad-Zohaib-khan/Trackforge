import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addTransaction, categoryId, mutate, registerUser, startHarness, type Harness, type TestUser } from './harness.js';

/**
 * Proves strict per-user isolation: user A can never read, change, delete,
 * aggregate or export user B's records, and cannot attach B's categories.
 */

let h: Harness;
let alice: TestUser;
let bob: TestUser;
let bobTx: string;
let bobGroceries: string;
let bobBudget: string;

beforeAll(async () => {
  h = await startHarness();
  alice = await registerUser(h.app, { name: 'Alice' });
  bob = await registerUser(h.app, { name: 'Bob' });
  await addTransaction(alice, { amount: '10', category: 'Groceries', date: '2026-03-02', merchant: 'Alice Market' });
  bobTx = (await addTransaction(bob, { amount: '999', category: 'Groceries', date: '2026-03-03', merchant: 'Bob Secret Store' })).id;
  await addTransaction(bob, { type: 'income', amount: '7777', category: 'Salary', date: '2026-03-01' });
  bobGroceries = await categoryId(bob, 'Groceries');
  const budget = await mutate(bob, 'post', '/api/v1/budgets').send({ categoryId: bobGroceries, month: '2026-03', amount: '500' });
  bobBudget = budget.body.budget.id as string;
});
afterAll(async () => {
  await h.stop();
});

describe('cross-user access is denied', () => {
  it('cannot read another user’s transaction (same response as a missing record)', async () => {
    const res = await alice.agent.get(`/api/v1/transactions/${bobTx}`);
    const missing = await alice.agent.get('/api/v1/transactions/0123456789abcdef01234567');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(missing.body);
  });

  it('cannot update or delete another user’s transaction', async () => {
    expect((await mutate(alice, 'patch', `/api/v1/transactions/${bobTx}`).send({ amount: '1' })).status).toBe(404);
    expect((await mutate(alice, 'delete', `/api/v1/transactions/${bobTx}`)).status).toBe(404);
    const still = await bob.agent.get(`/api/v1/transactions/${bobTx}`);
    expect(still.body.transaction.amountMinor).toBe(99900);
  });

  it('never lists another user’s records, even when filtering by their category id', async () => {
    const list = await alice.agent.get('/api/v1/transactions');
    expect(list.body.total).toBe(1);
    expect(JSON.stringify(list.body)).not.toContain('Bob Secret Store');
    const byBobCategory = await alice.agent.get(`/api/v1/transactions?categoryId=${bobGroceries}`);
    expect(byBobCategory.body.total).toBe(0);
  });

  it('cannot use another user’s category for a transaction or budget', async () => {
    const tx = await mutate(alice, 'post', '/api/v1/transactions').send({ type: 'expense', amount: '5', categoryId: bobGroceries, date: '2026-03-05', paymentMethod: 'cash' });
    expect(tx.status).toBe(400);
    const budget = await mutate(alice, 'post', '/api/v1/budgets').send({ categoryId: bobGroceries, month: '2026-03', amount: '50' });
    expect(budget.status).toBe(400);
  });

  it('cannot rename, archive or delete another user’s category', async () => {
    expect((await mutate(alice, 'patch', `/api/v1/categories/${bobGroceries}`).send({ name: 'Hacked' })).status).toBe(404);
    expect((await mutate(alice, 'delete', `/api/v1/categories/${bobGroceries}`)).status).toBe(404);
    const bobCats = await bob.agent.get('/api/v1/categories');
    expect(bobCats.body.items.some((c: { name: string }) => c.name === 'Groceries')).toBe(true);
  });

  it('cannot see, change or delete another user’s budget', async () => {
    const list = await alice.agent.get('/api/v1/budgets?month=2026-03');
    expect(list.body.budgets).toHaveLength(0);
    expect((await mutate(alice, 'patch', `/api/v1/budgets/${bobBudget}`).send({ amount: '1' })).status).toBe(404);
    expect((await mutate(alice, 'delete', `/api/v1/budgets/${bobBudget}`)).status).toBe(404);
  });

  it('aggregates (dashboard and reports) only include the caller’s data', async () => {
    const dash = await alice.agent.get('/api/v1/dashboard?from=2026-03-01&to=2026-03-31');
    expect(dash.body.totals).toMatchObject({ incomeMinor: 0, expenseMinor: 1000, transactionCount: 1 });
    expect(JSON.stringify(dash.body)).not.toContain('Bob Secret Store');
    const cmp = await alice.agent.get('/api/v1/reports/comparison?month=2026-03');
    expect(cmp.body.current.expenseMinor).toBe(1000);
    const trend = await alice.agent.get('/api/v1/reports/trend?from=2026-01&to=2026-03');
    expect(trend.body.totals.incomeMinor).toBe(0);
  });

  it('exports only the caller’s data', async () => {
    const csv = await alice.agent.get('/api/v1/exports/transactions.csv?from=2026-01-01&to=2026-12-31');
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Alice Market');
    expect(csv.text).not.toContain('Bob Secret Store');
    const filtered = await alice.agent.get(`/api/v1/exports/transactions.csv?from=2026-01-01&to=2026-12-31&categoryId=${bobGroceries}`);
    expect(filtered.text.trim().split('\r\n')).toHaveLength(1);
  });

  it('ignores client-supplied owner ids (mass assignment is rejected)', async () => {
    const groceries = await categoryId(alice, 'Groceries');
    const res = await mutate(alice, 'post', '/api/v1/transactions').send({
      type: 'expense',
      amount: '1',
      categoryId: groceries,
      date: '2026-03-06',
      paymentMethod: 'cash',
      ownerId: bob.id,
    });
    expect(res.status).toBe(400);
    const bobList = await bob.agent.get('/api/v1/transactions');
    expect(bobList.body.total).toBe(2);
  });

  it('cannot reuse another user’s CSRF token', async () => {
    const res = await alice.agent.post('/api/v1/categories').set('Origin', 'http://localhost:5173').set('X-CSRF-Token', bob.csrf).send({ name: 'X', type: 'expense' });
    expect(res.status).toBe(403);
  });
});
