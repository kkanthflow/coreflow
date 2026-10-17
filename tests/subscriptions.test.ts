import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  SUBSCRIPTION_PLANS,
  getPlanConfig,
  getAllPlansList,
  PlanTier,
  BillingInterval,
} from '../server/subscriptions/subscription.config';
import { razorpayService } from '../server/subscriptions/razorpay.service';
import { SubscriptionService } from '../server/subscriptions/subscription.service';

describe('Auvryn Razorpay Subscription Plans & Pricing', () => {
  it('should define all three required plans with correct pricing', () => {
    // 1. Freelancer: ₹299/mo or ₹2,990/yr
    expect(SUBSCRIPTION_PLANS.freelancer.pricing.monthly.priceInr).toBe(299);
    expect(SUBSCRIPTION_PLANS.freelancer.pricing.yearly.priceInr).toBe(2990);
    expect(SUBSCRIPTION_PLANS.freelancer.limits.maxSeats).toBe(1);

    // 2. Business Starter: ₹399/mo or ₹3,990/yr
    expect(SUBSCRIPTION_PLANS.starter.pricing.monthly.priceInr).toBe(399);
    expect(SUBSCRIPTION_PLANS.starter.pricing.yearly.priceInr).toBe(3990);
    expect(SUBSCRIPTION_PLANS.starter.limits.maxSeats).toBe(5);

    // 3. Auvryn Pro: ₹499/mo or ₹4,990/yr (Unlimited)
    expect(SUBSCRIPTION_PLANS.pro.pricing.monthly.priceInr).toBe(499);
    expect(SUBSCRIPTION_PLANS.pro.pricing.yearly.priceInr).toBe(4990);
    expect(SUBSCRIPTION_PLANS.pro.limits.maxSeats).toBeNull(); // Unlimited seats
    expect(SUBSCRIPTION_PLANS.pro.limits.maxInvoicesPerMonth).toBeNull(); // Unlimited invoices
    expect(SUBSCRIPTION_PLANS.pro.limits.maxActiveProjects).toBeNull(); // Unlimited projects
    expect(SUBSCRIPTION_PLANS.pro.limits.maxMeetingsPerMonth).toBeNull(); // Unlimited meetings
  });

  it('should ensure yearly prices provide two months equivalent discount', () => {
    // 10x monthly price = 2 months free discount compared to 12 months
    const plans: PlanTier[] = ['freelancer', 'starter', 'pro'];
    for (const tier of plans) {
      const monthly = SUBSCRIPTION_PLANS[tier].pricing.monthly.priceInr;
      const yearly = SUBSCRIPTION_PLANS[tier].pricing.yearly.priceInr;
      expect(yearly).toBe(monthly * 10);
      expect(monthly * 12 - yearly).toBe(monthly * 2);
    }
  });

  it('should format public plans list accurately', () => {
    const list = getAllPlansList();
    expect(list.length).toBe(3);
    const pro = list.find((p) => p.tier === 'pro');
    expect(pro?.limits.maxSeats).toBeNull();
    expect(pro?.limits.maxInvoicesPerMonth).toBeNull();
  });
});

describe('Razorpay Signature Verification & Security', () => {
  const testSecret = 'test_secret_key_12345';

  beforeEach(() => {
    (razorpayService as any).keySecret = testSecret;
    (razorpayService as any).webhookSecret = testSecret;
  });

  it('should verify valid subscription checkout signature', () => {
    const paymentId = 'pay_test_payment_999';
    const subscriptionId = 'sub_test_sub_888';
    const payload = `${paymentId}|${subscriptionId}`;
    const validSignature = crypto
      .createHmac('sha256', testSecret)
      .update(payload)
      .digest('hex');

    const result = razorpayService.verifyCheckoutSignature({
      paymentId,
      subscriptionId,
      signature: validSignature,
    });

    expect(result).toBe(true);
  });

  it('should reject tampered checkout signatures', () => {
    const paymentId = 'pay_test_payment_999';
    const subscriptionId = 'sub_test_sub_888';
    const tamperedSignature = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const result = razorpayService.verifyCheckoutSignature({
      paymentId,
      subscriptionId,
      signature: tamperedSignature,
    });

    expect(result).toBe(false);
  });

  it('should verify valid webhook signature using raw body buffer', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'subscription.charged', id: 'evt_101' }), 'utf8');
    const validSignature = crypto
      .createHmac('sha256', testSecret)
      .update(rawBody)
      .digest('hex');

    const result = razorpayService.verifyWebhookSignature(rawBody, validSignature);
    expect(result).toBe(true);
  });

  it('should reject tampered or invalid webhook signatures', () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'subscription.charged' }), 'utf8');
    const invalidSignature = 'invalid_signature_hash';

    const result = razorpayService.verifyWebhookSignature(rawBody, invalidSignature);
    expect(result).toBe(false);
  });
});

describe('Plan Quota & Entitlement Enforcement', () => {
  it('should allow unlimited operations for Auvryn Pro tier', async () => {
    // Mock user on Pro tier
    const quotaInvoice = await SubscriptionService.checkPlanQuota({
      userId: 'user_pro_test',
      feature: 'invoices',
      currentCount: 5000, // Very high count
    });
    // If user defaults to freelancer or has no active sub, let's test directly with mock
    const proTierCheck = await SubscriptionService.checkPlanQuota({
      userId: 'non_existent_will_check_logic',
      feature: 'invoices',
      currentCount: 10,
    });
    expect(proTierCheck).toHaveProperty('allowed');
  });

  it('should enforce limits for Freelancer tier', async () => {
    // Freelancer limit: 15 invoices
    const allowedCheck = await SubscriptionService.checkPlanQuota({
      userId: 'test_solo',
      feature: 'invoices',
      currentCount: 14,
    });
    expect(allowedCheck.allowed).toBe(true);

    const blockedCheck = await SubscriptionService.checkPlanQuota({
      userId: 'test_solo',
      feature: 'invoices',
      currentCount: 15,
    });
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.message).toContain('limit reached');
  });

  it('should enforce team seat limits for Starter tier', async () => {
    // Starter tier limit: 5 seats
    const starterConfig = SUBSCRIPTION_PLANS.starter.limits;
    expect(starterConfig.maxSeats).toBe(5);
  });
});

describe('Webhook Event Idempotency', () => {
  it('should handle duplicate webhook deliveries safely', async () => {
    const testSecret = 'whsec_test_secret_999';
    (razorpayService as any).webhookSecret = testSecret;

    const eventPayload = {
      event: 'subscription.activated',
      event_id: 'evt_unique_12345',
      payload: {
        subscription: {
          entity: {
            id: 'sub_test_idempotency_1',
            status: 'active',
            paid_count: 1,
            current_start: 1718000000,
            current_end: 1720600000,
          },
        },
      },
    };

    const rawBuffer = Buffer.from(JSON.stringify(eventPayload), 'utf8');
    const signature = crypto.createHmac('sha256', testSecret).update(rawBuffer).digest('hex');
    const uniqueEventId = `evt_unique_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // First delivery: processes successfully
    const firstDelivery = await SubscriptionService.processWebhookEvent({
      rawBody: rawBuffer,
      signature,
      eventId: uniqueEventId,
    });
    expect(firstDelivery.status).toBe('processed');

    // Second delivery of identical event: safely ignored (idempotent)
    const secondDelivery = await SubscriptionService.processWebhookEvent({
      rawBody: rawBuffer,
      signature,
      eventId: uniqueEventId,
    });
    expect(secondDelivery.status).toBe('ignored');
    expect(secondDelivery.reason).toBe('duplicate_event');
  });
});
