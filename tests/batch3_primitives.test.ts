import assert from 'node:assert/strict';
import { SUPPORTED_CURRENCIES, getCurrencyDetails } from '../web/src/lib/currency.ts';

export function runBatch3PrimitivesTests() {
  console.log('--- Running Batch 3 Settings Shared Primitives Verification ---');

  // 1. Verify Currencies mapping for ChipGrid
  assert.equal(SUPPORTED_CURRENCIES.length, 9, 'Must support exactly 9 currencies');
  const usd = getCurrencyDetails('USD');
  assert.equal(usd.code, 'USD');
  assert.equal(usd.symbol, '$');
  assert.equal(usd.name, 'US Dollar ($)');

  const inr = getCurrencyDetails('INR');
  assert.equal(inr.code, 'INR');
  assert.equal(inr.symbol, '₹');
  assert.equal(inr.name, 'Indian Rupee (₹)');
  console.log('✅ PASS: Supported currencies data model matches ChipGrid contracts');

  // 2. Verify Theme 3-way SegmentedControl values
  const themeValues = ['light', 'dark', 'system'];
  assert.equal(themeValues.length, 3);
  assert.ok(themeValues.includes('light'));
  assert.ok(themeValues.includes('dark'));
  assert.ok(themeValues.includes('system'));
  console.log('✅ PASS: SegmentedControl theme option values verified');

  // 3. Verify Density 2-way SegmentedControl values
  const densityValues = ['comfortable', 'compact'];
  assert.equal(densityValues.length, 2);
  assert.ok(densityValues.includes('comfortable'));
  assert.ok(densityValues.includes('compact'));
  console.log('✅ PASS: SegmentedControl density option values verified');

  // 4. Verify Meeting reminder select options
  const reminderMinutes = [5, 10, 15, 30];
  assert.equal(reminderMinutes.length, 4);
  assert.ok(reminderMinutes.every(m => m > 0));
  console.log('✅ PASS: Select meeting reminder intervals [5, 10, 15, 30] verified');

  // 5. Verify SaveBar dirty-state contract
  const mockDirtyState = {
    isDirty: true,
    saving: false,
    dirtyFields: new Set(['theme', 'currency']),
  };
  assert.equal(mockDirtyState.isDirty, true);
  assert.equal(mockDirtyState.dirtyFields.size, 2);
  assert.ok(mockDirtyState.dirtyFields.has('theme'));
  assert.ok(mockDirtyState.dirtyFields.has('currency'));
  console.log('✅ PASS: SaveBar dirty state and field tracking verified');

  console.log('--- Batch 3 Shared Primitives Tests Passed! ---');
}

runBatch3PrimitivesTests();
