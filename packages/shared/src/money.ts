/**
 * Money is stored and aggregated as integer minor units (e.g. cents).
 * Amounts arrive from clients as decimal strings ("1234.56") and are parsed
 * without ever passing through floating point, so totals stay exact.
 */

export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'INR',
  'JPY',
  'CAD',
  'AUD',
  'SGD',
  'AED',
  'CHF',
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const MINOR_DIGITS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  JPY: 0,
  CAD: 2,
  AUD: 2,
  SGD: 2,
  AED: 2,
  CHF: 2,
};

/** Largest single amount accepted: 1 billion major units. Keeps every aggregate far below 2^53. */
export const MAX_AMOUNT_MAJOR = 1_000_000_000;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function minorDigits(currency: CurrencyCode): number {
  return MINOR_DIGITS[currency];
}

const AMOUNT_PATTERN = /^(\d{1,10})(?:\.(\d+))?$/;

export type ParseAmountResult =
  | { ok: true; minor: number }
  | { ok: false; reason: 'format' | 'precision' | 'range' };

/**
 * Parses a positive decimal amount string into integer minor units.
 * Rejects negative numbers, exponents, thousands separators, too many decimals and zero.
 */
export function parseAmountToMinor(input: string, currency: CurrencyCode): ParseAmountResult {
  const trimmed = input.trim();
  const match = AMOUNT_PATTERN.exec(trimmed);
  if (!match) return { ok: false, reason: 'format' };
  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '';
  const digits = minorDigits(currency);
  if (fraction.length > digits) return { ok: false, reason: 'precision' };
  const wholeNumber = Number(whole);
  if (wholeNumber > MAX_AMOUNT_MAJOR) return { ok: false, reason: 'range' };
  const minor = wholeNumber * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
  if (minor <= 0) return { ok: false, reason: 'range' };
  if (wholeNumber === MAX_AMOUNT_MAJOR && minor > MAX_AMOUNT_MAJOR * 10 ** digits) {
    return { ok: false, reason: 'range' };
  }
  return { ok: true, minor };
}

/** Converts integer minor units back to a plain decimal string ("1234.50"). Exact. */
export function minorToDecimalString(minor: number, currency: CurrencyCode): string {
  const digits = minorDigits(currency);
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor)).toString();
  if (digits === 0) return `${negative ? '-' : ''}${abs}`;
  const padded = abs.padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Major-unit number for display formatting only (Intl). Never use for arithmetic. */
export function minorToMajorForDisplay(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** minorDigits(currency);
}
