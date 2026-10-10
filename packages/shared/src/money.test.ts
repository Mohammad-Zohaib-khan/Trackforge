import { describe, expect, it } from 'vitest';
import { minorToDecimalString, parseAmountToMinor } from './money.js';

describe('parseAmountToMinor', () => {
  it('parses whole and fractional amounts exactly', () => {
    expect(parseAmountToMinor('1250', 'USD')).toEqual({ ok: true, minor: 125000 });
    expect(parseAmountToMinor('0.10', 'USD')).toEqual({ ok: true, minor: 10 });
    expect(parseAmountToMinor('0.1', 'USD')).toEqual({ ok: true, minor: 10 });
    expect(parseAmountToMinor('19.99', 'INR')).toEqual({ ok: true, minor: 1999 });
    expect(parseAmountToMinor(' 7 ', 'EUR')).toEqual({ ok: true, minor: 700 });
  });

  it('avoids floating point drift (0.29 * 100 is 28.999… in floats)', () => {
    expect(parseAmountToMinor('0.29', 'USD')).toEqual({ ok: true, minor: 29 });
    expect(parseAmountToMinor('1.15', 'USD')).toEqual({ ok: true, minor: 115 });
  });

  it('respects currencies without minor units', () => {
    expect(parseAmountToMinor('500', 'JPY')).toEqual({ ok: true, minor: 500 });
    expect(parseAmountToMinor('500.5', 'JPY')).toEqual({ ok: false, reason: 'precision' });
  });

  it('rejects malformed, negative, zero and oversized input', () => {
    for (const bad of ['', '-5', '1e3', '1,000', 'abc', '1.', '.5', '0x10']) {
      expect(parseAmountToMinor(bad, 'USD').ok).toBe(false);
    }
    expect(parseAmountToMinor('0', 'USD')).toEqual({ ok: false, reason: 'range' });
    expect(parseAmountToMinor('0.00', 'USD')).toEqual({ ok: false, reason: 'range' });
    expect(parseAmountToMinor('1.234', 'USD')).toEqual({ ok: false, reason: 'precision' });
    expect(parseAmountToMinor('1000000001', 'USD')).toEqual({ ok: false, reason: 'range' });
    expect(parseAmountToMinor('1000000000.01', 'USD')).toEqual({ ok: false, reason: 'range' });
    expect(parseAmountToMinor('1000000000', 'USD').ok).toBe(true);
  });
});

describe('minorToDecimalString', () => {
  it('round-trips minor units to decimal strings', () => {
    expect(minorToDecimalString(125050, 'USD')).toBe('1250.50');
    expect(minorToDecimalString(5, 'USD')).toBe('0.05');
    expect(minorToDecimalString(-5, 'USD')).toBe('-0.05');
    expect(minorToDecimalString(500, 'JPY')).toBe('500');
  });
});
