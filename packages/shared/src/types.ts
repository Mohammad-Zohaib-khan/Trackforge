import type { CurrencyCode } from './money.js';
import type { BudgetStatus, MonthlyPoint, Totals } from './finance.js';
import type { CategoryIcon, DateStyle, Locale, PaymentMethod, TransactionType } from './schemas.js';

/** Response shapes returned by /api/v1. Money is always integer minor units. */

export interface UserPreferences {
  currency: CurrencyCode;
  locale: Locale;
  timeZone: string;
  dateStyle: DateStyle;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  preferences: UserPreferences;
  createdAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  type: TransactionType;
  icon: CategoryIcon;
  color: string | null;
  archived: boolean;
  isDefault: boolean;
}

export interface TransactionDto {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currency: CurrencyCode;
  date: string;
  paymentMethod: PaymentMethod;
  merchant: string;
  note: string;
  recurring: boolean;
  category: Pick<CategoryDto, 'id' | 'name' | 'icon' | 'color'> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BudgetDto {
  id: string;
  month: string;
  category: Pick<CategoryDto, 'id' | 'name' | 'icon' | 'color' | 'archived'>;
  limitMinor: number;
  warningThresholdPct: number;
  spentMinor: number;
  remainingMinor: number;
  usedBps: number;
  status: BudgetStatus;
}

export interface BudgetMonthDto {
  month: string;
  currency: CurrencyCode;
  budgets: BudgetDto[];
  totals: { limitMinor: number; spentMinor: number; remainingMinor: number };
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  icon: CategoryIcon;
  color: string | null;
  totalMinor: number;
  count: number;
  /** Share of the type's total in basis points. */
  shareBps: number;
}

export interface DashboardDto {
  range: { from: string; to: string };
  currency: CurrencyCode;
  totals: Totals;
  trend: MonthlyPoint[];
  expenseByCategory: CategorySlice[];
  recent: TransactionDto[];
  budgetAlerts: BudgetDto[];
  budgetMonth: string;
}

export interface ComparisonRow {
  categoryId: string | null;
  name: string;
  icon: CategoryIcon;
  type: TransactionType;
  currentMinor: number;
  previousMinor: number;
  changeBps: number | null;
}

export interface ComparisonDto {
  month: string;
  previousMonth: string;
  currency: CurrencyCode;
  current: Totals;
  previous: Totals;
  change: {
    incomeBps: number | null;
    expenseBps: number | null;
    netMinor: number;
  };
  categories: ComparisonRow[];
}

export interface TrendDto {
  from: string;
  to: string;
  currency: CurrencyCode;
  series: MonthlyPoint[];
  totals: Totals;
  averageMonthlyExpenseMinor: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
