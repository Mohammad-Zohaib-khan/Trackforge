import { describe, expect, it } from 'vitest';
import { formatBps, formatDate, formatMoney, moneyParts } from './format';

describe('formatMoney', () => {
  const usd = { currency: 'USD' as const, locale: 'en-US' };
  it('formats minor units with a true minus sign and optional plus', () => {
    expect(formatMoney(125050, usd)).toBe('$1,250.50');
    expect(formatMoney(-500, usd)).toBe('−$5.00');
    expect(formatMoney(500, usd, { sign: 'always' })).toBe('+$5.00');
    expect(formatMoney(0, usd, { sign: 'always' })).toBe('$0.00');
  });
  it('respects locale and zero-decimal currencies', () => {
    expect(formatMoney(12345678, { currency: 'INR', locale: 'en-IN' })).toBe('₹1,23,456.78');
    expect(formatMoney(5000, { currency: 'JPY', locale: 'ja-JP' })).toMatch(/5,000/);
  });
  it('splits parts for the display figure', () => {
    expect(moneyParts(315926, usd)).toEqual({ symbol: '$', whole: '3,159', fraction: '.26', negative: false });
  });
});

describe('formatDate', () => {
  it('never shifts the calendar day across time zones', () => {
    expect(formatDate('2026-01-01', { locale: 'en-US', dateStyle: 'medium' })).toBe('Jan 1, 2026');
    expect(formatDate('2026-01-01', { locale: 'en-US', dateStyle: 'iso' })).toBe('2026-01-01');
  });
});

describe('formatBps', () => {
  it('formats basis points as percentages', () => {
    expect(formatBps(5778)).toBe('57.8%');
    expect(formatBps(-1250, { sign: true })).toBe('−12.5%');
    expect(formatBps(1251, { sign: true })).toBe('+12.5%');
    expect(formatBps(null)).toBe('—');
  });
});
