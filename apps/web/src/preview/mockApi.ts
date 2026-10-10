/**
 * PREVIEW-ONLY in-browser stand-in for the TrackForge API.
 *
 * Used exclusively by the static preview build (preview.html) so the UI can be
 * clicked through without a server. It is never imported by the real app entry.
 * It reuses the shared schemas and finance functions, so validation and maths
 * match the server, but data lives in memory and resets on reload.
 */
import {
  addMonths,
  budgetProgress,
  buildMonthlySeries,
  changeBps,
  copyBudgetsSchema,
  createBudgetSchema,
  createCategorySchema,
  createTransactionSchema,
  dateRangeQuery,
  listTransactionsQuery,
  monthOf,
  monthsBetween,
  parseAmountToMinor,
  summarizeTotals,
  todayInTimeZone,
  trendQuery,
  updateBudgetSchema,
  updateCategorySchema,
  updatePreferencesSchema,
  updateProfileSchema,
  updateTransactionSchema,
  type BudgetDto,
  type CategoryDto,
  type CategoryIcon,
  type CurrencyCode,
  type PaymentMethod,
  type SafeUser,
  type TransactionDto,
  type TransactionType,
} from '@trackforge/shared';
import type { ZodType } from 'zod';

interface Tx {
  id: string;
  type: TransactionType;
  amountMinor: number;
  categoryId: string;
  date: string;
  paymentMethod: PaymentMethod;
  merchant: string;
  note: string;
  recurring: boolean;
  createdAt: string;
}

interface Budget {
  id: string;
  categoryId: string;
  month: string;
  amountMinor: number;
  warningThresholdPct: number;
}

class Reply {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {}
}

const fail = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  new Reply(status, { error: { code, message, ...(fields ? { fields } : {}) } });

let seq = 1;
const newId = () => (seq++).toString(16).padStart(24, 'a');

/* ---------- example data ---------- */

const STARTERS: Array<[string, TransactionType, CategoryIcon, string]> = [
  ['Salary', 'income', 'briefcase', '#94FFD1'],
  ['Freelance', 'income', 'wallet', '#6BF5FF'],
  ['Investments', 'income', 'trending-up', '#B8F2E6'],
  ['Housing', 'expense', 'home', '#6BF5FF'],
  ['Groceries', 'expense', 'shopping-cart', '#94FFD1'],
  ['Dining', 'expense', 'utensils', '#F5D27A'],
  ['Transport', 'expense', 'car', '#9DB8FF'],
  ['Utilities', 'expense', 'bolt', '#C9A7FF'],
  ['Health', 'expense', 'heart-pulse', '#FF9DB0'],
  ['Entertainment', 'expense', 'film', '#FFB98A'],
  ['Subscriptions', 'expense', 'repeat', '#A8E6CF'],
  ['Other', 'expense', 'tag', '#A5B5AE'],
];

const state = {
  user: null as SafeUser | null,
  categories: [] as CategoryDto[],
  txs: [] as Tx[],
  budgets: [] as Budget[],
};

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedExampleLedger(): void {
  state.categories = STARTERS.map(([name, type, icon, color]) => ({ id: newId(), name, type, icon, color, archived: false, isDefault: true }));
  const cat = (name: string) => state.categories.find((c) => c.name === name)?.id ?? '';
  const rand = rng(42);
  const today = todayInTimeZone(state.user?.preferences.timeZone ?? 'UTC');
  const thisMonth = monthOf(today);
  const plan: Array<[string, string[], number, number, number, PaymentMethod]> = [
    ['Groceries', ['Green Basket (example)', 'Harvest Lane (example)'], 6, 18, 110, 'debit_card'],
    ['Dining', ['Harbor Grill (example)', 'Noodle Bar (example)'], 4, 9, 70, 'credit_card'],
    ['Transport', ['Metro Card (example)', 'QuickRide (example)'], 4, 6, 50, 'upi'],
    ['Entertainment', ['Grand Cinema (example)'], 1, 12, 45, 'credit_card'],
    ['Health', ['Riverside Pharmacy (example)'], 1, 12, 60, 'debit_card'],
  ];
  for (let back = 5; back >= 0; back -= 1) {
    const month = addMonths(thisMonth, -back);
    const lastDay = back === 0 ? Number(today.slice(8, 10)) : 28;
    const day = (d: number) => `${month}-${String(((d - 1) % lastDay) + 1).padStart(2, '0')}`;
    const push = (t: Omit<Tx, 'id' | 'createdAt' | 'note'>) => state.txs.push({ ...t, id: newId(), note: '', createdAt: new Date().toISOString() });
    push({ type: 'income', amountMinor: 520_000, categoryId: cat('Salary'), date: day(1), paymentMethod: 'bank_transfer', merchant: 'Northwind Studio (example)', recurring: true });
    if (rand() < 0.6) push({ type: 'income', amountMinor: Math.round(20_000 + rand() * 60_000), categoryId: cat('Freelance'), date: day(15), paymentMethod: 'bank_transfer', merchant: 'Blue Finch Agency (example)', recurring: false });
    push({ type: 'expense', amountMinor: 145_000, categoryId: cat('Housing'), date: day(3), paymentMethod: 'bank_transfer', merchant: 'Maple Court Rentals (example)', recurring: true });
    push({ type: 'expense', amountMinor: Math.round(6_000 + rand() * 4_000), categoryId: cat('Utilities'), date: day(7), paymentMethod: 'debit_card', merchant: 'City Power (example)', recurring: true });
    push({ type: 'expense', amountMinor: 1_599, categoryId: cat('Subscriptions'), date: day(10), paymentMethod: 'credit_card', merchant: 'StreamCo (example)', recurring: true });
    for (const [name, merchants, count, min, max, method] of plan) {
      const n = Math.max(1, Math.round(count * (0.7 + rand() * 0.6)));
      for (let i = 0; i < n; i += 1) {
        push({
          type: 'expense',
          amountMinor: Math.round((min + rand() * (max - min)) * 100),
          categoryId: cat(name),
          date: day(1 + Math.floor(rand() * 28)),
          paymentMethod: method,
          merchant: merchants[i % merchants.length] ?? '',
          recurring: false,
        });
      }
    }
  }
  for (const [name, amount, pct] of [['Groceries', 52_000, 80], ['Dining', 25_000, 75], ['Transport', 18_000, 80], ['Entertainment', 9_000, 80]] as const) {
    for (const month of [addMonths(thisMonth, -1), thisMonth]) {
      state.budgets.push({ id: newId(), categoryId: cat(name), month, amountMinor: amount, warningThresholdPct: pct });
    }
  }
}

/* ---------- helpers ---------- */

function parseWith<T>(schema: ZodType<T>, data: unknown): T | Reply {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fail(400, 'VALIDATION_ERROR', 'Some fields need attention', fields);
}

const currency = (): CurrencyCode => state.user?.preferences.currency ?? 'USD';

function amount(value: string, field = 'amount'): number | Reply {
  const r = parseAmountToMinor(value, currency());
  if (r.ok) return r.minor;
  return fail(400, 'VALIDATION_ERROR', 'Some fields need attention', {
    [field]: r.reason === 'precision' ? 'At most two decimal places' : r.reason === 'range' ? 'Enter an amount greater than zero' : 'Enter an amount like 1250 or 1250.50',
  });
}

function txDto(t: Tx): TransactionDto {
  const c = state.categories.find((x) => x.id === t.categoryId);
  return {
    id: t.id,
    type: t.type,
    amountMinor: t.amountMinor,
    currency: currency(),
    date: t.date,
    paymentMethod: t.paymentMethod,
    merchant: t.merchant,
    note: t.note,
    recurring: t.recurring,
    category: c ? { id: c.id, name: c.name, icon: c.icon, color: c.color } : null,
    createdAt: t.createdAt,
    updatedAt: t.createdAt,
  };
}

function totalsFor(txs: Tx[]) {
  return summarizeTotals(
    (['income', 'expense'] as const).map((type) => ({
      type,
      totalMinor: txs.filter((t) => t.type === type).reduce((s, t) => s + t.amountMinor, 0),
      count: txs.filter((t) => t.type === type).length,
    })),
  );
}

function budgetsFor(month: string): BudgetDto[] {
  return state.budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const c = state.categories.find((x) => x.id === b.categoryId);
      const spent = state.txs.filter((t) => t.type === 'expense' && t.categoryId === b.categoryId && monthOf(t.date) === month).reduce((s, t) => s + t.amountMinor, 0);
      const p = budgetProgress(spent, b.amountMinor, b.warningThresholdPct);
      return {
        id: b.id,
        month,
        category: { id: b.categoryId, name: c?.name ?? 'Deleted category', icon: c?.icon ?? 'tag', color: c?.color ?? null, archived: c?.archived ?? true },
        limitMinor: b.amountMinor,
        warningThresholdPct: b.warningThresholdPct,
        spentMinor: p.spentMinor,
        remainingMinor: p.remainingMinor,
        usedBps: p.usedBps,
        status: p.status,
      };
    })
    .sort((a, b) => b.usedBps - a.usedBps);
}

function signIn(name: string, email: string): Reply {
  state.user = {
    id: newId(),
    name,
    email,
    preferences: { currency: 'USD', locale: 'en-US', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', dateStyle: 'medium' },
    createdAt: new Date().toISOString(),
  };
  state.txs = [];
  state.budgets = [];
  seedExampleLedger();
  return new Reply(200, { user: state.user, csrfToken: 'preview' });
}

/* ---------- router ---------- */

type Handler = (body: Record<string, unknown>, query: Record<string, string>, id: string) => Reply;

const routes: Array<[string, RegExp, Handler]> = [
  ['GET', /^\/auth\/session$/, () => new Reply(200, state.user ? { user: state.user, csrfToken: 'preview' } : { user: null })],
  ['GET', /^\/auth\/me$/, () => (state.user ? new Reply(200, { user: state.user, csrfToken: 'preview' }) : fail(401, 'UNAUTHENTICATED', 'Sign in to continue'))],
  ['POST', /^\/auth\/login$/, (b) => signIn('Preview visitor', typeof b['email'] === 'string' ? b['email'] : 'preview@example.test')],
  ['POST', /^\/auth\/register$/, (b) => {
    const r = signIn(typeof b['name'] === 'string' ? b['name'] : 'Preview visitor', typeof b['email'] === 'string' ? b['email'] : 'preview@example.test');
    return new Reply(201, r.body);
  }],
  ['POST', /^\/auth\/logout$/, () => {
    state.user = null;
    return new Reply(204, null);
  }],
  ['PATCH', /^\/users\/me$/, (b) => {
    const input = parseWith(updateProfileSchema, b);
    if (input instanceof Reply || !state.user) return input instanceof Reply ? input : fail(401, 'UNAUTHENTICATED', 'Sign in');
    state.user = { ...state.user, name: input.name };
    return new Reply(200, { user: state.user });
  }],
  ['PATCH', /^\/users\/me\/preferences$/, (b) => {
    const input = parseWith(updatePreferencesSchema, b);
    if (input instanceof Reply || !state.user) return input instanceof Reply ? input : fail(401, 'UNAUTHENTICATED', 'Sign in');
    if (input.currency && input.currency !== state.user.preferences.currency && state.txs.length) {
      return fail(409, 'CURRENCY_LOCKED', 'Currency can only change before you record transactions, so totals never mix currencies.');
    }
    state.user = { ...state.user, preferences: { ...state.user.preferences, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } };
    return new Reply(200, { user: state.user });
  }],
  ['POST', /^\/users\/me\/password$/, () => fail(501, 'PREVIEW', 'Password changes need the full app. This preview has no accounts.')],
  ['POST', /^\/users\/me\/sessions\/revoke-others$/, () => new Reply(200, { revoked: 0 })],
  ['DELETE', /^\/users\/me$/, () => fail(501, 'PREVIEW', 'Account deletion needs the full app. Reload the page to reset this preview.')],

  ['GET', /^\/categories$/, (_b, q) => {
    let items = state.categories;
    if (q['type']) items = items.filter((c) => c.type === q['type']);
    if (q['includeArchived'] !== 'true') items = items.filter((c) => !c.archived);
    return new Reply(200, { items: [...items].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)) });
  }],
  ['POST', /^\/categories$/, (b) => {
    const input = parseWith(createCategorySchema, b);
    if (input instanceof Reply) return input;
    if (state.categories.some((c) => c.type === input.type && c.name.toLowerCase() === input.name.toLowerCase())) {
      return fail(409, 'CATEGORY_EXISTS', `You already have a ${input.type} category named “${input.name}”`);
    }
    const category: CategoryDto = { id: newId(), name: input.name, type: input.type, icon: input.icon, color: input.color ?? null, archived: false, isDefault: false };
    state.categories.push(category);
    return new Reply(201, { category });
  }],
  ['PATCH', /^\/categories\/([a-f\d]{24})$/, (b, _q, id) => {
    const input = parseWith(updateCategorySchema, b);
    if (input instanceof Reply) return input;
    const c = state.categories.find((x) => x.id === id);
    if (!c) return fail(404, 'NOT_FOUND', 'Category not found');
    if (input.name !== undefined) c.name = input.name;
    if (input.icon !== undefined) c.icon = input.icon;
    if (input.color !== undefined) c.color = input.color;
    if (input.archived !== undefined) c.archived = input.archived;
    return new Reply(200, { category: c });
  }],
  ['DELETE', /^\/categories\/([a-f\d]{24})$/, (_b, _q, id) => {
    if (state.txs.some((t) => t.categoryId === id) || state.budgets.some((x) => x.categoryId === id)) {
      return fail(409, 'CATEGORY_IN_USE', 'This category is used by transactions or budgets. Archive it instead so your history stays accurate.');
    }
    state.categories = state.categories.filter((c) => c.id !== id);
    return new Reply(204, null);
  }],

  ['GET', /^\/transactions$/, (_b, q) => {
    const query = parseWith(listTransactionsQuery, q);
    if (query instanceof Reply) return query;
    let rows = state.txs.filter((t) => {
      if (query.type && t.type !== query.type) return false;
      if (query.categoryId && t.categoryId !== query.categoryId) return false;
      if (query.paymentMethod && t.paymentMethod !== query.paymentMethod) return false;
      if (query.from && t.date < query.from) return false;
      if (query.to && t.date > query.to) return false;
      if (query.q) {
        const needle = query.q.toLowerCase();
        if (!t.merchant.toLowerCase().includes(needle) && !t.note.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
    if (query.minAmount) {
      const min = amount(query.minAmount, 'minAmount');
      if (min instanceof Reply) return min;
      rows = rows.filter((t) => t.amountMinor >= min);
    }
    if (query.maxAmount) {
      const max = amount(query.maxAmount, 'maxAmount');
      if (max instanceof Reply) return max;
      rows = rows.filter((t) => t.amountMinor <= max);
    }
    const dir = query.order === 'asc' ? 1 : -1;
    const key = (t: Tx): string | number => (query.sort === 'amount' ? t.amountMinor : query.sort === 'merchant' ? t.merchant.toLowerCase() : query.sort === 'createdAt' ? t.createdAt : t.date);
    rows = [...rows].sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : (a.createdAt < b.createdAt ? -dir : dir)));
    const start = (query.page - 1) * query.pageSize;
    return new Reply(200, {
      items: rows.slice(start, start + query.pageSize).map(txDto),
      page: query.page,
      pageSize: query.pageSize,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / query.pageSize)),
    });
  }],
  ['POST', /^\/transactions$/, (b) => {
    const input = parseWith(createTransactionSchema, b);
    if (input instanceof Reply) return input;
    const minor = amount(input.amount);
    if (minor instanceof Reply) return minor;
    const c = state.categories.find((x) => x.id === input.categoryId);
    if (!c || c.type !== input.type || c.archived) return fail(400, 'VALIDATION_ERROR', 'Some fields need attention', { categoryId: `Choose an active ${input.type} category` });
    const tx: Tx = { id: newId(), type: input.type, amountMinor: minor, categoryId: input.categoryId, date: input.date, paymentMethod: input.paymentMethod, merchant: input.merchant ?? '', note: input.note ?? '', recurring: input.recurring, createdAt: new Date().toISOString() };
    state.txs.push(tx);
    return new Reply(201, { transaction: txDto(tx) });
  }],
  ['PATCH', /^\/transactions\/([a-f\d]{24})$/, (b, _q, id) => {
    const input = parseWith(updateTransactionSchema, b);
    if (input instanceof Reply) return input;
    const tx = state.txs.find((t) => t.id === id);
    if (!tx) return fail(404, 'NOT_FOUND', 'Transaction not found');
    const nextType = input.type ?? tx.type;
    const nextCat = state.categories.find((x) => x.id === (input.categoryId ?? tx.categoryId));
    if (!nextCat || nextCat.type !== nextType) return fail(400, 'VALIDATION_ERROR', 'Some fields need attention', { categoryId: `Choose an ${nextType} category for an ${nextType}` });
    if (input.amount !== undefined) {
      const minor = amount(input.amount);
      if (minor instanceof Reply) return minor;
      tx.amountMinor = minor;
    }
    tx.type = nextType;
    tx.categoryId = nextCat.id;
    if (input.date !== undefined) tx.date = input.date;
    if (input.paymentMethod !== undefined) tx.paymentMethod = input.paymentMethod;
    if (input.merchant !== undefined) tx.merchant = input.merchant;
    if (input.note !== undefined) tx.note = input.note;
    if (input.recurring !== undefined) tx.recurring = input.recurring;
    return new Reply(200, { transaction: txDto(tx) });
  }],
  ['DELETE', /^\/transactions\/([a-f\d]{24})$/, (_b, _q, id) => {
    const before = state.txs.length;
    state.txs = state.txs.filter((t) => t.id !== id);
    return state.txs.length === before ? fail(404, 'NOT_FOUND', 'Transaction not found') : new Reply(204, null);
  }],

  ['GET', /^\/budgets$/, (_b, q) => {
    const month = q['month'] ?? '';
    const budgets = budgetsFor(month);
    const limitMinor = budgets.reduce((s, x) => s + x.limitMinor, 0);
    const spentMinor = budgets.reduce((s, x) => s + x.spentMinor, 0);
    return new Reply(200, { month, currency: currency(), budgets, totals: { limitMinor, spentMinor, remainingMinor: limitMinor - spentMinor } });
  }],
  ['POST', /^\/budgets$/, (b) => {
    const input = parseWith(createBudgetSchema, b);
    if (input instanceof Reply) return input;
    const minor = amount(input.amount);
    if (minor instanceof Reply) return minor;
    if (state.budgets.some((x) => x.categoryId === input.categoryId && x.month === input.month)) return fail(409, 'BUDGET_EXISTS', 'This category already has a budget for that month. Edit it instead.');
    const budget: Budget = { id: newId(), categoryId: input.categoryId, month: input.month, amountMinor: minor, warningThresholdPct: input.warningThresholdPct };
    state.budgets.push(budget);
    return new Reply(201, { budget: budgetsFor(input.month).find((x) => x.id === budget.id) });
  }],
  ['PATCH', /^\/budgets\/([a-f\d]{24})$/, (b, _q, id) => {
    const input = parseWith(updateBudgetSchema, b);
    if (input instanceof Reply) return input;
    const budget = state.budgets.find((x) => x.id === id);
    if (!budget) return fail(404, 'NOT_FOUND', 'Budget not found');
    if (input.amount !== undefined) {
      const minor = amount(input.amount);
      if (minor instanceof Reply) return minor;
      budget.amountMinor = minor;
    }
    if (input.warningThresholdPct !== undefined) budget.warningThresholdPct = input.warningThresholdPct;
    return new Reply(200, { budget: budgetsFor(budget.month).find((x) => x.id === id) });
  }],
  ['DELETE', /^\/budgets\/([a-f\d]{24})$/, (_b, _q, id) => {
    state.budgets = state.budgets.filter((x) => x.id !== id);
    return new Reply(204, null);
  }],
  ['POST', /^\/budgets\/copy$/, (b) => {
    const input = parseWith(copyBudgetsSchema, b);
    if (input instanceof Reply) return input;
    const taken = new Set(state.budgets.filter((x) => x.month === input.toMonth).map((x) => x.categoryId));
    const source = state.budgets.filter((x) => x.month === input.fromMonth);
    const copy = source.filter((x) => !taken.has(x.categoryId));
    copy.forEach((x) => state.budgets.push({ ...x, id: newId(), month: input.toMonth }));
    return new Reply(200, { copied: copy.length, skipped: source.length - copy.length });
  }],

  ['GET', /^\/dashboard$/, (_b, q) => {
    const range = parseWith(dateRangeQuery, q);
    if (range instanceof Reply) return range;
    const inRange = state.txs.filter((t) => t.date >= range.from && t.date <= range.to);
    const endMonth = monthOf(range.to);
    const months = monthsBetween(addMonths(endMonth, -11), endMonth);
    const trend = buildMonthlySeries(months, state.txs.map((t) => ({ month: monthOf(t.date), type: t.type, totalMinor: t.amountMinor })));
    const expenses = inRange.filter((t) => t.type === 'expense');
    const grand = expenses.reduce((s, t) => s + t.amountMinor, 0);
    const byCat = new Map<string, { total: number; count: number }>();
    expenses.forEach((t) => {
      const e = byCat.get(t.categoryId) ?? { total: 0, count: 0 };
      byCat.set(t.categoryId, { total: e.total + t.amountMinor, count: e.count + 1 });
    });
    const expenseByCategory = [...byCat.entries()]
      .map(([id, v]) => {
        const c = state.categories.find((x) => x.id === id);
        return { categoryId: id, name: c?.name ?? 'Deleted category', icon: c?.icon ?? 'tag', color: c?.color ?? null, totalMinor: v.total, count: v.count, shareBps: grand ? Math.round((v.total * 10_000) / grand) : 0 };
      })
      .sort((a, b) => b.totalMinor - a.totalMinor);
    const recent = [...inRange].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6).map(txDto);
    return new Reply(200, {
      range,
      currency: currency(),
      totals: totalsFor(inRange),
      trend,
      expenseByCategory,
      recent,
      budgetAlerts: budgetsFor(endMonth).filter((x) => x.status !== 'on_track'),
      budgetMonth: endMonth,
    });
  }],
  ['GET', /^\/reports\/comparison$/, (_b, q) => {
    const month = q['month'] ?? '';
    const prev = addMonths(month, -1);
    const cur = state.txs.filter((t) => monthOf(t.date) === month);
    const old = state.txs.filter((t) => monthOf(t.date) === prev);
    const current = totalsFor(cur);
    const previous = totalsFor(old);
    const ids = new Set([...cur, ...old].map((t) => `${t.type}:${t.categoryId}`));
    const categories = [...ids]
      .map((key) => {
        const [type, id] = key.split(':') as [TransactionType, string];
        const c = state.categories.find((x) => x.id === id);
        const sum = (rows: Tx[]) => rows.filter((t) => t.type === type && t.categoryId === id).reduce((s, t) => s + t.amountMinor, 0);
        const currentMinor = sum(cur);
        const previousMinor = sum(old);
        return { categoryId: id, name: c?.name ?? 'Deleted category', icon: c?.icon ?? 'tag', type, currentMinor, previousMinor, changeBps: changeBps(previousMinor, currentMinor) };
      })
      .sort((a, b) => (a.type === b.type ? b.currentMinor - a.currentMinor : a.type === 'expense' ? -1 : 1));
    return new Reply(200, {
      month,
      previousMonth: prev,
      currency: currency(),
      current,
      previous,
      change: { incomeBps: changeBps(previous.incomeMinor, current.incomeMinor), expenseBps: changeBps(previous.expenseMinor, current.expenseMinor), netMinor: current.netMinor - previous.netMinor },
      categories,
    });
  }],
  ['GET', /^\/reports\/trend$/, (_b, q) => {
    const input = parseWith(trendQuery, q);
    if (input instanceof Reply) return input;
    const months = monthsBetween(input.from, input.to);
    const rows = state.txs.filter((t) => months.includes(monthOf(t.date)));
    const totals = totalsFor(rows);
    return new Reply(200, {
      from: input.from,
      to: input.to,
      currency: currency(),
      series: buildMonthlySeries(months, rows.map((t) => ({ month: monthOf(t.date), type: t.type, totalMinor: t.amountMinor }))),
      totals,
      averageMonthlyExpenseMinor: Math.round(totals.expenseMinor / months.length),
    });
  }],
  ['GET', /^\/exports\/transactions\.csv$/, () => fail(501, 'PREVIEW', 'CSV downloads need the full app. This preview cannot save files.')],
];

/** Installs the preview API by wrapping fetch for /api/v1 requests only. */
export function installPreviewApi(): void {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    const marker = url.pathname.indexOf('/api/v1');
    if (marker === -1) return realFetch(input, init);
    const path = url.pathname.slice(marker + '/api/v1'.length);
    const method = (init?.method ?? 'GET').toUpperCase();
    const query = Object.fromEntries(url.searchParams.entries());
    let body: Record<string, unknown> = {};
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }
    await new Promise((r) => setTimeout(r, 120));
    let reply: Reply = fail(404, 'NOT_FOUND', 'Endpoint not found');
    for (const [m, pattern, handler] of routes) {
      const match = m === method ? pattern.exec(path) : null;
      if (match) {
        const needsUser = !path.startsWith('/auth/');
        reply = needsUser && !state.user ? fail(401, 'UNAUTHENTICATED', 'Sign in to continue') : handler(body, query, match[1] ?? '');
        break;
      }
    }
    return reply.status === 204
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  };
}
