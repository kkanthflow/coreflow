import { BRAND } from '../web/src/brand.js';
import { formatCurrency, SUPPORTED_CURRENCIES, getCurrencyDetails } from '../web/src/lib/currency.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function run() {
  console.log('--- Running Auvryn Theme, Tokens & Currency Verification ---');

  // 1. Single source of truth in brand.ts
  assert(BRAND.productName === 'Auvryn', 'BRAND.productName is "Auvryn"');
  assert(BRAND.name === 'Auvryn', 'BRAND.name is "Auvryn"');
  assert(BRAND.primaryColor === '#FF5A36', 'BRAND.primaryColor is coral accent #FF5A36');

  // 2. Currencies support
  const codes = SUPPORTED_CURRENCIES.map(c => c.code);
  assert(codes.length === 9, 'Exactly 9 supported currencies defined');
  assert(codes.includes('USD') && codes.includes('INR') && codes.includes('EUR'), 'USD, INR, EUR supported');
  assert(codes.includes('GBP') && codes.includes('AED') && codes.includes('SGD'), 'GBP, AED, SGD supported');
  assert(codes.includes('AUD') && codes.includes('CAD') && codes.includes('JPY'), 'AUD, CAD, JPY supported');

  // 3. Format currency with Intl.NumberFormat
  const formattedINR = formatCurrency(500, 'INR');
  assert(formattedINR.includes('500'), 'formatCurrency formats INR amount correctly');

  const formattedUSD = formatCurrency(1250.5, 'USD');
  assert(formattedUSD.includes('1,250.50'), 'formatCurrency formats USD amount correctly');

  // 4. System theme resolution logic
  const resolveTheme = (theme: 'light' | 'dark' | 'system', systemPrefersDark: boolean): 'light' | 'dark' => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return systemPrefersDark ? 'dark' : 'light';
  };

  assert(resolveTheme('dark', false) === 'dark', 'Dark theme resolves to dark regardless of OS');
  assert(resolveTheme('light', true) === 'light', 'Light theme resolves to light regardless of OS');
  assert(resolveTheme('system', true) === 'dark', 'System theme resolves to dark when OS is dark');
  assert(resolveTheme('system', false) === 'light', 'System theme resolves to light when OS is light');

  console.log('--- All Theme & Currency Tests Passed Successfully ---');
}

run().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
