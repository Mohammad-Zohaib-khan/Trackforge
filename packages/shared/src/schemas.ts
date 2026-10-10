import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from './money.js';
import { inclusiveDayCount, isIsoDate, isIsoMonth, isValidTimeZone, monthsBetween } from './dates.js';

/* ---------- primitives ---------- */

export const TRANSACTION_TYPES = ['income', 'expense'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = [
  'cash',
  'debit_card',
  'credit_card',
  'bank_transfer',
  'upi',
  'wallet',
  'cheque',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CATEGORY_ICONS = [
  'wallet',
  'briefcase',
  'gift',
  'trending-up',
  'coins',
  'home',
  'shopping-cart',
  'utensils',
  'car',
  'bolt',
  'heart-pulse',
  'film',
  'plane',
  'graduation-cap',
  'shirt',
  'smartphone',
  'repeat',
  'piggy-bank',
  'receipt',
  'paw-print',
  'dumbbell',
  'baby',
  'wrench',
  'landmark',
  'tag',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const LOCALES = ['en-US', 'en-GB', 'en-IN', 'de-DE', 'fr-FR', 'es-ES', 'ja-JP'] as const;
export type Locale = (typeof LOCALES)[number];

export const DATE_STYLES = ['medium', 'short', 'iso'] as const;
export type DateStyle = (typeof DATE_STYLES)[number];

/** Longest window any aggregate or export may cover. */
export const MAX_RANGE_DAYS = 1096;
export const MAX_TREND_MONTHS = 24;
export const MAX_PAGE_SIZE = 100;
export const MAX_EXPORT_ROWS = 10_000;

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const isoDate = z.string().refine(isIsoDate, 'Use a valid date (YYYY-MM-DD)');
export const isoMonth = z.string().refine(isIsoMonth, 'Use a valid month (YYYY-MM)');
export const currencyCode = z.enum(SUPPORTED_CURRENCIES);
export const amountString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 1250 or 1250.50');

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address'));

export const passwordPolicy = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use 128 characters or fewer')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');

/* ---------- auth & account ---------- */

export const registerSchema = z.strictObject({
  name: trimmed(1, 80, 'Name'),
  email,
  password: passwordPolicy,
  currency: currencyCode.default('USD'),
  timeZone: z.string().max(64).refine(isValidTimeZone, 'Unknown time zone').optional(),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const updateProfileSchema = z.strictObject({
  name: trimmed(1, 80, 'Name'),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const updatePreferencesSchema = z
  .strictObject({
    currency: currencyCode.optional(),
    locale: z.enum(LOCALES).optional(),
    timeZone: z.string().max(64).refine(isValidTimeZone, 'Unknown time zone').optional(),
    dateStyle: z.enum(DATE_STYLES).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update');
export type UpdatePreferencesInput = z.input<typeof updatePreferencesSchema>;

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordPolicy,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'Choose a password you have not used here',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1, 'Password is required').max(128),
});

/* ---------- categories ---------- */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #94FFD1');

export const createCategorySchema = z.strictObject({
  name: trimmed(1, 40, 'Name'),
  type: z.enum(TRANSACTION_TYPES),
  icon: z.enum(CATEGORY_ICONS).default('tag'),
  color: hexColor.optional(),
});
export type CreateCategoryInput = z.input<typeof createCategorySchema>;

export const updateCategorySchema = z
  .strictObject({
    name: trimmed(1, 40, 'Name').optional(),
    icon: z.enum(CATEGORY_ICONS).optional(),
    color: hexColor.nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update');
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;

export const listCategoriesQuery = z.strictObject({
  type: z.enum(TRANSACTION_TYPES).optional(),
  includeArchived: z.enum(['true', 'false']).default('false'),
});

/* ---------- transactions ---------- */

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional();

export const createTransactionSchema = z.strictObject({
  type: z.enum(TRANSACTION_TYPES),
  amount: amountString,
  categoryId: objectId,
  date: isoDate,
  paymentMethod: z.enum(PAYMENT_METHODS),
  merchant: optionalText(80, 'Merchant / payee'),
  note: optionalText(500, 'Note'),
  recurring: z.boolean().default(false),
});
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .strictObject({
    type: z.enum(TRANSACTION_TYPES).optional(),
    amount: amountString.optional(),
    categoryId: objectId.optional(),
    date: isoDate.optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    merchant: optionalText(80, 'Merchant / payee'),
    note: optionalText(500, 'Note'),
    recurring: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update');
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;

export const TRANSACTION_SORT_FIELDS = ['date', 'amount', 'merchant', 'createdAt'] as const;

const dateRangeRefinement = <T extends { from?: string | undefined; to?: string | undefined }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  if (value.from && value.to) {
    if (value.from > value.to) {
      ctx.addIssue({ code: 'custom', message: 'Start date must be on or before end date', path: ['from'] });
    } else if (inclusiveDayCount(value.from, value.to) > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: 'custom', message: `Choose a range of ${MAX_RANGE_DAYS} days or fewer`, path: ['to'] });
    }
  }
};

export const listTransactionsQuery = z
  .strictObject({
    q: z.string().trim().max(80).optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    categoryId: objectId.optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    recurring: z.enum(['true', 'false']).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    minAmount: amountString.optional(),
    maxAmount: amountString.optional(),
    sort: z.enum(TRANSACTION_SORT_FIELDS).default('date'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  })
  .superRefine(dateRangeRefinement);
export type ListTransactionsQuery = z.output<typeof listTransactionsQuery>;

/* ---------- budgets ---------- */

export const createBudgetSchema = z.strictObject({
  categoryId: objectId,
  month: isoMonth,
  amount: amountString,
  warningThresholdPct: z.number().int().min(50).max(100).default(80),
});
export type CreateBudgetInput = z.input<typeof createBudgetSchema>;

export const updateBudgetSchema = z
  .strictObject({
    amount: amountString.optional(),
    warningThresholdPct: z.number().int().min(50).max(100).optional(),
  })
  .refine((v) => v.amount !== undefined || v.warningThresholdPct !== undefined, 'Nothing to update');
export type UpdateBudgetInput = z.input<typeof updateBudgetSchema>;

export const listBudgetsQuery = z.strictObject({ month: isoMonth });

export const copyBudgetsSchema = z
  .strictObject({ fromMonth: isoMonth, toMonth: isoMonth })
  .refine((v) => v.fromMonth !== v.toMonth, { message: 'Choose two different months', path: ['toMonth'] });

/* ---------- dashboard, reports, export ---------- */

export const dateRangeQuery = z
  .strictObject({ from: isoDate, to: isoDate })
  .superRefine(dateRangeRefinement);
export type DateRangeQuery = z.output<typeof dateRangeQuery>;

export const trendQuery = z
  .strictObject({ from: isoMonth, to: isoMonth })
  .superRefine((v, ctx) => {
    if (v.from > v.to) {
      ctx.addIssue({ code: 'custom', message: 'Start month must be on or before end month', path: ['from'] });
    } else if (monthsBetween(v.from, v.to).length > MAX_TREND_MONTHS) {
      ctx.addIssue({ code: 'custom', message: `Choose ${MAX_TREND_MONTHS} months or fewer`, path: ['to'] });
    }
  });

export const comparisonQuery = z.strictObject({ month: isoMonth });

export const exportQuery = z
  .strictObject({
    from: isoDate,
    to: isoDate,
    type: z.enum(TRANSACTION_TYPES).optional(),
    categoryId: objectId.optional(),
  })
  .superRefine(dateRangeRefinement);
export type ExportQuery = z.output<typeof exportQuery>;
