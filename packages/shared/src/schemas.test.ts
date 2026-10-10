import { describe, expect, it } from 'vitest';
import {
  createTransactionSchema,
  exportQuery,
  listTransactionsQuery,
  registerSchema,
  trendQuery,
} from './schemas.js';

describe('schemas', () => {
  it('rejects unknown keys (mass-assignment guard)', () => {
    const result = createTransactionSchema.safeParse({
      type: 'expense',
      amount: '10',
      categoryId: 'a'.repeat(24),
      date: '2026-01-05',
      paymentMethod: 'cash',
      ownerId: 'b'.repeat(24),
    });
    expect(result.success).toBe(false);
  });

  it('rejects MongoDB operator objects where strings are expected', () => {
    const result = registerSchema.safeParse({ name: 'A', email: { $gt: '' }, password: 'abcdefgh12' });
    expect(result.success).toBe(false);
  });

  it('normalises email and applies the password policy', () => {
    const ok = registerSchema.safeParse({ name: ' Asha ', email: ' ASHA@Example.com ', password: 'longenough1' });
    expect(ok.success && ok.data).toMatchObject({ name: 'Asha', email: 'asha@example.com', currency: 'USD' });
    expect(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'nodigitshere' }).success).toBe(false);
  });

  it('bounds pagination and date ranges', () => {
    expect(listTransactionsQuery.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(listTransactionsQuery.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success).toBe(false);
    expect(exportQuery.safeParse({ from: '2020-01-01', to: '2026-01-01' }).success).toBe(false);
    expect(exportQuery.safeParse({ from: '2025-01-01', to: '2025-12-31' }).success).toBe(true);
    expect(trendQuery.safeParse({ from: '2023-01', to: '2025-12' }).success).toBe(false);
  });
});
