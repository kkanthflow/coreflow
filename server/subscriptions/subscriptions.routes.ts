import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SubscriptionService } from './subscription.service.js';
import { getAllPlansList } from './subscription.config.js';
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

// ── GET /api/subscriptions/plans (Public) ──
subscriptionsRouter.get('/plans', (_req: Request, res: Response) => {
  try {
    const plans = getAllPlansList();
    res.json({
      success: true,
      currency: 'INR',
      plans,
      discounts: {
        yearlyMonthsFree: 2,
        description: 'Yearly billing includes 2 months free equivalent',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve subscription plans', details: err.message });
  }
});

// ── GET /api/subscriptions/current (Authenticated) ──
subscriptionsRouter.get('/current', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = (req.query.orgId as string) || (req.headers['x-organization-id'] as string) || null;

    const activeSub = await SubscriptionService.getActiveSubscription({
      userId: user.id,
      orgId,
    });

    if (!activeSub) {
      res.json({
        hasActiveSubscription: false,
        tier: 'freelancer', // default free/basic tier
        status: 'none',
        planName: 'Free Workspace',
      });
      return;
    }

    res.json({
      hasActiveSubscription: true,
      subscription: activeSub,
      tier: activeSub.plan_tier,
      interval: activeSub.plan_interval,
      status: activeSub.status,
      currentPeriodEnd: activeSub.current_period_end,
      cancelAtPeriodEnd: activeSub.cancel_at_period_end,
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

// ── GET /api/subscriptions/analytics (Authenticated, Server-Enforced Analytics Entitlements) ──
subscriptionsRouter.get('/analytics', requireAuth, requireEntitlement('analytics'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = (req.query.orgId as string) || (req.headers['x-organization-id'] as string) || null;

    const { tier } = await EntitlementsService.resolveEffectiveSubscription({
      userId: user.id,
      orgId,
    });

    const isPro = tier === 'pro';
    const isStarter = tier === 'starter';

    res.json({
      success: true,
      tier,
      level: isPro ? 'unlimited' : isStarter ? 'standard' : 'basic',
      features: {
        basicLedger: true,
        taskTrajectories: true,
        executiveVelocity: isStarter || isPro,
        sprintThroughput: isStarter || isPro,
        financialCurves: isStarter || isPro,
        deepAuditTrail: isPro,
        complianceExport: isPro,
        predictiveTelemetry: isPro,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load analytics telemetry', details: err.message });
  }
});

// ── POST /api/subscriptions/create (Authenticated) ──
const createSubSchema = z.object({
  tier: z.enum(['freelancer', 'starter', 'pro']),
  interval: z.enum(['monthly', 'yearly']),
  orgId: z.string().optional().nullable(),
});

subscriptionsRouter.post('/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = createSubSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid plan or billing interval parameters', issues: parseResult.error.format() });
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
    console.error('[Subscriptions Route] Error creating subscription checkout:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate checkout' });
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
        error: 'Missing required signature verification fields. Required: razorpay_payment_id (or paymentId), razorpay_subscription_id (or subscriptionId), razorpay_signature (or signature).',
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
  feature: z.enum(['seats', 'invoices', 'projects', 'meetings', 'analytics']),
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
      feature,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check quota' });
  }
});
