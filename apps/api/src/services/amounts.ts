import { parseAmountToMinor, type CurrencyCode } from '@trackforge/shared';
import { badRequest } from '../utils/httpError.js';

/** Parses a decimal amount string into integer minor units or throws a field-level 400. */
export function amountOrThrow(value: string, currency: CurrencyCode, field = 'amount'): number {
  const result = parseAmountToMinor(value, currency);
  if (result.ok) return result.minor;
  const message =
    result.reason === 'precision'
      ? `${currency} amounts allow at most ${currency === 'JPY' ? 'no' : 'two'} decimal places`
      : result.reason === 'range'
        ? 'Enter an amount greater than zero and below one billion'
        : 'Enter an amount like 1250 or 1250.50';
  throw badRequest('VALIDATION_ERROR', 'Some fields need attention', { [field]: message });
}
