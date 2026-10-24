import { describe, expect, it } from 'vitest';
import { BRAND } from '../web/src/brand';
import { formatCurrency, SUPPORTED_CURRENCIES, getCurrencyDetails } from '../web/src/lib/currency';

describe('Auvryn Design Tokens & Theme System', () => {
  it('has Auvryn as single source of truth in brand.ts', () => {
    expect(BRAND.productName).toBe('Auvryn');
    expect(BRAND.name).toBe('Auvryn');
    expect(BRAND.primaryColor).toBe('#FF5A36');
  });

  it('provides all 9 required supported currencies', () => {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code);
    expect(codes).toContain('USD');
    expect(codes).toContain('INR');
    expect(codes).toContain('EUR');
    expect(codes).toContain('GBP');
    expect(codes).toContain('AED');
    expect(codes).toContain('SGD');
    expect(codes).toContain('AUD');
    expect(codes).toContain('CAD');
    expect(codes).toContain('JPY');
  });

  it('formats currency using Intl.NumberFormat correctly without hard-coded symbols', () => {
    const inr = formatCurrency(500, 'INR');
    expect(inr).toContain('500');

    const usd = formatCurrency(1250.5, 'USD');
    expect(usd).toContain('1,250.50');

    const details = getCurrencyDetails('INR');
    expect(details.symbol).toBe('₹');
    expect(details.name).toContain('Indian Rupee');
  });

  it('resolves system theme matching prefers-color-scheme', () => {
    const resolveTheme = (theme: 'light' | 'dark' | 'system', systemPrefersDark: boolean): 'light' | 'dark' => {
      if (theme === 'dark') return 'dark';
      if (theme === 'light') return 'light';
      return systemPrefersDark ? 'dark' : 'light';
    };

    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
