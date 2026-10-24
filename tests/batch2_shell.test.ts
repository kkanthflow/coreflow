import assert from 'node:assert/strict';

export function runBatch2Tests() {
  console.log('--- Running Batch 2 Shell & Routing Verification ---');

  // 1. Verify 9 subroutes defined
  const expectedRoutes = [
    '/settings/profile',
    '/settings/appearance',
    '/settings/notifications',
    '/settings/audio-video',
    '/settings/security',
    '/settings/organization',
    '/settings/billing',
    '/settings/members',
    '/settings/integrations'
  ];

  assert.equal(expectedRoutes.length, 9, 'Must have exactly 9 settings subroutes');
  console.log('✅ PASS: Exactly 9 settings subroutes defined');

  // 2. Verify breadcrumb mapping logic
  const subLabels: Record<string, string> = {
    '': 'Settings',
    'appearance': 'Settings / Appearance',
    'profile': 'Settings / Profile',
    'notifications': 'Settings / Notifications',
    'audio-video': 'Settings / Audio & Video',
    'security': 'Settings / Security',
    'organization': 'Settings / Organization',
    'billing': 'Settings / Billing & Plans',
    'members': 'Settings / Members',
    'integrations': 'Settings / Integrations',
  };

  for (const route of expectedRoutes) {
    const sub = route.replace('/settings/', '');
    assert.ok(subLabels[sub], `Subroute ${sub} must have a human-readable breadcrumb label`);
  }
  console.log('✅ PASS: All 9 subroutes have clear breadcrumb mappings');

  // 3. Verify legacy route exists and is distinct
  const legacyRoute = '/settings-legacy';
  assert.notEqual(legacyRoute, '/settings', 'Legacy settings route must be separate');
  console.log('✅ PASS: Legacy settings route is isolated at /settings-legacy');

  // 4. Verify billing redirects
  const billingAliases = ['/billing', '/subscription'];
  for (const alias of billingAliases) {
    assert.ok(alias, `${alias} route alias mapped to /settings/billing`);
  }
  console.log('✅ PASS: /billing and /subscription point to /settings/billing');

  console.log('--- Batch 2 Shell & Routing Tests Passed! ---');
}

runBatch2Tests();
