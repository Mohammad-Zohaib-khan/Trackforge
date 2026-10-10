import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_EXPORT_ROWS } from '@trackforge/shared';
import { addTransaction, categoryId, registerUser, startHarness, type Harness, type TestUser } from './harness.js';
import { csvCell, csvRow, neutraliseFormula } from '../utils/csv.js';

describe('csv encoding', () => {
  it('neutralises spreadsheet formula triggers', () => {
    for (const payload of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
      expect(neutraliseFormula(payload).startsWith("'")).toBe(true);
    }
    expect(neutraliseFormula('Coffee')).toBe('Coffee');
  });

  it('quotes delimiters, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvRow(['x', 1, true, null])).toBe('x,1,true,');
  });
});

let h: Harness;
let user: TestUser;

beforeAll(async () => {
  h = await startHarness();
  user = await registerUser(h.app);
  await addTransaction(user, { amount: '12.5', category: 'Dining', date: '2026-04-02', merchant: '=cmd|"/c calc"!A1', note: 'team, lunch "friday"' });
  await addTransaction(user, { type: 'income', amount: '3000', category: 'Salary', date: '2026-04-01', merchant: 'Northwind' });
});
afterAll(async () => {
  await h.stop();
});

describe('transaction export', () => {
  it('returns a safe CSV attachment with exact decimal amounts', async () => {
    const res = await user.agent.get('/api/v1/exports/transactions.csv?from=2026-04-01&to=2026-04-30');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe('attachment; filename="trackforge-transactions-2026-04-01-to-2026-04-30.csv"');
    expect(res.headers['cache-control']).toBe('no-store');
    const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Date,Type,Category,Amount,Currency,Payment method,Merchant / payee,Note,Recurring');
    expect(lines[1]).toBe('2026-04-01,Income,Salary,3000.00,USD,Debit card,Northwind,,No');
    expect(lines[2]).toBe(`2026-04-02,Expense,Dining,12.50,USD,Debit card,"'=cmd|""/c calc""!A1","team, lunch ""friday""",No`);
  });

  it('filters by type and category', async () => {
    const res = await user.agent.get(`/api/v1/exports/transactions.csv?from=2026-04-01&to=2026-04-30&type=expense&categoryId=${await categoryId(user, 'Dining')}`);
    expect(res.text.trim().split('\r\n')).toHaveLength(2);
  });

  it('requires a bounded date range', async () => {
    expect((await user.agent.get('/api/v1/exports/transactions.csv')).status).toBe(400);
    expect((await user.agent.get('/api/v1/exports/transactions.csv?from=2020-01-01&to=2026-04-30')).status).toBe(400);
  });

  it('refuses exports above the row limit', async () => {
    const ownerId = new mongoose.Types.ObjectId(user.id);
    const cat = new mongoose.Types.ObjectId(await categoryId(user, 'Other'));
    const now = new Date();
    const docs = Array.from({ length: MAX_EXPORT_ROWS }, (_, i) => ({
      ownerId,
      type: 'expense',
      amountMinor: 100 + i,
      currency: 'USD',
      categoryId: cat,
      date: '2026-05-15',
      month: '2026-05',
      paymentMethod: 'cash',
      merchant: '',
      merchantKey: '',
      note: '',
      recurring: false,
      createdAt: now,
      updatedAt: now,
    }));
    await mongoose.connection.collection('transactions').insertMany(docs);
    const ok = await user.agent.get('/api/v1/exports/transactions.csv?from=2026-05-01&to=2026-05-31');
    expect(ok.status).toBe(200);
    expect(ok.headers['x-export-row-count']).toBe(String(MAX_EXPORT_ROWS));
    await addTransaction(user, { amount: '1', category: 'Other', date: '2026-05-20' });
    const tooMany = await user.agent.get('/api/v1/exports/transactions.csv?from=2026-05-01&to=2026-05-31');
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.error.code).toBe('EXPORT_TOO_LARGE');
  });
});
