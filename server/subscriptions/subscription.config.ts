export type PlanTier = 'freelancer' | 'starter' | 'pro';
export type BillingInterval = 'monthly' | 'yearly';

export interface PlanLimits {
  maxSeats: number | null; // null = unlimited
  maxInvoicesPerMonth: number | null;
  maxActiveProjects: number | null;
  maxMeetingsPerMonth: number | null;
  analyticsTier: 'basic' | 'standard' | 'unlimited';
}

export interface PlanPricing {
  priceInr: number; // in whole INR
  pricePaise: number; // in paise for Razorpay
  razorpayPlanId?: string;
  discountNote?: string;
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  workspaceType: 'independent' | 'organization';
  limits: PlanLimits;
  features: string[];
  pricing: Record<BillingInterval, PlanPricing>;
}

export const SUBSCRIPTION_PLANS: Record<PlanTier, PlanDefinition> = {
  freelancer: {
    tier: 'freelancer',
    name: 'Freelancer',
    tagline: 'Individual workspace engineered for solo specialists and consultants',
    workspaceType: 'independent',
    limits: {
      maxSeats: 1,
      maxInvoicesPerMonth: 15,
      maxActiveProjects: 5,
      maxMeetingsPerMonth: 20,
      analyticsTier: 'basic',
    },
    features: [
      'Individual workspace for 1 user',
      'Up to 15 invoices / month',
      'Up to 5 active projects',
      'Up to 20 meetings / month',
      'Basic revenue & task analytics',
      'PDF invoice export & client portal',
      'Standard email support',
    ],
    pricing: {
      monthly: {
        priceInr: 299,
        pricePaise: 29900,
        razorpayPlanId: process.env.RAZORPAY_PLAN_FREELANCER_MONTHLY,
      },
      yearly: {
        priceInr: 2990,
        pricePaise: 299000,
        razorpayPlanId: process.env.RAZORPAY_PLAN_FREELANCER_YEARLY,
        discountNote: '2 months free included (Save ₹598/yr)',
      },
    },
  },

  starter: {
    tier: 'starter',
    name: 'Business Starter',
    tagline: 'Collaborative operating workbench for agile teams and growing agencies',
    workspaceType: 'organization',
    limits: {
      maxSeats: 5,
      maxInvoicesPerMonth: 100,
      maxActiveProjects: 25,
      maxMeetingsPerMonth: 100,
      analyticsTier: 'standard',
    },
    features: [
      'Dedicated organization workspace',
      'Up to 5 team members included',
      'Up to 100 invoices / month',
      'Up to 25 active projects',
      'Up to 100 meetings / month with recording',
      'Standard executive telemetry & velocity reports',
      'Role-based access controls (RBAC)',
      'Priority email & chat support',
    ],
    pricing: {
      monthly: {
        priceInr: 399,
        pricePaise: 39900,
        razorpayPlanId: process.env.RAZORPAY_PLAN_STARTER_MONTHLY,
      },
      yearly: {
        priceInr: 3990,
        pricePaise: 399000,
        razorpayPlanId: process.env.RAZORPAY_PLAN_STARTER_YEARLY,
        discountNote: '2 months free included (Save ₹798/yr)',
      },
    },
  },

  pro: {
    tier: 'pro',
    name: 'Auvryn Pro',
    tagline: 'Uncapped velocity and enterprise governance without arbitrary limits',
    workspaceType: 'organization',
    limits: {
      maxSeats: null, // Unlimited seats
      maxInvoicesPerMonth: null, // Unlimited invoices
      maxActiveProjects: null, // Unlimited projects
      maxMeetingsPerMonth: null, // Unlimited meetings
      analyticsTier: 'unlimited',
    },
    features: [
      'Unlimited team members (no fixed seat limit)',
      'Unlimited invoices & recurring billing cycles',
      'Unlimited active projects & milestones',
      'Unlimited HD encrypted meetings & cloud storage',
      'Unlimited deep analytics, velocity metrics & exports',
      'Full audit log trails & compliance exports',
      'Multi-currency invoices & custom payment rails',
      'Dedicated 24/7 priority support & onboarding',
    ],
    pricing: {
      monthly: {
        priceInr: 499,
        pricePaise: 49900,
        razorpayPlanId: process.env.RAZORPAY_PLAN_PRO_MONTHLY,
      },
      yearly: {
        priceInr: 4990,
        pricePaise: 499000,
        razorpayPlanId: process.env.RAZORPAY_PLAN_PRO_YEARLY,
        discountNote: '2 months free included (Save ₹998/yr)',
      },
    },
  },
};

export const GRACE_PERIOD_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '3', 10);

export function getPlanConfig(tier: string, interval: string): {
  tier: PlanTier;
  interval: BillingInterval;
  plan: PlanDefinition;
  pricing: PlanPricing;
  planKey: string;
} | null {
  const normTier = tier?.toLowerCase() as PlanTier;
  const normInterval = interval?.toLowerCase() as BillingInterval;

  const plan = SUBSCRIPTION_PLANS[normTier];
  if (!plan) return null;

  const pricing = plan.pricing[normInterval];
  if (!pricing) return null;

  return {
    tier: normTier,
    interval: normInterval,
    plan,
    pricing,
    planKey: `${normTier}_${normInterval}`,
  };
}

export function getAllPlansList() {
  return Object.values(SUBSCRIPTION_PLANS).map((p) => ({
    tier: p.tier,
    name: p.name,
    tagline: p.tagline,
    workspaceType: p.workspaceType,
    limits: p.limits,
    features: p.features,
    pricing: {
      monthly: {
        priceInr: p.pricing.monthly.priceInr,
        interval: 'monthly',
      },
      yearly: {
        priceInr: p.pricing.yearly.priceInr,
        interval: 'yearly',
        discountNote: p.pricing.yearly.discountNote,
        effectiveMonthlyInr: Math.round(p.pricing.yearly.priceInr / 12),
      },
    },
  }));
}
