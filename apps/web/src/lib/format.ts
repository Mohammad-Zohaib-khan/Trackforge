import { minorToMajorForDisplay, type CurrencyCode, type DateStyle } from '@trackforge/shared';

export interface FormatPrefs {
  currency: CurrencyCode;
  locale: string;
  dateStyle: DateStyle;
}

const currencyCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: string, currency: CurrencyCode, compact: boolean): Intl.NumberFormat {
  const key = `${locale}|${currency}|${compact}`;
  let f = currencyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
    });
    currencyCache.set(key, f);
  }
  return f;
}

/** Formats integer minor units. `sign: 'always'` prefixes + or − (a true minus sign). */
export function formatMoney(
  minor: number,
  prefs: Pick<FormatPrefs, 'currency' | 'locale'>,
  options: { sign?: 'auto' | 'always' | 'never'; compact?: boolean } = {},
): string {
  const sign = options.sign ?? 'auto';
  const formatted = currencyFormatter(prefs.locale, prefs.currency, options.compact ?? false).format(
    Math.abs(minorToMajorForDisplay(minor, prefs.currency)),
  );
  if (sign === 'never' || minor === 0) return formatted;
  if (minor < 0) return `−${formatted}`;
  return sign === 'always' ? `+${formatted}` : formatted;
}

/** Splits a formatted amount so the currency symbol and decimals can be styled separately. */
export function moneyParts(minor: number, prefs: Pick<FormatPrefs, 'currency' | 'locale'>): { symbol: string; whole: string; fraction: string; negative: boolean } {
  const parts = currencyFormatter(prefs.locale, prefs.currency, false).formatToParts(
    Math.abs(minorToMajorForDisplay(minor, prefs.currency)),
  );
  let symbol = '';
  let whole = '';
  let fraction = '';
  let inFraction = false;
  for (const p of parts) {
    if (p.type === 'currency') symbol = p.value;
    else if (p.type === 'decimal') {
      inFraction = true;
      fraction += p.value;
    } else if (p.type === 'fraction') fraction += p.value;
    else if (p.type === 'integer' || p.type === 'group') {
      if (!inFraction) whole += p.value;
    }
  }
  return { symbol, whole, fraction, negative: minor < 0 };
}

export function formatDate(isoDate: string, prefs: Pick<FormatPrefs, 'locale' | 'dateStyle'>): string {
  if (prefs.dateStyle === 'iso') return isoDate;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(prefs.locale, {
    timeZone: 'UTC',
    ...(prefs.dateStyle === 'short' ? { day: '2-digit', month: '2-digit', year: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' }),
  }).format(date);
}

export function formatMonth(month: string, locale: string, length: 'long' | 'short' = 'long'): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: length, year: 'numeric' }).format(date);
}

export function formatMonthShort(month: string, locale: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' }).format(date);
}

/** Basis points → "57.8%". */
export function formatBps(bps: number | null, options: { sign?: boolean } = {}): string {
  if (bps === null) return '—';
  const pct = bps / 100;
  const text = `${Math.abs(pct).toFixed(Math.abs(pct) >= 100 ? 0 : 1)}%`;
  if (!options.sign || bps === 0) return bps < 0 ? `−${text}` : text;
  return bps > 0 ? `+${text}` : `−${text}`;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  wallet: 'Wallet',
  cheque: 'Cheque',
  other: 'Other',
};
