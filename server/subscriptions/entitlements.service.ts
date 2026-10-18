import { supabaseAdmin } from '../_core/supabase.js';
import {
  SUBSCRIPTION_PLANS,
  PlanTier,
  BillingInterval,
  PlanLimits,
  normalizePlanTier,
} from './subscription.config.js';
import { SubscriptionService, SubscriptionRecord } from './subscription.service.js';

export interface UsagePeriod {
  start: Date;
  end: Date;
  resetDate: string;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  feature: 'invoices' | 'projects' | 'workflows' | 'history' | 'meetings' | 'seats' | 'analytics';
  current: number;
  limit: number | null;
  tier: PlanTier;
  resetDate?: string;
  remaining?: number | null;
  percent?: number;
  unlimited: boolean;
  upgradeUrl?: string;
  upgradeRequired?: boolean;
}

export interface UsageReport {
  tier: PlanTier;
  planName: string;
  status: string;
  interval: BillingInterval | 'monthly';
  period: {
    start: string;
    end: string;
    resetDate: string;
  };
  entitlements: {
    invoices: EntitlementCheckResult;
    projects: EntitlementCheckResult;
    meetings: EntitlementCheckResult;
    seats: EntitlementCheckResult;
    analytics: {
      allowed: boolean;
      feature: 'analytics';
      tier: 'basic' | 'standard' | 'unlimited';
      level: 'basic' | 'standard' | 'unlimited';
      allowedFeatures: string[];
    };
  };
}

export class EntitlementsService {
  /**
   * Resolves effective plan tier and subscription for an authenticated user/organization.
   * Ensures client cannot forge access and verifies organization membership.
   */
  public static async resolveEffectiveSubscription(params: {
    userId: string;
    orgId?: string | null;
  }): Promise<{
    tier: PlanTier;
    interval: BillingInterval;
    status: string;
    subscription: SubscriptionRecord | null;
    verifiedOrgId: string | null;
  }> {
    let verifiedOrgId: string | null = null;

    // Verify organization membership if orgId provided
    if (params.orgId) {
      try {
        const { data: membership } = await supabaseAdmin
          .from('user_organizations')
          .select('id, role')
          .eq('org_id', params.orgId)
          .eq('user_id', params.userId)
          .maybeSingle();

        if (membership) {
          verifiedOrgId = params.orgId;
        }
      } catch (err) {
        console.warn('[EntitlementsService] Org membership check failed:', err);
      }
    }

    // 1. Look for active subscription in database
    const activeSub = await SubscriptionService.getActiveSubscription({
      userId: params.userId,
      orgId: verifiedOrgId,
    });

    if (activeSub && ['active', 'authenticated', 'cancelled', 'past_due'].includes(activeSub.status)) {
      return {
        tier: normalizePlanTier(activeSub.plan_tier),
        interval: (activeSub.plan_interval || 'monthly') as BillingInterval,
        status: activeSub.status,
        subscription: activeSub,
        verifiedOrgId,
      };
    }

    // 2. Fallback to organization current_plan_tier
    if (verifiedOrgId) {
      try {
        const { data: orgData } = await supabaseAdmin
          .from('organizations')
          .select('current_plan_tier, subscription_status')
          .eq('id', verifiedOrgId)
          .maybeSingle();

        if (orgData?.current_plan_tier) {
          const orgTier = normalizePlanTier(orgData.current_plan_tier);
          return {
            tier: orgTier,
            interval: 'monthly',
            status: orgData.subscription_status || 'free',
            subscription: null,
            verifiedOrgId,
          };
        }
      } catch (err) {
        console.warn('[EntitlementsService] Org plan query error:', err);
      }
    }

    // 3. Fallback to user current_plan_tier
    try {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('current_plan_tier, subscription_status')
        .eq('id', params.userId)
        .maybeSingle();

      if (userData?.current_plan_tier) {
        const userTier = normalizePlanTier(userData.current_plan_tier);
        return {
          tier: userTier,
          interval: 'monthly',
          status: userData.subscription_status || 'free',
          subscription: null,
          verifiedOrgId,
        };
      }
    } catch (err) {
      console.warn('[EntitlementsService] User plan query error:', err);
    }

    // Default baseline tier (Free tier according to context)
    const defaultTier: PlanTier = verifiedOrgId ? 'business_free' : 'freelancer_free';
    return {
      tier: defaultTier,
      interval: 'monthly',
      status: 'free',
      subscription: null,
      verifiedOrgId,
    };
  }

  /**
   * Calculates the exact usage window without 30-day fixed drift:
   * - Monthly plans: uses current_period_start and current_period_end
   * - Yearly plans: monthly quota slices anchored on the subscription start date
   * - Free / Default: calendar month in UTC
   */
  public static calculateUsagePeriod(subscription: SubscriptionRecord | null): UsagePeriod {
    const now = new Date();

    if (subscription?.current_period_start && subscription?.current_period_end) {
      const subStart = new Date(subscription.current_period_start);
      const subEnd = new Date(subscription.current_period_end);

      if ((subscription.plan_interval as string) === 'yearly') {
        // Calculate monthly window anchored on subStart date
        let windowStart = new Date(subStart);
        let windowEnd = new Date(subStart);

        // Advance month-by-month to find the active monthly cycle
        while (windowEnd <= now && windowEnd < subEnd) {
          windowStart = new Date(windowEnd);
          // Month arithmetic: add 1 calendar month safely handling month-end
          const targetMonth = windowStart.getMonth() + 1;
          const targetYear = windowStart.getFullYear() + Math.floor(targetMonth / 12);
          const normalizedMonth = targetMonth % 12;
          const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
          const targetDay = Math.min(subStart.getDate(), daysInTargetMonth);

          windowEnd = new Date(targetYear, normalizedMonth, targetDay, subStart.getHours(), subStart.getMinutes(), subStart.getSeconds());
        }

        if (windowEnd > subEnd) {
          windowEnd = new Date(subEnd);
        }

        return {
          start: windowStart,
          end: windowEnd,
          resetDate: windowEnd.toISOString(),
        };
      }

      // Monthly subscription cycle
      return {
        start: subStart,
        end: subEnd,
        resetDate: subEnd.toISOString(),
      };
    }

    // Calendar month UTC boundary for baseline accounts
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

    return {
      start,
      end,
      resetDate: end.toISOString(),
    };
  }

  /**
   * Authoritative live usage counter for invoices, projects, meetings, and team seats.
   */
  public static async getAuthoritativeUsage(params: {
    userId: string;
    orgId?: string | null;
    period: UsagePeriod;
  }): Promise<{
    invoicesCount: number;
    activeProjectsCount: number;
    meetingsCount: number;
    teamSeatsCount: number;
  }> {
    const periodStartIso = params.period.start.toISOString();
    const periodEndIso = params.period.end.toISOString();

    let invoicesCount = 0;
    let activeProjectsCount = 0;
    let meetingsCount = 0;
    let teamSeatsCount = 1;

    try {
      // 1. Authoritative Invoices count in current window
      let invQuery = supabaseAdmin
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .gte('created_at', periodStartIso)
        .lt('created_at', periodEndIso);

      if (params.orgId) {
        invQuery = invQuery.eq('organization_id', params.orgId);
      } else {
        invQuery = invQuery.eq('owner_id', params.userId);
      }

      const { count: invC } = await invQuery;
      invoicesCount = invC || 0;
    } catch (err) {
      console.warn('[EntitlementsService] Error counting invoices:', err);
    }

    try {
      // 2. Active Projects count (excluding completed, archived, deleted)
      let projQuery = supabaseAdmin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '("completed","archived")')
        .is('deleted_at', null);

      if (params.orgId) {
        projQuery = projQuery.eq('org_id', params.orgId);
      } else {
        projQuery = projQuery.eq('owner_id', params.userId);
      }

      const { count: projC } = await projQuery;
      activeProjectsCount = projC || 0;
    } catch (err) {
      console.warn('[EntitlementsService] Error counting projects:', err);
    }

    try {
      // 3. Meetings count in current window
      const { count: meetC } = await supabaseAdmin
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', params.userId)
        .gte('created_at', periodStartIso)
        .lt('created_at', periodEndIso);

      meetingsCount = meetC || 0;
    } catch (err) {
      console.warn('[EntitlementsService] Error counting meetings:', err);
    }

    try {
      // 4. Team Seats count
      if (params.orgId) {
        const { count: seatC } = await supabaseAdmin
          .from('user_organizations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', params.orgId);

        teamSeatsCount = seatC || 1;
      } else {
        teamSeatsCount = 1;
      }
    } catch (err) {
      console.warn('[EntitlementsService] Error counting seats:', err);
    }

    return {
      invoicesCount,
      activeProjectsCount,
      meetingsCount,
      teamSeatsCount,
    };
  }

  /**
   * Evaluates feature entitlement for a specific action.
   */
  public static async checkEntitlement(params: {
    userId: string;
    orgId?: string | null;
    feature: 'invoices' | 'projects' | 'workflows' | 'history' | 'meetings' | 'seats' | 'analytics';
    currentUsage?: number;
  }): Promise<EntitlementCheckResult> {
    const { tier, subscription, verifiedOrgId } = await this.resolveEffectiveSubscription(params);
    const period = this.calculateUsagePeriod(subscription);
    const planDef = SUBSCRIPTION_PLANS[tier];
    const limits = planDef.limits;

    const isPro = tier === 'freelancer_pro' || tier === 'business_pro' || tier === 'pro';

    // Handle analytics tier check
    if (params.feature === 'analytics') {
      return {
        allowed: true,
        feature: 'analytics',
        current: 0,
        limit: null,
        tier,
        unlimited: isPro,
      };
    }

    // Pro plans have unlimited covered usage
    if (isPro) {
      return {
        allowed: true,
        feature: params.feature,
        current: 0,
        limit: null,
        tier,
        resetDate: period.resetDate,
        remaining: null,
        percent: 0,
        unlimited: true,
      };
    }

    const usage = await this.getAuthoritativeUsage({
      userId: params.userId,
      orgId: verifiedOrgId,
      period,
    });

    let current = 0;
    let limit: number | null = null;

    switch (params.feature) {
      case 'invoices':
        current = usage.invoicesCount;
        limit = limits.maxInvoicesPerMonth;
        break;
      case 'projects':
        current = usage.activeProjectsCount;
        limit = limits.maxActiveProjects;
        break;
      case 'meetings':
        current = usage.meetingsCount;
        limit = limits.maxMeetingsPerMonth;
        break;
      case 'seats':
        current = usage.teamSeatsCount;
        limit = limits.maxSeats;
        break;
      case 'workflows':
        current = 0;
        limit = limits.maxWorkflows;
        break;
      case 'history':
        current = 0;
        limit = limits.historyDays;
        break;
    }

    if (params.currentUsage !== undefined) {
      current = params.currentUsage;
    }

    const allowed = limit === null || current < limit;
    const remaining = limit !== null ? Math.max(0, limit - current) : null;
    const percent = limit !== null ? Math.min(100, Math.round((current / limit) * 100)) : 0;

    return {
      allowed,
      feature: params.feature,
      current,
      limit,
      tier,
      resetDate: period.resetDate,
      remaining,
      percent,
      unlimited: limit === null,
      upgradeUrl: '/pricing',
      upgradeRequired: !allowed,
    };
  }

  /**
   * Generates a comprehensive usage report for the usage API.
   * Also asynchronously records snapshot in public.subscription_usage_ledger.
   */
  public static async getUsageReport(params: {
    userId: string;
    orgId?: string | null;
  }): Promise<UsageReport> {
    const { tier, interval, status, subscription, verifiedOrgId } =
      await this.resolveEffectiveSubscription(params);
    const period = this.calculateUsagePeriod(subscription);
    const planDef = SUBSCRIPTION_PLANS[tier];
    const limits = planDef.limits;

    const usage = await this.getAuthoritativeUsage({
      userId: params.userId,
      orgId: verifiedOrgId,
      period,
    });

    const isPro = tier === 'pro';

    const buildMetric = (
      feature: 'invoices' | 'projects' | 'meetings' | 'seats',
      current: number,
      limit: number | null
    ): EntitlementCheckResult => {
      if (isPro || limit === null) {
        return {
          allowed: true,
          feature,
          current,
          limit: null,
          tier,
          resetDate: ['invoices', 'meetings'].includes(feature) ? period.resetDate : undefined,
          remaining: null,
          percent: 0,
          unlimited: true,
        };
      }
      return {
        allowed: current < limit,
        feature,
        current,
        limit,
        tier,
        resetDate: ['invoices', 'meetings'].includes(feature) ? period.resetDate : undefined,
        remaining: Math.max(0, limit - current),
        percent: Math.min(100, Math.round((current / limit) * 100)),
        unlimited: false,
        upgradeUrl: '/pricing',
      };
    };

    const analyticsFeatures: Record<string, string[]> = {
      basic: ['Basic revenue ledger', 'Task completion trajectories', 'PDF invoice export'],
      standard: ['Executive velocity curves', 'Sprint throughput telemetry', 'Financial realization rates', 'Role telemetry'],
      unlimited: ['Enterprise audit trail', 'Deep predictive telemetry', 'Uncapped velocity metrics', 'Compliance & export data rails'],
    };

    const report: UsageReport = {
      tier,
      planName: planDef.name,
      status,
      interval,
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        resetDate: period.resetDate,
      },
      entitlements: {
        invoices: buildMetric('invoices', usage.invoicesCount, limits.maxInvoicesPerMonth),
        projects: buildMetric('projects', usage.activeProjectsCount, limits.maxActiveProjects),
        meetings: buildMetric('meetings', usage.meetingsCount, limits.maxMeetingsPerMonth),
        seats: buildMetric('seats', usage.teamSeatsCount, limits.maxSeats),
        analytics: {
          allowed: true,
          feature: 'analytics',
          tier: limits.analyticsTier,
          level: limits.analyticsTier,
          allowedFeatures: analyticsFeatures[limits.analyticsTier] || analyticsFeatures.basic,
        },
      },
    };

    // Asynchronously record / upsert into subscription_usage_ledger
    this.recordUsageLedgerSnapshot({
      userId: params.userId,
      orgId: verifiedOrgId,
      subscriptionId: subscription?.id,
      tier,
      period,
      usage,
    }).catch(err => console.warn('[EntitlementsService] Ledger snapshot non-fatal err:', err));

    return report;
  }

  /**
   * Records authoritative snapshot in subscription_usage_ledger table.
   */
  private static async recordUsageLedgerSnapshot(params: {
    userId: string;
    orgId?: string | null;
    subscriptionId?: string;
    tier: PlanTier;
    period: UsagePeriod;
    usage: {
      invoicesCount: number;
      activeProjectsCount: number;
      meetingsCount: number;
      teamSeatsCount: number;
    };
  }) {
    try {
      await supabaseAdmin.from('subscription_usage_ledger').insert({
        user_id: params.userId,
        organization_id: params.orgId || null,
        subscription_id: params.subscriptionId || null,
        plan_tier: params.tier,
        period_start: params.period.start.toISOString(),
        period_end: params.period.end.toISOString(),
        invoices_count: params.usage.invoicesCount,
        meetings_count: params.usage.meetingsCount,
        active_projects_count: params.usage.activeProjectsCount,
        team_seats_count: params.usage.teamSeatsCount,
        metadata: {
          recordedAt: new Date().toISOString(),
        },
      });
    } catch {
      // Ignored if duplicate period
    }
  }
}
