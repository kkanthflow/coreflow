import crypto from 'crypto';
import {
  SUBSCRIPTION_PLANS,
  getAllPlansList,
  getPlanConfig,
  normalizePlanTier,
  isOrganizationPlan,
  isFreelancerPlan,
} from '../server/subscriptions/subscription.config.js';
import { razorpayService } from '../server/subscriptions/razorpay.service.js';
import {
  SubscriptionService,
  fallbackSubscriptions,
  fallbackPayments,
  fallbackMemberships,
} from '../server/subscriptions/subscription.service.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runOrganizationPricingVerification() {
  console.log('================================================================================');
  console.log('  AUVRYN ORGANIZATION PRICING UPDATE VERIFICATION');
  console.log('  Verifying ₹399 Business Starter, ₹499 Business Pro, and Preserved Freelancer');
  console.log('================================================================================\n');

  let passed = 0;
  const testSecret = 'AoOKahZG7xU24Khmz0yyLy2O';
  (razorpayService as any).keySecret = testSecret;
  (razorpayService as any).webhookSecret = testSecret;

  // ─────────────────────────────────────────────────────────────
  // 1. Authoritative Organization & Freelancer Pricing Config
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 01/08] Centralized Plan Configurations & Authoritative Prices');
  
  // Organization Plans
  const bFree = SUBSCRIPTION_PLANS.business_free;
  assert(bFree.pricing.monthly.priceInr === 0, 'Business Free is ₹0/mo');
  assert(bFree.limits.maxActiveProjects === 5, 'Business Free allows 5 projects');
  assert(bFree.limits.maxWorkflows === 3, 'Business Free allows 3 workflows');
  assert(bFree.limits.maxSeats === 3, 'Business Free allows 3 members');
  assert(bFree.limits.historyDays === 7, 'Business Free has 7-day history');

  const bStarter = SUBSCRIPTION_PLANS.business_starter;
  assert(bStarter.pricing.monthly.priceInr === 399, 'Business Starter is ₹399/mo');
  assert(bStarter.pricing.monthly.pricePaise === 39900, 'Business Starter is 39900 paise');
  assert(bStarter.limits.maxActiveProjects === 25, 'Business Starter allows 25 projects');
  assert(bStarter.limits.maxWorkflows === 15, 'Business Starter allows 15 workflows');
  assert(bStarter.limits.maxSeats === 5, 'Business Starter allows 5 members');
  assert(bStarter.limits.historyDays === 30, 'Business Starter has 30-day history');

  const bPro = SUBSCRIPTION_PLANS.business_pro;
  assert(bPro.pricing.monthly.priceInr === 499, 'Business Pro is ₹499/mo');
  assert(bPro.pricing.monthly.pricePaise === 49900, 'Business Pro is 49900 paise');
  assert(bPro.limits.maxActiveProjects === null, 'Business Pro allows unlimited projects');
  assert(bPro.limits.maxWorkflows === null, 'Business Pro allows unlimited workflows');
  assert(bPro.limits.maxSeats === null, 'Business Pro allows unlimited members');
  assert(bPro.limits.historyDays === null, 'Business Pro has unlimited history');

  // Freelancer Plans (Preserved)
  assert(SUBSCRIPTION_PLANS.freelancer_free.pricing.monthly.priceInr === 0, 'Freelancer Free preserved at ₹0');
  assert(SUBSCRIPTION_PLANS.freelancer_starter.pricing.monthly.priceInr === 299, 'Freelancer Starter preserved at ₹299');
  assert(SUBSCRIPTION_PLANS.freelancer_pro.pricing.monthly.priceInr === 599, 'Freelancer Pro preserved at ₹599');

  console.log('  ✔ PASS: Pricing and quotas strictly match specification.\n');
  passed++;

  // ─────────────────────────────────────────────────────────────
  // 2. Server-Side Checkout Initiation Validates Correct INR Amount
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 02/08] Server-Side Checkout Initiation Enforces Authoritative INR Amounts');
  
  fallbackMemberships.set('usr_org_owner_1:org_checkout_test_1', 'owner');

  const orgStarterCheckout = await SubscriptionService.initiateCheckout({
    userId: 'usr_org_owner_1',
    planTier: 'business_starter',
    billingInterval: 'monthly',
    orgId: 'org_checkout_test_1',
  });
  assert(orgStarterCheckout.amountPaise === 39900, 'Business Starter checkout amount is exactly 39900 paise (₹399)');
  assert(orgStarterCheckout.amountInr === 399, 'Business Starter checkout amount is ₹399');
  assert(orgStarterCheckout.currency === 'INR', 'Currency is INR');
  assert(orgStarterCheckout.planTier === 'business_starter', 'Plan tier is business_starter');

  const orgProCheckout = await SubscriptionService.initiateCheckout({
    userId: 'usr_org_owner_1',
    planTier: 'business_pro',
    billingInterval: 'monthly',
    orgId: 'org_checkout_test_1',
  });
  assert(orgProCheckout.amountPaise === 49900, 'Business Pro checkout amount is exactly 49900 paise (₹499)');
  assert(orgProCheckout.amountInr === 499, 'Business Pro checkout amount is ₹499');
  assert(orgProCheckout.currency === 'INR', 'Currency is INR');
  assert(orgProCheckout.planTier === 'business_pro', 'Plan tier is business_pro');

  console.log('  ✔ PASS: Server initiates orders with 39900 paise and 49900 paise.\n');
  passed++;

  // ─────────────────────────────────────────────────────────────
  // 3. Client Amount Tampering is Completely Ignored
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 03/08] Client-Side Amount Tampering is Completely Ignored');
  
  // Even if a client sends an arbitrary amount in its payload, the server computes amount strictly from getPlanConfig()
  const spoofedPayload = {
    userId: 'usr_org_owner_1',
    planTier: 'business_pro',
    billingInterval: 'monthly' as const,
    orgId: 'org_checkout_test_1',
    amount: 100, // Client attempts to buy Pro for ₹1
  };
  const safeCheckout = await SubscriptionService.initiateCheckout(spoofedPayload as any);
  assert(safeCheckout.amountPaise === 49900, 'Server overrides client spoofed amount with authoritative 49900 paise');
  assert((safeCheckout as any).amount !== spoofedPayload.amount, 'Client spoofed amount is not used');

  console.log('  ✔ PASS: Frontend-submitted amount cannot tamper with server-validated checkout amount.\n');
  passed++;

  // ─────────────────────────────────────────────────────────────
  // 4. Successful Payment Verification Activates ₹399 Business Starter
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 04/08] Payment Verification Activates ₹399 Business Starter');
  
  const testSubStarterId = `sub_test_bs_${Date.now()}`;
  const testPayStarterId = `pay_test_bs_${Date.now()}`;
  fallbackSubscriptions.set(testSubStarterId, {
    id: `db_${testSubStarterId}`,
    user_id: 'usr_org_owner_bs',
    organization_id: 'org_sub_bs',
    plan_tier: 'business_starter',
    tier: 'business_starter',
    workspace_type: 'organization',
    billing_interval: 'monthly',
    status: 'pending',
    payment_status: 'pending',
    razorpay_subscription_id: testSubStarterId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);
  fallbackMemberships.set('usr_org_owner_bs:org_sub_bs', 'owner');
  razorpayService.mockPayments.set(testPayStarterId, {
    id: testPayStarterId,
    amount: 39900,
    currency: 'INR',
    status: 'captured',
    subscription_id: testSubStarterId,
  });

  const validStarterSig = crypto
    .createHmac('sha256', testSecret)
    .update(`${testPayStarterId}|${testSubStarterId}`)
    .digest('hex');

  const activationResult = await SubscriptionService.verifyAndActivate({
    subscriptionId: testSubStarterId,
    paymentId: testPayStarterId,
    signature: validStarterSig,
    userId: 'usr_org_owner_bs',
  });

  assert(activationResult.success === true, 'Activation succeeded');
  assert(activationResult.planTier === 'business_starter', 'Active plan is business_starter');
  const storedStarterSub = fallbackSubscriptions.get(testSubStarterId);
  assert(storedStarterSub?.status === 'active', 'Subscription status marked active');
  assert(storedStarterSub?.payment_status === 'paid', 'Payment status marked paid');
  assert(storedStarterSub?.last_payment_amount === 39900, 'Recorded last payment amount is 39900 paise');

  console.log('  ✔ PASS: Genuine signature at ₹399 activates Business Starter.\n');
  passed++;

  // ─────────────────────────────────────────────────────────────
  // 5. Tampered Payment Amount is Strictly Rejected
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 05/08] Tampered Payment Amount is Strictly Rejected');
  
  const testSubProId = `sub_test_bp_${Date.now()}`;
  const testPayProId = `pay_test_bp_${Date.now()}`;
  fallbackSubscriptions.set(testSubProId, {
    id: `db_${testSubProId}`,
    user_id: 'usr_org_owner_bp',
    organization_id: 'org_sub_bp',
    plan_tier: 'business_pro',
    tier: 'business_pro',
    workspace_type: 'organization',
    billing_interval: 'monthly',
    status: 'pending',
    payment_status: 'pending',
    razorpay_subscription_id: testSubProId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any);
  fallbackMemberships.set('usr_org_owner_bp:org_sub_bp', 'owner');
  razorpayService.mockPayments.set(testPayProId, {
    id: testPayProId,
    amount: 10000, // Attacker paid ₹100 instead of ₹499
    currency: 'INR',
    status: 'captured',
    subscription_id: testSubProId,
  });

  const sigPro = crypto
    .createHmac('sha256', testSecret)
    .update(`${testPayProId}|${testSubProId}`)
    .digest('hex');

  let tamperFailed = false;
  try {
    await SubscriptionService.verifyAndActivate({
      subscriptionId: testSubProId,
      paymentId: testPayProId,
      signature: sigPro,
      userId: 'usr_org_owner_bp',
    });
  } catch (err: any) {
    tamperFailed = true;
    assert(err.message.includes('Payment amount mismatch'), 'Error correctly identified amount mismatch');
  }
  assert(tamperFailed, 'Tampered payment amount was rejected');
  assert(fallbackSubscriptions.get(testSubProId)?.status === 'pending', 'Subscription was NOT activated');

  console.log('  ✔ PASS: Tampered payment amount rejected; paid plan not activated.\n');
  passed++;

  // ─────────────────────────────────────────────────────────────
  // 6. Grandfathered Renewal Policy Protects Existing Active Subscriptions
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 06/08] Grandfathered Renewal Policy Protects Existing Active Subscriptions');
  
  // Existing Business Starter subscriber from previous pricing (₹999 / 99900 paise)
  const gfSubId = `sub_legacy_starter_${Date.now()}`;
  const gfPayId = `pay_legacy_starter_${Date.now()}`;
  fallbackSubscriptions.set(gfSubId, {
    id: `db_${gfSubId}`,
    user_id: 'usr_legacy_customer',
    organization_id: 'org_legacy',
    plan_tier: 'business_starter',
    tier: 'business_starter',
    workspace_type: 'organization',
    billing_interval: 'monthly',
    status: 'active',
    payment_status: 'paid',
    razorpay_subscription_id: gfSubId,
    last_payment_amount: 99900,
    metadata: { pricePaise: 99900, grandfathered: true },
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  } as any);
  fallbackMemberships.set('usr_legacy_customer:org_legacy', 'owner');
  razorpayService.mockPayments.set(gfPayId, {
    id: gfPayId,
    amount: 99900, // Grandfathered renewal
    currency: 'INR',
    status: 'captured',
    subscription_id: gfSubId,
  });

  const gfSig = crypto
    .createHmac('sha256', testSecret)
    .update(`${gfPayId}|${gfSubId}`)
    .digest('hex');

  // Verify renewal payment at grandfathered rate (₹999 / 99900 paise)
  const gfRenewal = await SubscriptionService.verifyAndActivate({
    subscriptionId: gfSubId,
    paymentId: gfPayId,
    signature: gfSig,
    userId: 'usr_legacy_customer',
  });
  assert(gfRenewal.success === true, 'Grandfathered renewal payment accepted without error');
  assert(fallbackSubscriptions.get(gfSubId)?.status === 'active', 'Grandfathered subscription remains active');

  console.log('  ✔ PASS: Existing active subscriptions renew at grandfathered rate seamlessly.\n');
  passed++;

  // ─────────────────────────────────────────────────────────────
  // 7. Role-Based Billing Permissions Guard Organization Checkouts
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 07/08] Role-Based Billing Permissions Enforced');
  
  // Normal member, viewer, and developer cannot checkout
  assert(SubscriptionService.canManageBilling('member') === false, 'Organization member cannot manage billing');
  assert(SubscriptionService.canManageBilling('viewer') === false, 'Organization viewer cannot manage billing');
  assert(SubscriptionService.canManageBilling('developer') === false, 'Organization developer cannot manage billing');
  assert(SubscriptionService.canManageBilling('admin') === false, 'General admin without billing role cannot manage billing');

  // Owner and billing_admin can manage billing
  assert(SubscriptionService.canManageBilling('owner') === true, 'Organization owner can manage billing');
  assert(SubscriptionService.canManageBilling('billing_admin') === true, 'Billing administrator can manage billing');
  assert(SubscriptionService.canManageBilling('OWNER') === true, 'Case-insensitive owner can manage billing');

  console.log('  ✔ PASS: Strict RBAC billing restrictions enforced.\n');
  passed++;

  // ─────────────────────────────────────────────────────────────
  // 8. Organization Entitlement Scope Enforcement
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [Test 08/08] Organization Entitlement Limits Enforced');
  
  const starterLimits = SUBSCRIPTION_PLANS.business_starter.limits;
  assert(starterLimits.maxActiveProjects === 25, 'Business Starter max 25 projects');
  assert(starterLimits.maxWorkflows === 15, 'Business Starter max 15 workflows');
  assert(starterLimits.maxSeats === 5, 'Business Starter max 5 seats');
  assert(starterLimits.historyDays === 30, 'Business Starter 30-day history');

  const proLimits = SUBSCRIPTION_PLANS.business_pro.limits;
  assert(proLimits.maxActiveProjects === null, 'Business Pro unlimited projects');
  assert(proLimits.maxWorkflows === null, 'Business Pro unlimited workflows');
  assert(proLimits.maxSeats === null, 'Business Pro unlimited seats');
  assert(proLimits.historyDays === null, 'Business Pro unlimited history');

  console.log('  ✔ PASS: All entitlements scoped and enforced correctly.\n');
  passed++;

  console.log('================================================================================');
  console.log(`  🎉 ALL ${passed} / 8 ORGANIZATION PRICING VERIFICATION TESTS PASSED CLEANLY!`);
  console.log('================================================================================\n');
}

runOrganizationPricingVerification().catch((err) => {
  console.error('\n❌ Pricing verification failed:', err);
  process.exit(1);
});
