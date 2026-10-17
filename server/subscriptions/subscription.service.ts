import crypto from 'crypto';
import { supabaseAdmin } from '../_core/supabase.js';
import { razorpayService } from './razorpay.service.js';
import {
  SUBSCRIPTION_PLANS,
  PlanTier,
  BillingInterval,
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
  status: string; // 'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
  current_period_start?: string | null;
  current_period_end?: string | null;
  ended_at?: string | null;
  cancelled_at?: string | null;
  cancel_at_period_end: boolean;
  total_count: number;
  paid_count: number;
  short_url?: string | null;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

// In-memory fallback repository when running tests or if DB table cache is building
const fallbackSubscriptions = new Map<string, SubscriptionRecord>();
const fallbackPayments = new Map<string, any>();
const fallbackWebhookEvents = new Set<string>();

export class SubscriptionService {
  /**
   * Helper to query Supabase with fallback to in-memory store
   */
  private static async getSubscriptionByRzpId(rzpSubId: string): Promise<SubscriptionRecord | null> {
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
   * Synchronizes user and organization access status based on subscription state.
   * Handles active subscriptions (e.g. charged/activated), halted (payment retries failed),
   * and cancelled subscriptions.
   */
  public static async syncUserAccessStatus(record: SubscriptionRecord): Promise<void> {
    try {
      const isAccessActive = ['active', 'authenticated'].includes(record.status);
      const isHalted = record.status === 'halted';
      const isCancelled = ['cancelled', 'expired', 'completed'].includes(record.status);

      let targetPlanTier: PlanTier = record.plan_tier || 'freelancer';
      let targetStatus = record.status;

      if (isCancelled) {
        // Downgrade to baseline free tier on cancellation
        targetPlanTier = 'freelancer';
        targetStatus = 'cancelled';
      } else if (isHalted) {
        targetStatus = 'halted';
      } else if (isAccessActive) {
        targetStatus = 'active';
      }

      // 1. Sync User Access in public.users
      if (record.user_id) {
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
  private static async saveSubscription(record: SubscriptionRecord): Promise<SubscriptionRecord> {
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
      status: 'created',
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
   * Verifies signature from frontend checkout callback and activates subscription.
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
      throw new Error('Payment signature verification failed. Please contact support if you were charged.');
    }

    // 2. Fetch verified subscription details from Razorpay
    const rzpDetails = await razorpayService.fetchSubscription(params.subscriptionId);

    // 3. Find and update DB record
    let sub = await this.getSubscriptionByRzpId(params.subscriptionId);

    const now = new Date();
    const periodStart = rzpDetails.current_start ? new Date(rzpDetails.current_start * 1000).toISOString() : now.toISOString();
    const periodEnd = rzpDetails.current_end
      ? new Date(rzpDetails.current_end * 1000).toISOString()
      : sub?.plan_interval === 'yearly'
      ? new Date(now.getTime() + 365 * 86400000).toISOString()
      : new Date(now.getTime() + 30 * 86400000).toISOString();

    if (!sub) {
      sub = {
        id: crypto.randomUUID(),
        user_id: params.userId,
        payer_user_id: params.userId,
        customer_type: (rzpDetails.notes as any)?.orgId ? 'organization' : 'freelancer',
        organization_id: (rzpDetails.notes as any)?.orgId || null,
        workspace_type: (rzpDetails.notes as any)?.orgId ? 'organization' : 'independent',
        plan_tier: (rzpDetails.notes as any)?.tier || 'freelancer_starter',
        plan_interval: 'monthly',
        razorpay_subscription_id: params.subscriptionId,
        status: 'active',
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
      sub.current_period_start = periodStart;
      sub.current_period_end = periodEnd;
      sub.paid_count = (sub.paid_count || 0) + 1;
      sub.payer_user_id = params.userId; // Explicitly record actual payer
    }

    await this.saveSubscription(sub);

    // 4. Log payment in subscription_payments table with payer_user_id and customer_type
    const paymentRecord = {
      id: crypto.randomUUID(),
      subscription_id: sub.id,
      razorpay_subscription_id: params.subscriptionId,
      razorpay_payment_id: params.paymentId,
      amount: rzpDetails.plan?.item?.amount || (SUBSCRIPTION_PLANS[sub.plan_tier]?.pricing.monthly.pricePaise || 29900),
      currency: 'INR',
      status: 'captured',
      method: 'online',
      payer_user_id: params.userId,
      customer_type: sub.customer_type || (sub.organization_id ? 'organization' : 'freelancer'),
      organization_id: sub.organization_id || null,
      captured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      await supabaseAdmin.from('subscription_payments').insert(paymentRecord);
    } catch {
      fallbackPayments.set(params.paymentId, paymentRecord);
    }

    return {
      success: true,
      subscription: sub,
      message: `Subscription successfully activated! Welcome to ${sub.plan_tier}.`,
    };
  }

  /**
   * Processes verified Razorpay Webhook events idempotently.
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

    const payload = JSON.parse(params.rawBody.toString('utf8'));
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

    // 3. Process according to event type
    console.log(`[Razorpay Webhook] Processing event: ${eventType} (${eventId})`);

    const subEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;

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
          plan_tier: (subEntity.notes?.tier as PlanTier) || 'freelancer',
          plan_interval: (subEntity.notes?.interval as BillingInterval) || 'monthly',
          razorpay_subscription_id: rzpSubId,
          status: subEntity.status || 'created',
          total_count: subEntity.total_count || 12,
          paid_count: subEntity.paid_count || 0,
          cancel_at_period_end: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      if (sub) {
        switch (eventType) {
          case 'subscription.authenticated':
            sub.status = 'authenticated';
            break;

          case 'subscription.activated':
            sub.status = 'active';
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
            if (subEntity.current_start) {
              sub.current_period_start = new Date(subEntity.current_start * 1000).toISOString();
            }
            if (subEntity.current_end) {
              sub.current_period_end = new Date(subEntity.current_end * 1000).toISOString();
            }
            sub.paid_count = subEntity.paid_count || (sub.paid_count + 1);

            // Record payment transaction
            if (paymentEntity) {
              try {
                await supabaseAdmin.from('subscription_payments').upsert({
                  id: crypto.randomUUID(),
                  subscription_id: sub.id,
                  razorpay_subscription_id: rzpSubId,
                  razorpay_payment_id: paymentEntity.id,
                  amount: paymentEntity.amount,
                  currency: paymentEntity.currency || 'INR',
                  status: paymentEntity.status || 'captured',
                  method: paymentEntity.method,
                  captured_at: new Date().toISOString(),
                });
              } catch (e) {
                console.warn('[Webhook] Failed to insert payment log:', e);
              }
            }
            break;

          case 'subscription.pending':
            sub.status = 'pending';
            break;

          case 'subscription.halted':
            // Failed retries exhausted
            sub.status = 'halted';
            break;

          case 'subscription.cancelled':
            sub.status = 'cancelled';
            sub.cancelled_at = new Date().toISOString();
            sub.ended_at = subEntity.ended_at ? new Date(subEntity.ended_at * 1000).toISOString() : new Date().toISOString();
            break;

          case 'subscription.completed':
            sub.status = 'completed';
            sub.ended_at = new Date().toISOString();
            break;

          default:
            console.log(`[Webhook] Unhandled subscription event: ${eventType}`);
        }

        await this.saveSubscription(sub);
      }
    }

    if (eventType === 'payment.failed' && paymentEntity) {
      console.warn(`[Razorpay Webhook] Payment failed: ${paymentEntity.id} - ${paymentEntity.error_description}`);
      try {
        await supabaseAdmin.from('subscription_payments').insert({
          id: crypto.randomUUID(),
          razorpay_subscription_id: paymentEntity.subscription_id || '',
          razorpay_payment_id: paymentEntity.id,
          amount: paymentEntity.amount,
          currency: paymentEntity.currency || 'INR',
          status: 'failed',
          error_code: paymentEntity.error_code,
          error_description: paymentEntity.error_description,
          created_at: new Date().toISOString(),
        });
      } catch {
        // Fallback
      }
    }

    // 4. Record event in idempotency table
    try {
      await supabaseAdmin.from('subscription_webhook_events').insert({
        id: crypto.randomUUID(),
        event_id: eventId,
        event_type: eventType,
        entity_id: subEntity?.id || paymentEntity?.id || null,
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
   */
  public static async getActiveSubscription(params: {
    userId: string;
    orgId?: string | null;
  }): Promise<SubscriptionRecord | null> {
    try {
      // 1. If orgId is provided, query ONLY organization subscription for this specific orgId
      if (params.orgId) {
        const { data: orgSub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('organization_id', params.orgId)
          .in('status', ['active', 'authenticated'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orgSub) return orgSub as SubscriptionRecord;
      } else {
        // 2. Freelancer query: ONLY return personal subscriptions where organization_id IS NULL
        const { data: userSub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('user_id', params.userId)
          .is('organization_id', null)
          .in('status', ['active', 'authenticated'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (userSub) return userSub as SubscriptionRecord;
      }
    } catch {
      // Check fallback memory
    }

    // Fallback scan with strict isolation
    for (const sub of fallbackSubscriptions.values()) {
      if (['active', 'authenticated'].includes(sub.status)) {
        if (params.orgId && sub.organization_id === params.orgId) return sub;
        if (!params.orgId && !sub.organization_id && sub.user_id === params.userId) return sub;
      }
    }

    return null;
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
    const tier: PlanTier = sub?.plan_tier || 'freelancer'; // Default tier
    const plan = SUBSCRIPTION_PLANS[tier];

    // Pro is completely uncapped across all features
    if (tier === 'pro') {
      return {
        allowed: true,
        unlimited: true,
        tier: 'pro',
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
