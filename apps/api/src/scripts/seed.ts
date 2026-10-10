/**
 * Idempotent demo seed. Creates (or resets) ONE demo account filled with
 * clearly fictional data. Running it twice produces the same state.
 *
 *   npm run seed
 *
 * Every merchant, amount and note below is invented for demonstration only.
 */
import '../config/loadDotenv.js';
import { addMonths, monthBounds, todayInTimeZone, type CurrencyCode } from '@trackforge/shared';
import { loadConfig } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../db.js';
import { User } from '../models/user.js';
import { Category } from '../models/category.js';
import { Transaction } from '../models/transaction.js';
import { Budget } from '../models/budget.js';
import { hashPassword } from '../services/passwords.js';
import { createStarterCategories } from '../services/defaultCategories.js';

const DEMO_EMAIL = 'demo@trackforge.example';
const DEMO_NAME = 'Demo Account (fictional data)';
const CURRENCY: CurrencyCode = 'USD';
const MONTHS_OF_HISTORY = 12;

/** Small deterministic PRNG so the seed is reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Recipe {
  category: string;
  merchants: string[];
  perMonth: [number, number];
  amount: [number, number];
  method: 'debit_card' | 'credit_card' | 'upi' | 'bank_transfer' | 'cash' | 'wallet';
  recurring?: boolean;
  fixedDay?: number;
}

const EXPENSES: Recipe[] = [
  { category: 'Housing', merchants: ['Maple Court Rentals (demo)'], perMonth: [1, 1], amount: [1450, 1450], method: 'bank_transfer', recurring: true, fixedDay: 3 },
  { category: 'Utilities', merchants: ['City Power & Water (demo)', 'Fibrelink Internet (demo)'], perMonth: [2, 2], amount: [38, 96], method: 'debit_card', recurring: true },
  { category: 'Groceries', merchants: ['Green Basket Market (demo)', 'Harvest Lane Grocers (demo)', 'Corner Pantry (demo)'], perMonth: [5, 8], amount: [18, 115], method: 'debit_card' },
  { category: 'Dining', merchants: ['Harbor Grill (demo)', 'Little Lantern Noodles (demo)', 'Morning Ritual Café (demo)'], perMonth: [3, 7], amount: [9, 72], method: 'credit_card' },
  { category: 'Transport', merchants: ['Metro Transit Card (demo)', 'QuickRide (demo)', 'Fuel Stop (demo)'], perMonth: [3, 6], amount: [6, 58], method: 'upi' },
  { category: 'Subscriptions', merchants: ['StreamCo (demo)', 'CloudNotes Pro (demo)'], perMonth: [2, 2], amount: [6, 16], method: 'credit_card', recurring: true },
  { category: 'Health', merchants: ['Riverside Pharmacy (demo)', 'Pulse Fitness Club (demo)'], perMonth: [0, 2], amount: [12, 65], method: 'debit_card' },
  { category: 'Entertainment', merchants: ['Grand Cinema (demo)', 'Vinyl Corner (demo)'], perMonth: [0, 3], amount: [12, 48], method: 'credit_card' },
  { category: 'Shopping', merchants: ['Thread & Co (demo)', 'Gadget Depot (demo)'], perMonth: [0, 2], amount: [25, 180], method: 'credit_card' },
];

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)] as T;
}

function between(rand: () => number, [min, max]: [number, number]): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function cents(rand: () => number, [min, max]: [number, number]): number {
  if (min === max) return min * 100;
  return Math.round((min + rand() * (max - min)) * 100);
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.isProduction && process.env['ALLOW_SEED_IN_PRODUCTION'] !== 'true') {
    throw new Error('Refusing to seed demo data in production. Set ALLOW_SEED_IN_PRODUCTION=true only for a demo deployment.');
  }
  const password = process.env['SEED_DEMO_PASSWORD'] ?? 'demo-password-2026';
  await connectDatabase(config.mongoUri, config.mongoMaxPoolSize);

  const passwordHash = await hashPassword(password);
  let user = await User.findOne({ email: DEMO_EMAIL });
  if (user) {
    await Promise.all([
      Transaction.deleteMany({ ownerId: user._id }),
      Budget.deleteMany({ ownerId: user._id }),
      Category.deleteMany({ ownerId: user._id }),
    ]);
    user.name = DEMO_NAME;
    user.passwordHash = passwordHash;
    user.status = 'active';
    user.preferences.currency = CURRENCY;
    await user.save();
  } else {
    user = await User.create({
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      passwordHash,
      preferences: { currency: CURRENCY, locale: 'en-US', timeZone: 'UTC', dateStyle: 'medium' },
    });
  }
  await createStarterCategories(user._id);
  const categories = await Category.find({ ownerId: user._id }).lean();
  const idOf = (name: string) => {
    const found = categories.find((c) => c.name === name);
    if (!found) throw new Error(`Missing starter category ${name}`);
    return found._id;
  };

  const rand = mulberry32(20_260_101);
  const today = todayInTimeZone('UTC');
  const currentMonth = today.slice(0, 7);
  const docs: Array<Record<string, unknown>> = [];

  for (let offset = MONTHS_OF_HISTORY - 1; offset >= 0; offset -= 1) {
    const month = addMonths(currentMonth, -offset);
    const { to } = monthBounds(month);
    const lastDay = Number((month === currentMonth ? today : to).slice(8, 10));
    // Spread days across the elapsed part of the month (the current month is only partly over).
    const day = (d: number) => `${month}-${String(((Math.max(d, 1) - 1) % lastDay) + 1).padStart(2, '0')}`;

    docs.push({ type: 'income', categoryId: idOf('Salary'), amountMinor: 520_000, date: day(1), paymentMethod: 'bank_transfer', merchant: 'Northwind Studio (demo employer)', recurring: true, note: 'Fictional demo salary' });
    if (rand() < 0.55) {
      docs.push({ type: 'income', categoryId: idOf('Freelance'), amountMinor: cents(rand, [180, 950]), date: day(between(rand, [8, 26])), paymentMethod: 'bank_transfer', merchant: pick(rand, ['Blue Finch Agency (demo)', 'Atlas Print Co. (demo)']), recurring: false, note: '' });
    }
    if (offset % 3 === 0) {
      docs.push({ type: 'income', categoryId: idOf('Investments'), amountMinor: cents(rand, [40, 140]), date: day(28), paymentMethod: 'bank_transfer', merchant: 'Index Fund Dividend (demo)', recurring: false, note: '' });
    }

    for (const recipe of EXPENSES) {
      const count = between(rand, recipe.perMonth);
      for (let i = 0; i < count; i += 1) {
        docs.push({
          type: 'expense',
          categoryId: idOf(recipe.category),
          amountMinor: cents(rand, recipe.amount),
          date: day(recipe.fixedDay ?? between(rand, [1, 28])),
          paymentMethod: recipe.method,
          merchant: recipe.merchants[i % recipe.merchants.length] ?? pick(rand, recipe.merchants),
          recurring: recipe.recurring ?? false,
          note: '',
        });
      }
    }
    if (offset === 4) {
      docs.push({ type: 'expense', categoryId: idOf('Travel'), amountMinor: 68_420, date: day(14), paymentMethod: 'credit_card', merchant: 'Skyway Air (demo)', recurring: false, note: 'Fictional weekend trip' });
    }
  }

  const ownerId = user._id;
  for (const doc of docs) {
    await Transaction.create({ ...doc, ownerId, currency: CURRENCY });
  }

  const budgetPlan: Array<[string, number, number]> = [
    ['Groceries', 52_000, 80],
    ['Dining', 25_000, 75],
    ['Transport', 18_000, 80],
    ['Entertainment', 9_000, 80],
    ['Shopping', 15_000, 85],
    ['Subscriptions', 3_500, 90],
  ];
  for (const month of [addMonths(currentMonth, -1), currentMonth]) {
    for (const [name, amountMinor, warningThresholdPct] of budgetPlan) {
      await Budget.create({ ownerId, categoryId: idOf(name), month, amountMinor, warningThresholdPct });
    }
  }

  console.log(`Seeded fictional demo account ${DEMO_EMAIL} with ${docs.length} transactions.`);
  console.log(process.env['SEED_DEMO_PASSWORD'] ? 'Password: value of SEED_DEMO_PASSWORD' : 'Password: demo-password-2026 (local development only)');
  await disconnectDatabase();
}

main().catch(async (err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
