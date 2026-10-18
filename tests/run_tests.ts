import crypto from 'crypto';
import {
  SUBSCRIPTION_PLANS,
  getPlanConfig,
  getAllPlansList,
  PlanTier,
} from '../server/subscriptions/subscription.config';
import { razorpayService } from '../server/subscriptions/razorpay.service';
import { SubscriptionService } from '../server/subscriptions/subscription.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAllTests() {
  console.log('🧪 Starting Auvryn Razorpay Subscription Test Suite...\n');

  // Test 1: Plans and Pricing configuration
  console.log('Test 1: Plan prices and configuration verification...');
  assert(SUBSCRIPTION_PLANS.freelancer_starter.pricing.monthly.priceInr === 299, 'Freelancer starter monthly should be ₹299');
  assert(SUBSCRIPTION_PLANS.freelancer_pro.pricing.monthly.priceInr === 599, 'Freelancer pro monthly should be ₹599');
  assert(SUBSCRIPTION_PLANS.business_starter.pricing.monthly.priceInr === 999, 'Business Starter monthly should be ₹999');
  assert(SUBSCRIPTION_PLANS.business_pro.pricing.monthly.priceInr === 2499, 'Business Pro monthly should be ₹2,499');
  console.log('✓ Authoritative monthly plan pricing verified successfully.');

  // Test 2: Uncapped Pro entitlements
  console.log('\nTest 2: Pro entitlements are uncapped...');
  assert(SUBSCRIPTION_PLANS.pro.limits.maxSeats === null, 'Pro seats must be unlimited (null)');
  assert(SUBSCRIPTION_PLANS.pro.limits.maxInvoicesPerMonth === null, 'Pro invoices must be unlimited (null)');
  assert(SUBSCRIPTION_PLANS.pro.limits.maxActiveProjects === null, 'Pro active projects must be unlimited (null)');
  assert(SUBSCRIPTION_PLANS.pro.limits.maxMeetingsPerMonth === null, 'Pro meetings must be unlimited (null)');
  assert(SUBSCRIPTION_PLANS.pro.limits.analyticsTier === 'unlimited', 'Pro analytics must be unlimited');
  console.log('✓ Pro uncapped entitlements verified.');

  // Test 3: Freelancer & Starter limits
  console.log('\nTest 3: Enforcing Freelancer and Starter quotas...');
  assert(SUBSCRIPTION_PLANS.freelancer_free.limits.maxSeats === 1, 'Freelancer Free must allow 1 seat');
  assert(SUBSCRIPTION_PLANS.freelancer_free.limits.maxInvoicesPerMonth === 15, 'Freelancer Free must allow 15 invoices/mo');
  assert(SUBSCRIPTION_PLANS.business_starter.limits.maxSeats === 5, 'Business Starter must allow 5 seats');
  assert(SUBSCRIPTION_PLANS.business_starter.limits.maxWorkflows === 15, 'Business Starter must allow 15 workflows');
  console.log('✓ Quota limits verified.');

  // Test 4: Checkout Signature Verification
  console.log('\nTest 4: Razorpay checkout HMAC-SHA256 signature verification...');
  const testSecret = 'auvryn_test_secret_2026';
  (razorpayService as any).keySecret = testSecret;
  (razorpayService as any).webhookSecret = testSecret;

  const paymentId = 'pay_test_payment_123';
  const subscriptionId = 'sub_test_sub_456';
  const expectedSignature = crypto
    .createHmac('sha256', testSecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');

  const validResult = razorpayService.verifyCheckoutSignature({
    paymentId,
    subscriptionId,
    signature: expectedSignature,
  });
  assert(validResult === true, 'Valid checkout signature should pass verification');

  const invalidResult = razorpayService.verifyCheckoutSignature({
    paymentId,
    subscriptionId,
    signature: 'bad_signature_hash_xyz',
  });
  assert(invalidResult === false, 'Tampered checkout signature must fail verification');
  console.log('✓ Checkout signature verification correctly enforces HMAC-SHA256.');

  // Test 5: Webhook Signature Verification
  console.log('\nTest 5: Razorpay webhook raw-body signature verification...');
  const webhookBody = Buffer.from(JSON.stringify({ event: 'subscription.charged', id: 'evt_test_001' }), 'utf8');
  const validWebhookSig = crypto
    .createHmac('sha256', testSecret)
    .update(webhookBody)
    .digest('hex');

  const webhookVerifyOk = razorpayService.verifyWebhookSignature(webhookBody, validWebhookSig);
  assert(webhookVerifyOk === true, 'Valid raw body webhook signature must pass');

  const webhookVerifyFail = razorpayService.verifyWebhookSignature(webhookBody, 'invalid_webhook_sig');
  assert(webhookVerifyFail === false, 'Tampered webhook signature must fail');
  console.log('✓ Webhook raw-body signature verification passed.');

  // Test 6: Webhook Idempotency
  console.log('\nTest 6: Webhook duplicate delivery idempotency...');
  const testEventId = `evt_idem_${Date.now()}`;
  const eventPayload = {
    event: 'subscription.activated',
    event_id: testEventId,
    payload: {
      subscription: {
        entity: {
          id: `sub_test_idem_${Date.now()}`,
          status: 'active',
          paid_count: 1,
          current_start: 1718000000,
          current_end: 1720600000,
        },
      },
    },
  };
  const rawEvtBuffer = Buffer.from(JSON.stringify(eventPayload), 'utf8');
  const evtSig = crypto.createHmac('sha256', testSecret).update(rawEvtBuffer).digest('hex');

  const firstCall = await SubscriptionService.processWebhookEvent({
    rawBody: rawEvtBuffer,
    signature: evtSig,
    eventId: testEventId,
  });
  assert(firstCall.status === 'processed', 'First webhook delivery should be processed');

  const secondCall = await SubscriptionService.processWebhookEvent({
    rawBody: rawEvtBuffer,
    signature: evtSig,
    eventId: testEventId,
  });
  assert(secondCall.status === 'ignored', 'Duplicate webhook delivery must be ignored');
  assert(secondCall.reason === 'duplicate_event', 'Duplicate reason must be recorded');
  console.log('✓ Webhook duplicate idempotency verified.');

  // Test 7: Quota checker function
  console.log('\nTest 7: Quota checker function...');
  const quotaUnder = await SubscriptionService.checkPlanQuota({
    userId: 'user_solo_1',
    feature: 'invoices',
    currentCount: 10,
  });
  assert(quotaUnder.allowed === true, 'Count under quota should be allowed');

  const quotaExceeded = await SubscriptionService.checkPlanQuota({
    userId: 'user_solo_1',
    feature: 'invoices',
    currentCount: 15,
  });
  assert(quotaExceeded.allowed === false, 'Count reaching quota should be blocked');
  console.log('✓ Plan quota checking passed.');

  // Test 8: Webhook lifecycle events (subscription.charged, subscription.halted, subscription.cancelled)
  // Test 8: Webhook lifecycle events (subscription.charged, subscription.halted, subscription.cancelled)
  console.log('\nTest 8: Webhook lifecycle events and access status sync...');
  const subIdTest = `sub_test_charged_${Date.now()}`;
  // 8a. subscription.charged
  const chargedEvtId = `evt_charged_${Date.now()}`;
  const chargedPayload = {
    event: 'subscription.charged',
    event_id: chargedEvtId,
    payload: {
      subscription: {
        entity: {
          id: subIdTest,
          status: 'active',
          paid_count: 2,
          current_start: 1718000000,
          current_end: 1720600000,
          notes: {
            userId: 'user_webhook_test_1',
            tier: 'pro',
            interval: 'monthly',
          },
        },
      },
      payment: {
        entity: {
          id: `pay_test_charged_${Date.now()}`,
          amount: 49900,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
        },
      },
    },
  };
  const rawCharged = Buffer.from(JSON.stringify(chargedPayload), 'utf8');
  const chargedSig = crypto.createHmac('sha256', testSecret).update(rawCharged).digest('hex');

  const chargedRes = await SubscriptionService.processWebhookEvent({
    rawBody: rawCharged,
    signature: chargedSig,
    eventId: chargedEvtId,
  });
  assert(chargedRes.status === 'processed', 'subscription.charged event should be processed');
  const chargedSub = await (SubscriptionService as any).getSubscriptionByRzpId(subIdTest);
  assert(chargedSub?.status === 'active', 'Charged subscription status should be active');
  console.log('✓ subscription.charged processed successfully.');

  // 8b. subscription.halted
  const haltedEvtId = `evt_halted_${Date.now()}`;
  const haltedPayload = {
    event: 'subscription.halted',
    event_id: haltedEvtId,
    payload: {
      subscription: {
        entity: {
          id: subIdTest,
          status: 'halted',
        },
      },
    },
  };
  const rawHalted = Buffer.from(JSON.stringify(haltedPayload), 'utf8');
  const haltedSig = crypto.createHmac('sha256', testSecret).update(rawHalted).digest('hex');

  const haltedRes = await SubscriptionService.processWebhookEvent({
    rawBody: rawHalted,
    signature: haltedSig,
    eventId: haltedEvtId,
  });
  assert(haltedRes.status === 'processed', 'subscription.halted event should be processed');
  const haltedSub = await (SubscriptionService as any).getSubscriptionByRzpId(subIdTest);
  assert(haltedSub?.status === 'halted', 'Halted subscription status should be halted');
  console.log('✓ subscription.halted processed successfully.');

  // 8c. subscription.cancelled
  const cancelledEvtId = `evt_cancelled_${Date.now()}`;
  const cancelledPayload = {
    event: 'subscription.cancelled',
    event_id: cancelledEvtId,
    payload: {
      subscription: {
        entity: {
          id: subIdTest,
          status: 'cancelled',
          ended_at: 1720600000,
        },
      },
    },
  };
  const rawCancelled = Buffer.from(JSON.stringify(cancelledPayload), 'utf8');
  const cancelledSig = crypto.createHmac('sha256', testSecret).update(rawCancelled).digest('hex');

  const cancelledRes = await SubscriptionService.processWebhookEvent({
    rawBody: rawCancelled,
    signature: cancelledSig,
    eventId: cancelledEvtId,
  });
  assert(cancelledRes.status === 'processed', 'subscription.cancelled event should be processed');
  const cancelledSub = await (SubscriptionService as any).getSubscriptionByRzpId(subIdTest);
  assert(cancelledSub?.status === 'cancelled', 'Cancelled subscription status should be cancelled');
  console.log('✓ subscription.cancelled processed successfully.');

  console.log('\n🎉 ALL 8 TEST SUITES PASSED CLEANLY!\n');
}

runAllTests().catch((e) => {
  console.error('\n❌ Test suite failed:', e);
  process.exit(1);
});
