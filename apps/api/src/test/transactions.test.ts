import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addTransaction, categoryId, mutate, registerUser, startHarness, type Harness, type TestUser } from './harness.js';

let h: Harness;
let user: TestUser;

beforeAll(async () => {
  h = await startHarness();
  user = await registerUser(h.app);
  await addTransaction(user, { type: 'income', amount: '5000', category: 'Salary', date: '2026-01-01', merchant: 'Northwind Ltd' });
  await addTransaction(user, { amount: '42.10', category: 'Groceries', date: '2026-01-03', merchant: 'Green Basket', note: 'weekly shop' });
  await addTransaction(user, { amount: '9.99', category: 'Subscriptions', date: '2026-01-05', merchant: 'StreamCo' });
  await addTransaction(user, { amount: '120', category: 'Dining', date: '2026-01-20', merchant: 'Harbor Grill', paymentMethod: 'credit_card' });
  await addTransaction(user, { amount: '64.5', category: 'Groceries', date: '2026-02-02', merchant: 'Green Basket' });
});
afterAll(async () => {
  await h.stop();
});

describe('transaction CRUD', () => {
  it('creates with exact minor units and returns the category', async () => {
    const other = await categoryId(user, 'Other');
    const res = await mutate(user, 'post', '/api/v1/transactions').send({
      type: 'expense',
      amount: '0.29',
      categoryId: other,
      date: '2026-01-31',
      paymentMethod: 'cash',
      merchant: '  Corner Shop  ',
    });
    expect(res.status).toBe(201);
    expect(res.body.transaction).toMatchObject({ amountMinor: 29, currency: 'USD', merchant: 'Corner Shop', category: { name: 'Other' } });
    const read = await user.agent.get(`/api/v1/transactions/${res.body.transaction.id}`);
    expect(read.status).toBe(200);
    const del = await mutate(user, 'delete', `/api/v1/transactions/${res.body.transaction.id}`);
    expect(del.status).toBe(204);
    expect((await user.agent.get(`/api/v1/transactions/${res.body.transaction.id}`)).status).toBe(404);
  });

  it('validates amount, date, category type and archived categories', async () => {
    const groceries = await categoryId(user, 'Groceries');
    const base = { type: 'expense', categoryId: groceries, date: '2026-01-10', paymentMethod: 'cash' };
    for (const amount of ['0', '-5', '1.234', '1e5', 'abc']) {
      const res = await mutate(user, 'post', '/api/v1/transactions').send({ ...base, amount });
      expect(res.status, amount).toBe(400);
    }
    expect((await mutate(user, 'post', '/api/v1/transactions').send({ ...base, amount: '1', date: '2026-02-30' })).status).toBe(400);

    const wrongType = await mutate(user, 'post', '/api/v1/transactions').send({ ...base, type: 'income', amount: '10' });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error.fields.categoryId).toMatch(/income category/);

    const created = await mutate(user, 'post', '/api/v1/categories').send({ name: 'Old hobby', type: 'expense' });
    await mutate(user, 'patch', `/api/v1/categories/${created.body.category.id}`).send({ archived: true });
    const archived = await mutate(user, 'post', '/api/v1/transactions').send({ ...base, amount: '1', categoryId: created.body.category.id });
    expect(archived.status).toBe(400);
  });

  it('updates only allowlisted fields and keeps type/category consistent', async () => {
    const { id } = await addTransaction(user, { amount: '10', category: 'Transport', date: '2026-01-15' });
    const patched = await mutate(user, 'patch', `/api/v1/transactions/${id}`).send({ amount: '11.50', note: 'taxi', recurring: true });
    expect(patched.status).toBe(200);
    expect(patched.body.transaction).toMatchObject({ amountMinor: 1150, note: 'taxi', recurring: true });

    const flip = await mutate(user, 'patch', `/api/v1/transactions/${id}`).send({ type: 'income' });
    expect(flip.status).toBe(400);

    const sneaky = await mutate(user, 'patch', `/api/v1/transactions/${id}`).send({ amountMinor: 1, currency: 'EUR' });
    expect(sneaky.status).toBe(400);
    await mutate(user, 'delete', `/api/v1/transactions/${id}`);
  });

  it('treats malformed ids as not found', async () => {
    expect((await user.agent.get('/api/v1/transactions/not-an-id')).status).toBe(404);
    expect((await mutate(user, 'delete', '/api/v1/transactions/aaaaaaaaaaaaaaaaaaaaaaaa')).status).toBe(404);
  });
});

describe('listing', () => {
  it('filters by type, category, date range, payment method and amount', async () => {
    const groceries = await categoryId(user, 'Groceries');
    const byCat = await user.agent.get(`/api/v1/transactions?categoryId=${groceries}`);
    expect(byCat.body.total).toBe(2);
    const jan = await user.agent.get('/api/v1/transactions?from=2026-01-01&to=2026-01-31&type=expense');
    expect(jan.body.items.map((t: { merchant: string }) => t.merchant)).toEqual(['Harbor Grill', 'StreamCo', 'Green Basket']);
    const card = await user.agent.get('/api/v1/transactions?paymentMethod=credit_card');
    expect(card.body.total).toBe(1);
    const amount = await user.agent.get('/api/v1/transactions?minAmount=40&maxAmount=100');
    expect(amount.body.items.map((t: { amountMinor: number }) => t.amountMinor).sort()).toEqual([4210, 6450]);
    const badRange = await user.agent.get('/api/v1/transactions?minAmount=100&maxAmount=40');
    expect(badRange.status).toBe(400);
  });

  it('searches merchant and note case-insensitively with regex characters treated literally', async () => {
    const res = await user.agent.get('/api/v1/transactions?q=green');
    expect(res.body.total).toBe(2);
    const note = await user.agent.get('/api/v1/transactions?q=WEEKLY');
    expect(note.body.total).toBe(1);
    const regex = await user.agent.get(`/api/v1/transactions?q=${encodeURIComponent('.*')}`);
    expect(regex.body.total).toBe(0);
  });

  it('sorts and paginates with stable totals', async () => {
    const asc = await user.agent.get('/api/v1/transactions?sort=amount&order=asc');
    const amounts = asc.body.items.map((t: { amountMinor: number }) => t.amountMinor);
    expect(amounts).toEqual([...amounts].sort((a: number, b: number) => a - b));
    const merchant = await user.agent.get('/api/v1/transactions?sort=merchant&order=asc&type=expense');
    expect(merchant.body.items[0].merchant).toBe('Green Basket');

    const p1 = await user.agent.get('/api/v1/transactions?pageSize=2&page=1');
    const p3 = await user.agent.get('/api/v1/transactions?pageSize=2&page=3');
    expect(p1.body).toMatchObject({ total: 5, totalPages: 3, page: 1 });
    expect(p1.body.items).toHaveLength(2);
    expect(p3.body.items).toHaveLength(1);
    const ids = new Set([...p1.body.items, ...p3.body.items].map((t: { id: string }) => t.id));
    expect(ids.size).toBe(3);
    expect((await user.agent.get('/api/v1/transactions?pageSize=101')).status).toBe(400);
  });
});

describe('categories', () => {
  it('creates, renames, prevents duplicates and protects categories in use', async () => {
    const created = await mutate(user, 'post', '/api/v1/categories').send({ name: 'Pets', type: 'expense', icon: 'paw-print', color: '#94FFD1' });
    expect(created.status).toBe(201);
    const dupe = await mutate(user, 'post', '/api/v1/categories').send({ name: 'pets', type: 'expense' });
    expect(dupe.status).toBe(409);
    const sameNameOtherType = await mutate(user, 'post', '/api/v1/categories').send({ name: 'Pets', type: 'income' });
    expect(sameNameOtherType.status).toBe(201);

    const id = created.body.category.id as string;
    const renamed = await mutate(user, 'patch', `/api/v1/categories/${id}`).send({ name: 'Pet care' });
    expect(renamed.body.category.name).toBe('Pet care');

    await addTransaction(user, { amount: '30', category: 'Pet care', date: '2026-01-12' });
    const blocked = await mutate(user, 'delete', `/api/v1/categories/${id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CATEGORY_IN_USE');

    const archived = await mutate(user, 'patch', `/api/v1/categories/${id}`).send({ archived: true });
    expect(archived.body.category.archived).toBe(true);
    const list = await user.agent.get('/api/v1/categories?type=expense');
    expect(list.body.items.some((c: { id: string }) => c.id === id)).toBe(false);
    const all = await user.agent.get('/api/v1/categories?type=expense&includeArchived=true');
    expect(all.body.items.some((c: { id: string }) => c.id === id)).toBe(true);

    // History keeps the archived category's name.
    const tx = await user.agent.get(`/api/v1/transactions?categoryId=${id}`);
    expect(tx.body.items[0].category.name).toBe('Pet care');

    const unused = await mutate(user, 'delete', `/api/v1/categories/${sameNameOtherType.body.category.id}`);
    expect(unused.status).toBe(204);
  });
});
