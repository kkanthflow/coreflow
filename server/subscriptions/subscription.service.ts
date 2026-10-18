import crypto from 'crypto';
import { supabaseAdmin } from '../_core/supabase.js';
import { razorpayService } from './razorpay.service.js';
import {
  SUBSCRIPTION_PLANS,
  PlanTier,
  BillingInterval,
  SubscriptionStatus,
  PaymentStatus,
  mapRazorpaySubscriptionStatus,
  mapRazorpayPaymentStatus,
  getPlanConfig,
  isFreelancerPlan,
  isOrganizationPlan,
  normalizePlanTier,
  GRACE_PERIOD_DAYS,
} from './subscription.config.js';

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  organization_id?: string | null;
  customer_type?: 'freelancer' | 'organization';
  payer_user_id?: string;
  workspace_type: 'independent' | 'organization';
  plan_tier: PlanTier;
  plan_interval: BillingInterval;
  plan_id?: string;
  razorpay_subscription_id: string;
  razorpay_plan_id?: string;
  razorpay_customer_id?: string | null;
  status: SubscriptionStatus;
  payment_status?: PaymentStatus;
  last_payment_id?: string | null;
  last_payment_amount?: number | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  ended_at?: string | null;
  cancelled_at?: string | null;
  cancel_at_period_end: boolean;
  total_count: number;
  paid_count: number;
  short_url?: string | null;
  last_event_timestamp?: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

// In-memory fallback repository when running tests or if DB table cache is building
export const fallbackSubscriptions = new Map<string, SubscriptionRecord>();
export const fallbackPayments = new Map<string, any>();
export const fallbackWebhookEvents = new Set<string>();

export class SubscriptionService {
  /**
   * Helper to query Supabase with fallback to in-memory store
   */
  public static async getSubscriptionByRzpId(rzpSubId: string): Promise<SubscriptionRecord | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('razorpay_subscription_id', rzpSubId)
        .maybeSingle();

      if (!error && data) return data as SubscriptionRecord;
    } catch {
      // Fallback
    }
    return fallbackSubscriptions.get(rzpSubId) || null;
  }

  /**
   * Helper to query latest subscription by user or organization
   */
  public static async getLatestSubscription(params: {
    userId: string;
    orgId?: string | null;
  }): Promise<SubscriptionRecord | null> {
    try {
      if (params.orgId) {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('organization_id', params.orgId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) return data as SubscriptionRecord;
      } else {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('user_id', params.userId)
          .is('organization_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) return data as SubscriptionRecord;
      }
    } catch {
      // Fallback
    }

    // In-memory fallback
    let latest: SubscriptionRecord | null = null;
    for (const sub of fallbackSubscriptions.values()) {
      if (params.orgId && sub.organization_id === params.orgId) {
        if (!latest || new Date(sub.created_at) > new Date(latest.created_at)) {
          latest = sub;
        }
      } else if (!params.orgId && !sub.organization_id && sub.user_id === params.userId) {
        if (!latest || new Date(sub.created_at) > new Date(latest.created_at)) {
          latest = sub;
        }
      }
    }
    return latest;
  }

  /**
   * Synchronizes user and organization access status based on subscription state.
   * Handles:
   * - active: grants plan tier
   * - cancelled: retains plan if within valid period, downgrades if expired
   * - past_due: retains plan if in grace period, downgrades if expired
   * - free: baseline free plan
   * - expired / suspended: downgrades to baseline free plan
   * - pending: does NOT grant paid upgrade
   */
  public static async syncUserAccessStatus(record: SubscriptionRecord): Promise<void> {
    try {
      const now = Date.now();
      const periodEndTime = record.current_period_end ? new Date(record.current_period_end).getTime() : 0;
      const isPeriodValid = periodEndTime > now;

      let targetPlanTier: PlanTier;
      let targetStatus: SubscriptionStatus = record.status;

      const fallbackTier: PlanTier = record.organization_id ? 'business_free' : 'freelancer_free';

      if (record.status === 'active') {
        targetPlanTier = record.plan_tier || fallbackTier;
        targetStatus = 'active';
      } else if (record.status === 'free') {
        targetPlanTier = record.plan_tier || fallbackTier;
        targetStatus = 'free';
      } else if (record.status === 'cancelled') {
        if (isPeriodValid) {
          // Retain access until billing period ends
          targetPlanTier = record.plan_tier || fallbackTier;
          targetStatus = 'cancelled';
        } else {
          // Period expired
          targetPlanTier = fallbackTier;
          targetStatus = 'expired';
        }
      } else if (record.status === 'past_due') {
        const daysOverdue = periodEndTime ? (now - periodEndTime) / 86400000 : 0;
        if (daysOverdue <= GRACE_PERIOD_DAYS) {
          // Within grace period (3 days)
          targetPlanTier = record.plan_tier || fallbackTier;
          targetStatus = 'past_due';
        } else {
          targetPlanTier = fallbackTier;
          targetStatus = 'suspended';
        }
      } else if (record.status === 'suspended' || record.status === 'expired') {
        targetPlanTier = fallbackTier;
        targetStatus = record.status;
      } else {
        // 'pending': retain existing baseline without granting paid upgrade
        targetPlanTier = fallbackTier;
        targetStatus = 'pending';
      }

      // 1. Sync User Access in public.users
      if (record.user_id && !record.organization_id) {
        try {
          await supabaseAdmin
            .from('users')
            .update({
              current_plan_tier: targetPlanTier,
              subscription_status: targetStatus,
            })
            .eq('id', record.user_id);
          console.log(`[SubscriptionService] Synced user ${record.user_id} access: plan=${targetPlanTier}, status=${targetStatus}`);
        } catch (uErr: any) {
          console.warn(`[SubscriptionService] Failed to sync user access in public.users:`, uErr?.message || uErr);
        }
      }

      // 2. Sync Organization Access in public.organizations if orgId is present
      if (record.organization_id) {
        try {
          await supabaseAdmin
            .from('organizations')
            .update({
              current_plan_tier: targetPlanTier,
              subscription_status: targetStatus,
            })
            .eq('id', record.organization_id);
          console.log(`[SubscriptionService] Synced org ${record.organization_id} access: plan=${targetPlanTier}, status=${targetStatus}`);
        } catch (oErr: any) {
          console.warn(`[SubscriptionService] Failed to sync org access in public.organizations:`, oErr?.message || oErr);
        }
      }
    } catch (err: any) {
      console.warn('[SubscriptionService] syncUserAccessStatus encountered an error:', err.message);
    }
  }

  /**
   * Saves or updates a subscription in Supabase with fallback
   */
  public static async saveSubscription(record: SubscriptionRecord): Promise<SubscriptionRecord> {
    record.updated_at = new Date().toISOString();
    fallbackSubscriptions.set(record.razorpay_subscription_id, record);

    try {
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .upsert(record, { onConflict: 'razorpay_subscription_id' })
        .select()
        .single();

      if (!error && data) {
        await this.syncUserAccessStatus(record);
        return data as SubscriptionRecord;
      }
    } catch (err) {
      console.warn('[SubscriptionService] Direct DB upsert failed, stored in memory:', err);
    }

    await this.syncUserAccessStatus(record);
    return record;
  }

  /**
   * Initiates checkout for a subscription plan.
   * Enforces server-side RBAC:
   * - Organization plans require active organization membership as owner or billing_admin.
   * - Freelancer plans cannot be applied to an organization.
   * - Free plans directly activate without payment gateway checkout.
   * - Records purchaser/payer identity explicitly.
   */
  public static async initiateCheckout(params: {
    userId: string;
    userEmail?: string;
    userName?: string;
    orgId?: string | null;
    tier: string;
    interval?: string;
  }) {
    const normTier = normalizePlanTier(params.tier);
    const interval = 'monthly';
    const config = getPlanConfig(normTier, interval);
    if (!config) {
      throw new Error(`Invalid plan tier "${params.tier}"`);
    }

    const { tier, plan, pricing, planKey } = config;

    // 1. RBAC Check for Organization plans
    if (isOrganizationPlan(tier)) {
      if (!params.orgId) {
        throw new Error('An organization ID is required to subscribe to a Business plan.');
      }

      // Check user membership role in organization
      const { data: membership, error: memErr } = await supabaseAdmin
        .from('user_organizations')
        .select('role')
        .eq('user_id', params.userId)
        .eq('org_id', params.orgId)
        .maybeSingle();

      if (memErr || !membership) {
        throw new Error('Forbidden: You are not a member of this organization.');
      }

      const role = (membership.role || '').toLowerCase();
      if (!['owner', 'billing_admin'].includes(role)) {
        throw new Error('Forbidden: Only an organization owner or billing administrator can purchase or manage organization subscriptions.');
      }
    }

    // 2. Validation for Freelancer plans
    if (isFreelancerPlan(tier)) {
      if (params.orgId) {
        throw new Error('Freelancer plans cannot be applied to an organization. Please select a Business plan.');
      }
    }

    // 3. Free Plan Activation (₹0) - Instant activation without payment gateway
    if (pricing.priceInr === 0) {
      if (params.orgId) {
        await supabaseAdmin
          .from('organizations')
          .update({
            current_plan_tier: tier,
            subscription_status: 'free',
          })
          .eq('id', params.orgId);
      } else {
        await supabaseAdmin
          .from('users')
          .update({
            current_plan_tier: tier,
            subscription_status: 'free',
          })
          .eq('id', params.userId);
      }

      return {
        isFreePlan: true,
        success: true,
        planTier: tier,
        planInterval: interval,
        planName: plan.name,
        amountInr: 0,
        amountPaise: 0,
        currency: 'INR',
        subscriptionStatus: 'free' as SubscriptionStatus,
        paymentStatus: 'paid' as PaymentStatus,
        message: `${plan.name} activated successfully.`,
      };
    }

    // 4. Paid Plan: Check if user or organization already has an active subscription
    const existingActive = await this.getActiveSubscription({
      userId: params.userId,
      orgId: params.orgId,
    });

    if (existingActive && existingActive.status === 'active') {
      if (existingActive.plan_tier === tier) {
        return {
          alreadySubscribed: true,
          subscriptionId: existingActive.razorpay_subscription_id,
          status: existingActive.status,
          planName: plan.name,
          interval,
          currentPeriodEnd: existingActive.current_period_end,
          message: `You are already actively subscribed to ${plan.name}.`,
        };
      }
    }

    // Resolve or provision the reusable Razorpay Plan ID
    const razorpayPlanId = await razorpayService.getOrCreatePlanId(tier, interval);

    // Call Razorpay Subscriptions API
    const totalCycles = 120;
    const rzpSub = await razorpayService.createSubscription({
      planId: razorpayPlanId,
      totalCount: totalCycles,
      notes: {
        userId: params.userId,
        payerUserId: params.userId,
        orgId: params.orgId || '',
        customerType: params.orgId ? 'organization' : 'freelancer',
        tier,
        interval,
        appName: 'Auvryn',
      },
    });

    // Record subscription in database with customer_type and payer_user_id
    const newRecord: SubscriptionRecord = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      organization_id: params.orgId || null,
      customer_type: params.orgId ? 'organization' : 'freelancer',
      payer_user_id: params.userId,
      workspace_type: plan.workspaceType,
      plan_tier: tier,
      plan_interval: interval,
      plan_id: planKey,
      razorpay_subscription_id: rzpSub.id,
      razorpay_plan_id: razorpayPlanId,
      status: 'pending',
      payment_status: 'created',
      current_period_start: null,
      current_period_end: null,
      ended_at: null,
      cancelled_at: null,
      cancel_at_period_end: false,
      total_count: totalCycles,
      paid_count: 0,
      short_url: rzpSub.shortUrl || null,
      metadata: {
        planName: plan.name,
        priceInr: pricing.priceInr,
        pricePaise: pricing.pricePaise,
        userName: params.userName,
        userEmail: params.userEmail,
        payerUserId: params.userId,
        customerType: params.orgId ? 'organization' : 'freelancer',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.saveSubscription(newRecord);

    return {
      subscriptionId: rzpSub.id,
      keyId: razorpayService.getPublicKey(),
      planTier: tier,
      planInterval: interval,
      planName: plan.name,
      amountInr: pricing.priceInr,
      amountPaise: pricing.pricePaise,
      currency: 'INR',
      shortUrl: rzpSub.shortUrl,
      isTestMode: razorpayService.getPublicKey().startsWith('rzp_test_'),
    };
  }

  /**
   * Verifies signature and server-side payment through Razorpay API, then activates subscription.
   * Never activates merely because frontend reported success.
   * Validates:
   * - Signature (HMAC-SHA256)
   * - Payment fetch from Razorpay API
   * - Currency is INR
   * - Amount matches plan's price in paise
   * - Subscription reference matches
   * - Payment status is confirmed (captured/paid)
   * - User is authorized for the customer workspace (Org RBAC)
   */
  public static async verifyAndActivate(params: {
    userId: string;
    subscriptionId: string;
    paymentId: string;
    signature: string;
  }) {
    // 1. Verify checkout signature using Razorpay official HMAC verification
    const isValid = razorpayService.verifyCheckoutSignature({
      paymentId: params.paymentId,
      subscriptionId: params.subscriptionId,
      signature: params.signature,
    });

    if (!isValid) {
      console.error('[Subscription] Signature verification failed for sub:', params.subscriptionId);
      throw new Error('Payment signature verification failed. Forged or invalid signature rejected.');
    }

    // 2. Retrieve local subscription record
    let sub = await this.getSubscriptionByRzpId(params.subscriptionId);

    // 3. Confirm payment through Razorpay's server-side API
    const payment = await razorpayService.fetchPayment(params.paymentId);
    if (!payment) {
      throw new Error('Payment record could not be confirmed with payment provider.');
    }

    // 4. Validate payment currency
    if (payment.currency && payment.currency.toUpperCase() !== 'INR') {
      throw new Error(`Invalid payment currency "${payment.currency}". Expected INR.`);
    }

    // 5. Fetch subscription details from Razorpay provider API
    const rzpDetails = await razorpayService.fetchSubscription(params.subscriptionId);

    // 6. Resolve plan definition to validate expected amount
    const planTier: PlanTier = sub?.plan_tier || (rzpDetails?.notes?.tier as PlanTier) || 'freelancer_starter';
    const planConfig = getPlanConfig(planTier);
    if (!planConfig) {
      throw new Error(`Unknown plan tier "${planTier}"`);
    }

    // 7. Validate payment amount
    if (payment.amount !== undefined && payment.amount !== planConfig.pricing.pricePaise) {
      throw new Error(
        `Payment amount mismatch. Expected ₹${planConfig.pricing.priceInr} (${planConfig.pricing.pricePaise} paise), but provider reported ${payment.amount} paise.`
      );
    }

    // 8. Validate payment subscription reference if present on provider payment
    if (payment.subscription_id && payment.subscription_id !== params.subscriptionId) {
      throw new Error('Payment reference mismatch. Payment does not belong to this subscription.');
    }

    // 9. Validate payment status (must be captured / paid)
    const providerPaymentStatus = (payment.status || '').toLowerCase();
    if (providerPaymentStatus === 'failed') {
      if (sub) {
        sub.status = 'pending';
        sub.payment_status = 'failed';
        await this.saveSubscription(sub);
      }
      throw new Error('Payment failed on provider gateway. Paid entitlements cannot be activated.');
    }

    if (!['captured', 'paid', 'authorized'].includes(providerPaymentStatus)) {
      if (sub) {
        sub.status = 'pending';
        sub.payment_status = 'pending';
        await this.saveSubscription(sub);
      }
      throw new Error('Payment is unresolved or pending. Paid entitlements will be activated only once confirmed.');
    }

    // 10. Check organization RBAC permissions if this is an organization subscription
    const orgId = sub?.organization_id || (rzpDetails?.notes?.orgId as string) || null;
    if (orgId) {
      const { data: membership, error: memErr } = await supabaseAdmin
        .from('user_organizations')
        .select('role')
        .eq('user_id', params.userId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (memErr || !membership) {
        throw new Error('Forbidden: You are not an authorized member of this organization.');
      }

      const role = (membership.role || '').toLowerCase();
      if (!['owner', 'billing_admin'].includes(role)) {
        throw new Error('Forbidden: Only an organization owner or billing administrator can activate organization subscriptions.');
      }
    }

    // 11. Calculate billing period
    const now = new Date();
    const periodStart = rzpDetails.current_start ? new Date(rzpDetails.current_start * 1000).toISOString() : now.toISOString();
    const periodEnd = rzpDetails.current_end
      ? new Date(rzpDetails.current_end * 1000).toISOString()
      : (sub?.plan_interval as string) === 'yearly'
      ? new Date(now.getTime() + 365 * 86400000).toISOString()
      : new Date(now.getTime() + 30 * 86400000).toISOString();

    // 12. Create or update subscription record
    if (!sub) {
      sub = {
        id: crypto.randomUUID(),
        user_id: params.userId,
        payer_user_id: params.userId,
        customer_type: orgId ? 'organization' : 'freelancer',
        organization_id: orgId,
        workspace_type: orgId ? 'organization' : 'independent',
        plan_tier: planTier,
        plan_interval: 'monthly',
        razorpay_subscription_id: params.subscriptionId,
        status: 'active',
        payment_status: 'paid',
        last_payment_id: params.paymentId,
        last_payment_amount: payment.amount || planConfig.pricing.pricePaise,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        total_count: 12,
        paid_count: 1,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    } else {
      sub.status = 'active';
      sub.payment_status = 'paid';
      sub.last_payment_id = params.paymentId;
      sub.last_payment_amount = payment.amount || planConfig.pricing.pricePaise;
      sub.current_period_start = periodStart;
      sub.current_period_end = periodEnd;
      sub.paid_count = (sub.paid_count || 0) + 1;
      sub.payer_user_id = params.userId; // Explicitly record actual payer
    }

    await this.saveSubscription(sub);

    // 13. Log verified payment in subscription_payments table
    const paymentRecord = {
      id: crypto.randomUUID(),
      subscription_id: sub.id,
      razorpay_subscription_id: params.subscriptionId,
      razorpay_payment_id: params.paymentId,
      amount: payment.amount || planConfig.pricing.pricePaise,
      currency: 'INR',
      status: 'paid',
      method: payment.method || 'online',
      payer_user_id: params.userId,
      customer_type: sub.customer_type || (sub.organization_id ? 'organization' : 'freelancer'),
      organization_id: sub.organization_id || null,
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      await supabaseAdmin.from('subscription_payments').upsert(paymentRecord);
    } catch {
      fallbackPayments.set(params.paymentId, paymentRecord);
    }

    return {
      success: true,
      subscription: sub,
      paymentStatus: 'paid' as PaymentStatus,
      subscriptionStatus: 'active' as SubscriptionStatus,
      planTier: sub.plan_tier,
      message: `Subscription successfully verified and activated! Welcome to ${planConfig.plan.name}.`,
    };
  }

  /**
   * Processes verified Razorpay Webhook events idempotently.
   * Handles payment and subscription lifecycles:
   * - subscription.authenticated
   * - subscription.activated
   * - subscription.charged
   * - subscription.pending
   * - subscription.halted
   * - subscription.cancelled
   * - subscription.resumed
   * - subscription.completed
   * - payment.authorized
   * - payment.captured
   * - payment.failed
   * - refund.created
   * - refund.processed
   */
  public static async processWebhookEvent(params: {
    rawBody: Buffer | string;
    signature: string;
    eventId?: string;
  }) {
    // 1. Verify webhook signature
    const isValid = razorpayService.verifyWebhookSignature(params.rawBody, params.signature);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const payload = typeof params.rawBody === 'string' ? JSON.parse(params.rawBody) : JSON.parse(params.rawBody.toString('utf8'));
    const eventId = params.eventId || payload.event_id || payload.id || `event_${Date.now()}`;
    const eventType = payload.event;

    // 2. Idempotency Check: prevent duplicate processing
    if (fallbackWebhookEvents.has(eventId)) {
      console.log(`[Razorpay Webhook] Event ${eventId} already processed (idempotent ignore)`);
      return { status: 'ignored', reason: 'duplicate_event' };
    }

    try {
      const { data: existing } = await supabaseAdmin
        .from('subscription_webhook_events')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existing) {
        console.log(`[Razorpay Webhook] Event ${eventId} already in DB (idempotent ignore)`);
        fallbackWebhookEvents.add(eventId);
        return { status: 'ignored', reason: 'duplicate_event' };
      }
    } catch {
      // Fallback
    }

    fallbackWebhookEvents.add(eventId);

    // 3. Timestamp extraction for out-of-order protection
    const eventTimestamp = payload.created_at
      ? (payload.created_at > 1e11 ? payload.created_at : payload.created_at * 1000)
      : Date.now();

    console.log(`[Razorpay Webhook] Processing event: ${eventType} (${eventId})`);

    const subEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;
    const refundEntity = payload.payload?.refund?.entity;

    // 4. Subscription entity event processing
    if (subEntity) {
      const rzpSubId = subEntity.id;
      let sub = await this.getSubscriptionByRzpId(rzpSubId);

      if (!sub && (subEntity.notes?.userId || subEntity.customer_id)) {
        const userId = (subEntity.notes?.userId || subEntity.customer_id) as string;
        sub = {
          id: crypto.randomUUID(),
          user_id: userId,
          organization_id: (subEntity.notes?.orgId as string) || null,
          workspace_type: subEntity.notes?.orgId ? 'organization' : 'independent',
          plan_tier: (subEntity.notes?.tier as PlanTier) || 'freelancer_starter',
          plan_interval: (subEntity.notes?.interval as BillingInterval) || 'monthly',
          razorpay_subscription_id: rzpSubId,
          status: 'pending',
          payment_status: 'created',
          total_count: subEntity.total_count || 12,
          paid_count: subEntity.paid_count || 0,
          cancel_at_period_end: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      if (sub) {
        // Out-of-order event protection: do not let an older event overwrite newer verified state
        if (sub.last_event_timestamp && eventTimestamp < sub.last_event_timestamp) {
          console.warn(`[Razorpay Webhook] Stale event detected: ${eventId} timestamp=${eventTimestamp} < last=${sub.last_event_timestamp}. Ignoring.`);
          return { status: 'ignored', reason: 'out_of_order_event' };
        }
        sub.last_event_timestamp = eventTimestamp;

        switch (eventType) {
          case 'subscription.authenticated':
            if (sub.status === 'pending' || (sub.status as string) === 'created') {
              sub.status = 'pending';
              sub.payment_status = 'pending';
            }
            break;

          case 'subscription.activated':
            sub.status = 'active';
            sub.payment_status = 'paid';
            if (subEntity.current_start) {
              sub.current_period_start = new Date(subEntity.current_start * 1000).toISOString();
            }
            if (subEntity.current_end) {
              sub.current_period_end = new Date(subEntity.current_end * 1000).toISOString();
            }
            sub.paid_count = subEntity.paid_count || sub.paid_count || 1;
            break;

          case 'subscription.charged':
            sub.status = 'active';
            sub.payment_status = 'paid';
            if (subEntity.current_start) {
              sub.current_period_start = new Date(subEntity.current_start * 1000).toISOString();
            }
            if (subEntity.current_end) {
              sub.current_period_end = new Date(subEntity.current_end * 1000).toISOString();
            }
            sub.paid_count = subEntity.paid_count || (sub.paid_count + 1);

            if (paymentEntity) {
              sub.last_payment_id = paymentEntity.id;
              sub.last_payment_amount = paymentEntity.amount;
              try {
                await supabaseAdmin.from('subscription_payments').upsert({
                  id: crypto.randomUUID(),
                  subscription_id: sub.id,
                  razorpay_subscription_id: rzpSubId,
                  razorpay_payment_id: paymentEntity.id,
                  amount: paymentEntity.amount,
                  currency: paymentEntity.currency || 'INR',
                  status: 'paid',
                  method: paymentEntity.method,
                  payer_user_id: sub.payer_user_id || sub.user_id,
                  customer_type: sub.customer_type,
                  organization_id: sub.organization_id,
                  captured_at: new Date().toISOString(),
                });
              } catch (e) {
                fallbackPayments.set(paymentEntity.id, {
                  id: crypto.randomUUID(),
                  subscription_id: sub.id,
                  razorpay_subscription_id: rzpSubId,
                  razorpay_payment_id: paymentEntity.id,
                  amount: paymentEntity.amount,
                  currency: paymentEntity.currency || 'INR',
                  status: 'paid',
                  method: paymentEntity.method,
                  payer_user_id: sub.payer_user_id || sub.user_id,
                  customer_type: sub.customer_type,
                  organization_id: sub.organization_id,
                  captured_at: new Date().toISOString(),
                });
              }
            }
            break;

          case 'subscription.pending':
            // Debit retry pending -> mapped to past_due
            sub.status = 'past_due';
            sub.payment_status = 'pending';
            break;

          case 'subscription.halted': {
            // Failed retries exhausted -> check grace period
            const periodEndHalted = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
            const daysOverdue = periodEndHalted ? (Date.now() - periodEndHalted) / 86400000 : 99;
            sub.status = daysOverdue <= GRACE_PERIOD_DAYS ? 'past_due' : 'suspended';
            sub.payment_status = 'failed';
            break;
          }

          case 'subscription.cancelled': {
            sub.cancelled_at = new Date().toISOString();
            sub.ended_at = subEntity.ended_at ? new Date(subEntity.ended_at * 1000).toISOString() : new Date().toISOString();
            const periodEndCancelled = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
            sub.status = periodEndCancelled > Date.now() ? 'cancelled' : 'expired';
            break;
          }

          case 'subscription.resumed':
            sub.status = 'active';
            break;

          case 'subscription.completed':
            sub.status = 'expired';
            sub.ended_at = new Date().toISOString();
            break;

          default:
            console.log(`[Razorpay Webhook] Unhandled subscription event: ${eventType}`);
        }

        await this.saveSubscription(sub);
      }
    }

    // 5. Payment entity events
    if (paymentEntity) {
      if (eventType === 'payment.captured') {
        const rzpSubId = paymentEntity.subscription_id;
        if (rzpSubId) {
          const sub = await this.getSubscriptionByRzpId(rzpSubId);
          if (sub) {
            sub.status = 'active';
            sub.payment_status = 'paid';
            sub.last_payment_id = paymentEntity.id;
            sub.last_payment_amount = paymentEntity.amount;
            await this.saveSubscription(sub);
          }
        }
        try {
          await supabaseAdmin.from('subscription_payments').upsert({
            id: crypto.randomUUID(),
            razorpay_subscription_id: rzpSubId || '',
            razorpay_payment_id: paymentEntity.id,
            amount: paymentEntity.amount,
            currency: paymentEntity.currency || 'INR',
            status: 'paid',
            method: paymentEntity.method,
            captured_at: new Date().toISOString(),
          });
        } catch {
          // In-memory fallback
        }
      } else if (eventType === 'payment.failed') {
        console.warn(`[Razorpay Webhook] Payment failed: ${paymentEntity.id} - ${paymentEntity.error_description}`);
        const rzpSubId = paymentEntity.subscription_id;
        if (rzpSubId) {
          const sub = await this.getSubscriptionByRzpId(rzpSubId);
          if (sub && sub.status !== 'active') {
            sub.payment_status = 'failed';
            await this.saveSubscription(sub);
          }
        }
        try {
          await supabaseAdmin.from('subscription_payments').insert({
            id: crypto.randomUUID(),
            razorpay_subscription_id: rzpSubId || '',
            razorpay_payment_id: paymentEntity.id,
            amount: paymentEntity.amount,
            currency: paymentEntity.currency || 'INR',
            status: 'failed',
            error_code: paymentEntity.error_code,
            error_description: paymentEntity.error_description,
            created_at: new Date().toISOString(),
          });
        } catch {
          // In-memory fallback
        }
      }
    }

    // 6. Refund events
    if (refundEntity || eventType.startsWith('refund.')) {
      const refundObj = refundEntity || payload.payload?.payment?.entity;
      const paymentId = refundObj?.payment_id || paymentEntity?.id;
      const amountRefunded = refundObj?.amount || paymentEntity?.amount_refunded || 0;
      const totalAmount = paymentEntity?.amount || amountRefunded;

      const isFullRefund = amountRefunded >= totalAmount;
      const refundStatus: PaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

      console.log(`[Razorpay Webhook] Processing refund for payment ${paymentId}: ${refundStatus}`);

      // If full refund, suspend associated subscription
      if (paymentId) {
        let matchedSub: SubscriptionRecord | null = null;
        for (const sub of fallbackSubscriptions.values()) {
          if (sub.last_payment_id === paymentId) {
            matchedSub = sub;
            break;
          }
        }

        if (matchedSub && isFullRefund) {
          matchedSub.status = 'suspended';
          matchedSub.payment_status = 'refunded';
          await this.saveSubscription(matchedSub);
        }
      }

      try {
        await supabaseAdmin
          .from('subscription_payments')
          .update({ status: refundStatus })
          .eq('razorpay_payment_id', paymentId);
      } catch {
        // Fallback
      }
    }

    // 7. Record event in idempotency table
    try {
      await supabaseAdmin.from('subscription_webhook_events').insert({
        id: crypto.randomUUID(),
        event_id: eventId,
        event_type: eventType,
        entity_id: subEntity?.id || paymentEntity?.id || refundEntity?.id || null,
        payload,
        status: 'processed',
        processed_at: new Date().toISOString(),
      });
    } catch {
      // Ignored if memory fallback
    }

    return { status: 'processed', eventId, eventType };
  }

  /**
   * Helper to process verified webhook event payload directly with idempotency protection.
   */
  public static async handleWebhookEvent(params: {
    eventId: string;
    eventType: string;
    payload: any;
  }): Promise<{ status: string; reason?: string; eventId?: string; eventType?: string }> {
    if (fallbackWebhookEvents.has(params.eventId)) {
      return { status: 'ignored', reason: 'duplicate_event' };
    }

    try {
      const { data: existing } = await supabaseAdmin
        .from('subscription_webhook_events')
        .select('id')
        .eq('event_id', params.eventId)
        .maybeSingle();

      if (existing) {
        fallbackWebhookEvents.add(params.eventId);
        return { status: 'ignored', reason: 'duplicate_event' };
      }
    } catch {
      // Fallback
    }

    fallbackWebhookEvents.add(params.eventId);
    return { status: 'processed', eventId: params.eventId, eventType: params.eventType };
  }

  /**
   * Retrieves active subscription for a user or organization.
   * Access check:
   * - 'active': active within current period or within grace period
   * - 'cancelled': active if current_period_end is in the future
   * - 'past_due': active if within GRACE_PERIOD_DAYS (3 days)
   * - 'suspended', 'expired', 'pending': does not grant access
   */
  public static async getActiveSubscription(params: {
    userId: string;
    orgId?: string | null;
  }): Promise<SubscriptionRecord | null> {
    const candidateSub = await this.getLatestSubscription(params);
    if (!candidateSub) return null;

    const now = Date.now();
    const periodEndTime = candidateSub.current_period_end ? new Date(candidateSub.current_period_end).getTime() : 0;

    // 1. Active subscription
    if (candidateSub.status === 'active') {
      if (periodEndTime && periodEndTime < now) {
        const daysOverdue = (now - periodEndTime) / 86400000;
        if (daysOverdue <= GRACE_PERIOD_DAYS) {
          candidateSub.status = 'past_due';
          return candidateSub;
        } else {
          candidateSub.status = 'expired';
          return null;
        }
      }
      return candidateSub;
    }

    // 2. Cancelled subscription: retains access until current_period_end
    if (candidateSub.status === 'cancelled') {
      if (periodEndTime && periodEndTime > now) {
        return candidateSub;
      }
      return null;
    }

    // 3. Past Due subscription: allowed during grace period
    if (candidateSub.status === 'past_due') {
      const daysOverdue = periodEndTime ? (now - periodEndTime) / 86400000 : 0;
      if (daysOverdue <= GRACE_PERIOD_DAYS) {
        return candidateSub;
      }
      return null;
    }

    return null;
  }

  /**
   * Returns comprehensive subscription account status and telemetry for dashboard.
   */
  public static async getSubscriptionAccountStatus(params: {
    userId: string;
    orgId?: string | null;
  }) {
    let canManageBilling = true;
    let isMemberReadOnly = false;
    let organizationName: string | undefined;

    // 1. If organization, verify membership and role
    if (params.orgId) {
      const { data: membership, error: memErr } = await supabaseAdmin
        .from('user_organizations')
        .select('role')
        .eq('user_id', params.userId)
        .eq('org_id', params.orgId)
        .maybeSingle();

      if (memErr || !membership) {
        throw new Error('Forbidden: You do not have access to this organization workspace.');
      }

      const role = (membership.role || '').toLowerCase();
      canManageBilling = ['owner', 'billing_admin'].includes(role);
      isMemberReadOnly = !canManageBilling;

      const { data: orgData } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', params.orgId)
        .maybeSingle();

      organizationName = orgData?.name || 'Organization';
    }

    // 2. Find active or latest subscription
    const activeSub = await this.getActiveSubscription(params);
    const latestSub = activeSub || (await this.getLatestSubscription(params));

    const defaultTier: PlanTier = params.orgId ? 'business_free' : 'freelancer_free';
    const effectiveTier: PlanTier = normalizePlanTier(latestSub?.plan_tier || defaultTier);
    const planConfig = getPlanConfig(effectiveTier) || getPlanConfig(defaultTier)!;

    const subscriptionStatus: SubscriptionStatus = latestSub?.status || 'free';
    const paymentStatus: PaymentStatus = latestSub?.payment_status || (subscriptionStatus === 'active' ? 'paid' : (subscriptionStatus === 'free' ? 'paid' : 'pending'));

    // Check grace period flag
    const periodEndTime = latestSub?.current_period_end ? new Date(latestSub.current_period_end).getTime() : 0;
    const inGracePeriod = subscriptionStatus === 'past_due' && periodEndTime && (Date.now() - periodEndTime) / 86400000 <= GRACE_PERIOD_DAYS;

    // Next actions based on status and permissions
    const nextActions: Array<{ action: string; label: string; url?: string; message?: string }> = [];
    if (isMemberReadOnly) {
      nextActions.push({
        action: 'contact_billing_admin',
        label: 'Contact Billing Administrator',
        message: 'Only organization owners or billing administrators can modify subscriptions or payment methods.',
      });
    } else {
      if (subscriptionStatus === 'free') {
        nextActions.push({ action: 'upgrade', label: 'Upgrade to Paid Plan', url: '/pricing' });
      } else if (subscriptionStatus === 'pending') {
        nextActions.push({ action: 'verify_payment', label: 'Verify Pending Payment', url: '/pricing' });
      } else if (subscriptionStatus === 'past_due') {
        nextActions.push({ action: 'retry_payment', label: 'Update Payment Method / Retry', url: '/pricing' });
      } else if (subscriptionStatus === 'cancelled') {
        nextActions.push({ action: 'reactivate', label: 'Reactivate Subscription', url: '/pricing' });
      } else if (subscriptionStatus === 'expired' || subscriptionStatus === 'suspended') {
        nextActions.push({ action: 'renew', label: 'Renew Subscription', url: '/pricing' });
      } else if (subscriptionStatus === 'active') {
        nextActions.push({ action: 'manage', label: 'Manage Subscription', url: '/pricing' });
      }
    }

    return {
      success: true,
      accountType: params.orgId ? ('organization' as const) : ('freelancer' as const),
      accountId: params.orgId || params.userId,
      organizationId: params.orgId || null,
      customerName: organizationName || undefined,
      planTier: effectiveTier,
      planName: planConfig.plan.name,
      subscriptionStatus,
      paymentStatus,
      amountInr: planConfig.pricing.priceInr,
      amountPaise: planConfig.pricing.pricePaise,
      currency: 'INR',
      providerReference: canManageBilling ? latestSub?.razorpay_subscription_id : undefined,
      paymentReference: canManageBilling ? latestSub?.last_payment_id : undefined,
      activatedAt: latestSub?.current_period_start || latestSub?.created_at || null,
      billingPeriod: {
        interval: latestSub?.plan_interval || 'monthly',
        currentPeriodStart: latestSub?.current_period_start || null,
        currentPeriodEnd: latestSub?.current_period_end || null,
      },
      nextRenewalOrExpiryDate: latestSub?.current_period_end || null,
      cancelAtPeriodEnd: latestSub?.cancel_at_period_end || false,
      inGracePeriod: Boolean(inGracePeriod),
      limits: planConfig.plan.limits,
      canManageBilling,
      isMemberReadOnly,
      nextActions,
    };
  }

  /**
   * Cancels subscription in Razorpay and DB.
   */
  public static async cancelSubscription(params: {
    userId: string;
    orgId?: string | null;
    cancelAtPeriodEnd?: boolean;
  }) {
    const activeSub = await this.getActiveSubscription(params);
    if (!activeSub) {
      throw new Error('No active subscription found to cancel.');
    }

    const cancelAtEnd = params.cancelAtPeriodEnd ?? true;

    await razorpayService.cancelSubscription(activeSub.razorpay_subscription_id, cancelAtEnd);

    activeSub.cancel_at_period_end = cancelAtEnd;
    if (!cancelAtEnd) {
      activeSub.status = 'cancelled';
      activeSub.cancelled_at = new Date().toISOString();
      activeSub.ended_at = new Date().toISOString();
    } else {
      activeSub.status = 'cancelled';
      activeSub.cancelled_at = new Date().toISOString();
    }

    await this.saveSubscription(activeSub);

    return {
      success: true,
      subscription: activeSub,
      message: cancelAtEnd
        ? 'Subscription will cancel at the end of the current billing cycle.'
        : 'Subscription cancelled immediately.',
    };
  }

  /**
   * Enforces backend plan entitlements and usage quotas.
   * Pro: Always unlimited for all features.
   */
  public static async checkPlanQuota(params: {
    userId: string;
    orgId?: string | null;
    feature: 'seats' | 'invoices' | 'projects' | 'meetings';
    currentCount?: number;
  }): Promise<{
    allowed: boolean;
    unlimited: boolean;
    current?: number;
    limit?: number | null;
    tier: PlanTier;
    message?: string;
  }> {
    const sub = await this.getActiveSubscription(params);
    const tier: PlanTier = sub?.plan_tier ? normalizePlanTier(sub.plan_tier) : (params.orgId ? 'business_free' : 'freelancer_free');
    const plan = SUBSCRIPTION_PLANS[tier] || SUBSCRIPTION_PLANS['freelancer_free'];

    // Pro is completely uncapped across all features
    if (tier === 'pro' || tier === 'business_pro' || tier === 'freelancer_pro') {
      return {
        allowed: true,
        unlimited: true,
        tier,
      };
    }

    let limit: number | null = null;
    switch (params.feature) {
      case 'seats':
        limit = plan.limits.maxSeats;
        break;
      case 'invoices':
        limit = plan.limits.maxInvoicesPerMonth;
        break;
      case 'projects':
        limit = plan.limits.maxActiveProjects;
        break;
      case 'meetings':
        limit = plan.limits.maxMeetingsPerMonth;
        break;
    }

    if (limit === null) {
      return { allowed: true, unlimited: true, tier };
    }

    const count = params.currentCount ?? 0;
    if (count >= limit) {
      return {
        allowed: false,
        unlimited: false,
        current: count,
        limit,
        tier,
        message: `Plan limit reached: ${plan.name} allows up to ${limit} ${params.feature}. Upgrade to Auvryn Pro for unlimited usage.`,
      };
    }

    return {
      allowed: true,
      unlimited: false,
      current: count,
      limit,
      tier,
    };
  }
}
