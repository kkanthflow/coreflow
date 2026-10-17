import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SubscriptionService } from './subscription.service.js';
import { 
  getAllPlansList, 
  SUBSCRIPTION_PLANS, 
  isFreelancerPlan, 
  isOrganizationPlan, 
  normalizePlanTier 
} from './subscription.config.js';
import { supabaseAdmin, verifySupabaseToken } from '../_core/supabase.js';
import { EntitlementsService } from './entitlements.service.js';
import { requireEntitlement } from './entitlements.middleware.js';

export const subscriptionsRouter = Router();

// Authentication middleware using existing Supabase token verification
async function requireAuth(req: Request, res: Response, next: () => void) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // First try fast JWT verify
    const payload = await verifySupabaseToken(token);
    if (payload && (payload.sub || (payload as any).userId)) {
      (req as any).user = {
        id: (payload.sub || (payload as any).userId) as string,
        email: payload.email as string,
        name: (payload.user_metadata as any)?.full_name || (payload as any).name || 'User',
      };
      next();
      return;
    }

    // Fallback to Supabase auth getUser
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }

    (req as any).user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || 'User',
    };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Authentication failed', details: err.message });
  }
}

// Optional Auth Helper for Pricing Plans Endpoint
async function tryResolveUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const payload = await verifySupabaseToken(token);
    if (payload?.sub) return { id: payload.sub, email: payload.email };
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) return { id: user.id, email: user.email };
  } catch {
    // Non-blocking
  }
  return null;
}

// ── GET /api/subscriptions/plans (RBAC-aware) ──
subscriptionsRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const orgId = (req.query.orgId as string) || (req.headers['x-organization-id'] as string) || null;
    const requestedWorkspace = (req.query.workspace as string) || null;
    const authUser = await tryResolveUser(req);

    // If orgId is provided, enforce that authenticated user is a member of that organization
    if (orgId) {
      if (!authUser) {
        res.status(401).json({ error: 'Authentication required to inspect organization pricing.' });
        return;
      }

      const { data: membership, error: memErr } = await supabaseAdmin
        .from('user_organizations')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('org_id', orgId)
        .maybeSingle();

      if (memErr || !membership) {
        res.status(403).json({ error: 'Forbidden: You are not a member of this organization.' });
        return;
      }

      const role = (membership.role || '').toLowerCase();
      const canManageBilling = ['owner', 'billing_admin'].includes(role);

      // Return ONLY organization plans. Completely hide freelancer plans.
      const orgPlans = getAllPlansList('organization');
      res.json({
        success: true,
        currency: 'INR',
        context: 'organization',
        orgId,
        userRole: role,
        canManageBilling,
        message: canManageBilling 
          ? undefined 
          : 'Contact your organization owner or billing administrator to manage your subscription.',
        plans: orgPlans,
      });
      return;
    }

    // If authenticated user without orgId: resolve user's account_type
    if (authUser) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('account_type, role, default_workspace_id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userData?.account_type === 'freelancer' || userData?.role === 'freelancer' || (!userData?.account_type && requestedWorkspace === 'independent')) {
        // Freelancers see ONLY Freelancer plans (Business plans completely hidden)
        const freelancerPlans = getAllPlansList('independent');
        res.json({
          success: true,
          currency: 'INR',
          context: 'freelancer',
          canManageBilling: true,
          plans: freelancerPlans,
        });
        return;
      }
    }

    // Public / Unauthenticated browsing
    let filteredPlans;
    if (requestedWorkspace === 'organization') {
      filteredPlans = getAllPlansList('organization');
    } else if (requestedWorkspace === 'independent') {
      filteredPlans = getAllPlansList('independent');
    } else {
      filteredPlans = getAllPlansList();
    }

    res.json({
      success: true,
      currency: 'INR',
      context: requestedWorkspace || 'all',
      canManageBilling: false,
      plans: filteredPlans,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve subscription plans', details: err.message });
  }
});

// ── GET /api/subscriptions/current (Authenticated, RBAC & Customer/Payer Separation) ──
subscriptionsRouter.get('/current', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = (req.query.orgId as string) || (req.headers['x-organization-id'] as string) || null;

    // 1. Organization Context
    if (orgId) {
      const { data: membership, error: memErr } = await supabaseAdmin
        .from('user_organizations')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .maybeSingle();

      if (memErr || !membership) {
        res.status(403).json({ error: 'Forbidden: You do not have access to this organization workspace.' });
        return;
      }

      const role = (membership.role || '').toLowerCase();
      const canManageBilling = ['owner', 'billing_admin'].includes(role);

      const activeSub = await SubscriptionService.getActiveSubscription({
        userId: user.id,
        orgId,
      });

      const { data: orgData } = await supabaseAdmin
        .from('organizations')
        .select('name, current_plan_tier, subscription_status')
        .eq('id', orgId)
        .maybeSingle();

      const effectiveTier = activeSub?.plan_tier || orgData?.current_plan_tier || 'business_free';
      const effectiveStatus = activeSub?.status || orgData?.subscription_status || 'free';
      const planDef = SUBSCRIPTION_PLANS[effectiveTier] || SUBSCRIPTION_PLANS['business_free'];

      if (!canManageBilling) {
        // Restricted member view: read-only plan info, no sensitive payment tokens or controls
        res.json({
          hasActiveSubscription: !!activeSub,
          customerType: 'organization',
          customerName: orgData?.name || 'Organization',
          tier: effectiveTier,
          planName: planDef.name,
          status: effectiveStatus,
          canManageBilling: false,
          isMemberReadOnly: true,
          message: 'Contact your organization owner or billing administrator to manage your subscription.',
        });
        return;
      }

      res.json({
        hasActiveSubscription: !!activeSub,
        customerType: 'organization',
        customerName: orgData?.name || 'Organization',
        subscription: activeSub,
        tier: effectiveTier,
        planName: planDef.name,
        interval: activeSub?.plan_interval || 'monthly',
        status: effectiveStatus,
        canManageBilling: true,
        payerUserId: activeSub?.payer_user_id || null,
        currentPeriodStart: activeSub?.current_period_start || null,
        currentPeriodEnd: activeSub?.current_period_end || null,
        cancelAtPeriodEnd: activeSub?.cancel_at_period_end || false,
      });
      return;
    }

    // 2. Freelancer Context (Organization ID is NULL)
    const activeSub = await SubscriptionService.getActiveSubscription({
      userId: user.id,
      orgId: null,
    });

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('full_name, current_plan_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    const effectiveTier = activeSub?.plan_tier || userData?.current_plan_tier || 'freelancer_free';
    const effectiveStatus = activeSub?.status || userData?.subscription_status || 'free';
    const planDef = SUBSCRIPTION_PLANS[effectiveTier] || SUBSCRIPTION_PLANS['freelancer_free'];

    res.json({
      hasActiveSubscription: !!activeSub,
      customerType: 'freelancer',
      customerName: userData?.full_name || user.name,
      subscription: activeSub,
      tier: effectiveTier,
      planName: planDef.name,
      interval: activeSub?.plan_interval || 'monthly',
      status: effectiveStatus,
      canManageBilling: true,
      payerUserId: user.id,
      currentPeriodStart: activeSub?.current_period_start || null,
      currentPeriodEnd: activeSub?.current_period_end || null,
      cancelAtPeriodEnd: activeSub?.cancel_at_period_end || false,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve subscription status', details: err.message });
  }
});

// ── GET /api/subscriptions/usage (Authenticated) ──
subscriptionsRouter.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = (req.query.orgId as string) || (req.headers['x-organization-id'] as string) || null;

    const report = await EntitlementsService.getUsageReport({
      userId: user.id,
      orgId,
    });

    res.json(report);
  } catch (err: any) {
    console.error('[Subscriptions Route] Usage report error:', err);
    res.status(500).json({ error: 'Failed to retrieve subscription usage report', details: err.message });
  }
});

// ── GET /api/subscriptions/payments (Authenticated, RBAC-Protected) ──
subscriptionsRouter.get('/payments', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = (req.query.orgId as string) || (req.headers['x-organization-id'] as string) || null;

    if (orgId) {
      // Must be owner or billing_admin to view organization payments
      const { data: membership } = await supabaseAdmin
        .from('user_organizations')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .maybeSingle();

      if (!membership || !['owner', 'billing_admin'].includes((membership.role || '').toLowerCase())) {
        res.status(403).json({ error: 'Forbidden: You do not have permission to view billing history for this organization.' });
        return;
      }

      const { data: payments } = await supabaseAdmin
        .from('subscription_payments')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      res.json({ success: true, payments: payments || [] });
      return;
    }

    // Freelancer payments
    const { data: payments } = await supabaseAdmin
      .from('subscription_payments')
      .select('*')
      .eq('payer_user_id', user.id)
      .is('organization_id', null)
      .order('created_at', { ascending: false });

    res.json({ success: true, payments: payments || [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve payment records', details: err.message });
  }
});

// ── POST /api/subscriptions/create (Authenticated, Server-Side RBAC Enforced) ──
const createSubSchema = z.object({
  tier: z.string().min(1, 'Plan tier is required'),
  interval: z.string().optional().default('monthly'),
  orgId: z.string().optional().nullable(),
});

subscriptionsRouter.post('/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = createSubSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid parameters', issues: parseResult.error.format() });
      return;
    }

    const { tier, interval, orgId } = parseResult.data;
    const user = (req as any).user;

    const result = await SubscriptionService.initiateCheckout({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      orgId: orgId || null,
      tier,
      interval,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    const status = err.message?.startsWith('Forbidden') ? 403 : 400;
    res.status(status).json({ error: err.message || 'Failed to initiate checkout' });
  }
});

// ── POST /api/subscriptions/verify (Authenticated) ──
subscriptionsRouter.post('/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscriptionId = (req.body.razorpay_subscription_id || req.body.subscriptionId) as string | undefined;
    const paymentId = (req.body.razorpay_payment_id || req.body.paymentId) as string | undefined;
    const signature = (req.body.razorpay_signature || req.body.signature) as string | undefined;

    if (!subscriptionId || !paymentId || !signature) {
      res.status(400).json({
        error: 'Missing required signature verification fields. Required: razorpay_payment_id, razorpay_subscription_id, razorpay_signature.',
      });
      return;
    }

    const user = (req as any).user;

    const result = await SubscriptionService.verifyAndActivate({
      userId: user.id,
      subscriptionId,
      paymentId,
      signature,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[Subscriptions Route] Verification failed:', err);
    res.status(400).json({ error: err.message || 'Payment signature verification failed' });
  }
});

// ── POST /api/subscriptions/cancel (Authenticated) ──
const cancelSubSchema = z.object({
  orgId: z.string().optional().nullable(),
  cancelAtPeriodEnd: z.boolean().default(true),
});

subscriptionsRouter.post('/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = cancelSubSchema.safeParse(req.body);
    const { orgId, cancelAtPeriodEnd } = parseResult.success ? parseResult.data : { orgId: null, cancelAtPeriodEnd: true };
    const user = (req as any).user;

    if (orgId) {
      const { data: membership } = await supabaseAdmin
        .from('user_organizations')
        .select('role')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .maybeSingle();

      if (!membership || !['owner', 'billing_admin'].includes((membership.role || '').toLowerCase())) {
        res.status(403).json({ error: 'Forbidden: Only an organization owner or billing administrator can cancel the subscription.' });
        return;
      }
    }

    const result = await SubscriptionService.cancelSubscription({
      userId: user.id,
      orgId: orgId || null,
      cancelAtPeriodEnd,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to cancel subscription' });
  }
});

// ── POST /api/subscriptions/quota-check (Authenticated) ──
const quotaCheckSchema = z.object({
  feature: z.enum(['seats', 'invoices', 'projects', 'workflows', 'meetings', 'analytics']),
  orgId: z.string().optional().nullable(),
});

subscriptionsRouter.post('/quota-check', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = quotaCheckSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid quota check parameters', issues: parseResult.error.format() });
      return;
    }

    const { feature, orgId } = parseResult.data;
    const user = (req as any).user;

    const result = await EntitlementsService.checkEntitlement({
      userId: user.id,
      orgId: orgId || null,
      feature: feature as any,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check quota' });
  }
});
