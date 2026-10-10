import { addMonths, monthBounds, todayInTimeZone } from '@trackforge/shared';

export type PeriodKey = 'this_month' | 'last_month' | 'last_3_months' | 'year_to_date' | 'last_12_months' | 'custom';

export interface Period {
  key: PeriodKey;
  from: string;
  to: string;
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  year_to_date: 'Year to date',
  last_12_months: 'Last 12 months',
  custom: 'Custom range',
};

/** Resolves a named period against "today" in the user's own time zone. */
export function resolvePeriod(key: Exclude<PeriodKey, 'custom'>, timeZone: string, now = new Date()): Period {
  const today = todayInTimeZone(timeZone, now);
  const month = today.slice(0, 7);
  switch (key) {
    case 'this_month':
      return { key, from: monthBounds(month).from, to: monthBounds(month).to };
    case 'last_month': {
      const prev = addMonths(month, -1);
      return { key, ...monthBounds(prev) };
    }
    case 'last_3_months':
      return { key, from: monthBounds(addMonths(month, -2)).from, to: monthBounds(month).to };
    case 'year_to_date':
      return { key, from: `${month.slice(0, 4)}-01-01`, to: monthBounds(month).to };
    case 'last_12_months':
      return { key, from: monthBounds(addMonths(month, -11)).from, to: monthBounds(month).to };
  }
}

export function currentMonth(timeZone: string): string {
  return todayInTimeZone(timeZone).slice(0, 7);
}

export function today(timeZone: string): string {
  return todayInTimeZone(timeZone);
}
