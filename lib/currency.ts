export interface CurrencyOption {
  code: string;
  symbol: string;
  locale: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar ($)' },
  { code: 'INR', symbol: '₹', locale: 'en-IN', name: 'Indian Rupee (₹)' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound (£)' },
  { code: 'AED', symbol: 'د.إ', locale: 'ar-AE', name: 'UAE Dirham (AED)' },
  { code: 'SGD', symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar (S$)' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AUD', name: 'Australian Dollar (A$)' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar (C$)' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen (¥)' },
];

export function getCurrencyDetails(code: string = 'USD'): CurrencyOption {
  const cleanCode = (code || 'USD').toUpperCase();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === cleanCode) || {
      code: cleanCode,
      symbol: cleanCode,
      locale: 'en-US',
      name: cleanCode,
    }
  );
}

export function formatCurrency(amount: number, code: string = 'USD', includeCode = false): string {
  const num = Number(amount) || 0;
  const details = getCurrencyDetails(code);
  try {
    const formatted = new Intl.NumberFormat(details.locale, {
      style: 'currency',
      currency: details.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    return includeCode ? `${formatted} (${details.code})` : formatted;
  } catch (e) {
    // Fallback if Intl is not supported or throws
    return `${details.symbol}${num.toFixed(2)}`;
  }
}
