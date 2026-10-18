import crypto from 'crypto';
import {
  SUBSCRIPTION_PLANS,
  getPlanConfig,
  getAllPlansList,
} from '../server/subscriptions/subscription.config.js';
import { razorpayService } from '../server/subscriptions/razorpay.service.js';
import { SubscriptionService } from '../server/subscriptions/subscription.service.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function run() {
  console.log('--- Testing Auvryn Subscription Plans & Quotas ---');
  // 1. Freelancer: ₹299/mo
  assert(SUBSCRIPTION_PLANS.freelancer_starter.pricing.monthly.priceInr === 299, 'Freelancer starter is 299');
  assert(SUBSCRIPTION_PLANS.freelancer_starter.limits.maxSeats === 1, 'Freelancer starter maxSeats is 1');

  // 2. Business Starter: ₹999/mo
  assert(SUBSCRIPTION_PLANS.business_starter.pricing.monthly.priceInr === 999, 'Business starter is 999');
  assert(SUBSCRIPTION_PLANS.business_starter.limits.maxSeats === 5, 'Business starter maxSeats is 5');

  // 3. Business Pro: ₹2,499/mo
  assert(SUBSCRIPTION_PLANS.business_pro.pricing.monthly.priceInr === 2499, 'Business pro is 2499');
  assert(SUBSCRIPTION_PLANS.business_pro.limits.maxSeats === null, 'Business pro maxSeats is null');
  assert(SUBSCRIPTION_PLANS.business_pro.limits.maxActiveProjects === null, 'Business pro projects is null');

  // 4. Razorpay Signature Verification
  const testSecret = 'test_secret_key_12345';
  (razorpayService as any).keySecret = testSecret;
  (razorpayService as any).webhookSecret = testSecret;

  const paymentId = 'pay_test_payment_999';
  const subscriptionId = 'sub_test_sub_888';
  const validSignature = crypto.createHmac('sha256', testSecret).update(`${paymentId}|${subscriptionId}`).digest('hex');

  assert(
    razorpayService.verifyCheckoutSignature({ paymentId, subscriptionId, signature: validSignature }) === true,
    'Valid checkout signature verified'
  );

  assert(
    razorpayService.verifyCheckoutSignature({ paymentId, subscriptionId, signature: 'bad_signature' }) === false,
    'Bad signature rejected'
  );

  // 5. Quota Checks
  const soloQuota = await SubscriptionService.checkPlanQuota({
    userId: 'solo_test_user',
    feature: 'invoices',
    currentCount: 14,
  });
  assert(soloQuota.allowed === true, 'Under limit invoice is allowed');

  const soloBlocked = await SubscriptionService.checkPlanQuota({
    userId: 'solo_test_user',
    feature: 'invoices',
    currentCount: 15,
  });
  assert(soloBlocked.allowed === false, 'At limit invoice is blocked');

  console.log('--- All Subscriptions & Quotas Tests Passed! ---');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
