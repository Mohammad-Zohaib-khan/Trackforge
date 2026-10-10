/**
 * Transactions carry a calendar date ("YYYY-MM-DD") rather than an instant.
 * A personal ledger entry happens on a day in the user's own calendar, so we
 * never convert it across timezones. Months are "YYYY-MM" strings derived
 * from that date, which makes monthly reports independent of server timezone.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = DATE_PATTERN.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isIsoMonth(value: string): boolean {
  const m = MONTH_PATTERN.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return year >= 1970 && year <= 2100 && month >= 1 && month <= 12;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

function splitMonth(month: string): [number, number] {
  const [y, m] = month.split('-');
  return [Number(y), Number(m)];
}

/** First and last calendar day of a "YYYY-MM" month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, m] = splitMonth(month);
  const last = daysInMonth(year, m);
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function addMonths(month: string, delta: number): string {
  const [year, m] = splitMonth(month);
  const index = year * 12 + (m - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

/** Inclusive list of months between two "YYYY-MM" values. */
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const result: string[] = [];
  let cursor = fromMonth;
  while (cursor <= toMonth) {
    result.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return result;
}

/** Whole days from `from` to `to` inclusive (2024-01-01 → 2024-01-01 is 1). */
export function inclusiveDayCount(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Today's calendar date in the given IANA timezone (falls back to UTC). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
