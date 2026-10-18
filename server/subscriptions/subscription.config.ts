export type PlanTier =
  | 'freelancer_free'
  | 'freelancer_starter'
  | 'freelancer_pro'
  | 'business_free'
  | 'business_starter'
  | 'business_pro'
  | 'freelancer'
  | 'starter'
  | 'pro';

export type SubscriptionStatus =
  | 'free'
  | 'pending'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'suspended'
  | 'halted';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type BillingInterval = 'monthly';

export interface PlanLimits {
  maxSeats: number | null; // null = unlimited
  maxActiveProjects: number | null; // null = unlimited
  maxWorkflows: number | null; // null = unlimited
  historyDays: number | null; // null = unlimited
  maxInvoicesPerMonth: number | null;
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

export const SUBSCRIPTION_PLANS: Record<string, PlanDefinition> = {
  // ── Freelancer Plans ──
  freelancer_free: {
    tier: 'freelancer_free',
    name: 'Free',
    tagline: 'Individual workspace for solo specialists and consultants',
    workspaceType: 'independent',
    limits: {
      maxSeats: 1,
      maxActiveProjects: 3,
      maxWorkflows: 2,
      historyDays: 7,
      maxInvoicesPerMonth: 15,
      maxMeetingsPerMonth: 20,
      analyticsTier: 'basic',
    },
    features: [
      'Maximum 3 projects',
      'Maximum 2 workflows',
      '1 user workspace',
      '7-day history',
      'PDF invoice export & client portal',
      'Standard community support',
    ],
    pricing: {
      monthly: {
        priceInr: 0,
        pricePaise: 0,
      },
    },
  },

  freelancer_starter: {
    tier: 'freelancer_starter',
    name: 'Starter',
    tagline: 'Expanded capacity for growing freelancers and solo practitioners',
    workspaceType: 'independent',
    limits: {
      maxSeats: 1,
      maxActiveProjects: 10,
      maxWorkflows: 5,
      historyDays: 30,
      maxInvoicesPerMonth: 50,
      maxMeetingsPerMonth: 50,
      analyticsTier: 'basic',
    },
    features: [
      'Maximum 10 projects',
      'Maximum 5 workflows',
      '1 user workspace',
      '30-day history',
      'Up to 50 invoices / month',
      'Basic revenue & task analytics',
      'Standard email support',
    ],
    pricing: {
      monthly: {
        priceInr: 299,
        pricePaise: 29900,
        razorpayPlanId: process.env.RAZORPAY_PLAN_FREELANCER_MONTHLY,
      },
    },
  },

  freelancer_pro: {
    tier: 'freelancer_pro',
    name: 'Pro',
    tagline: 'Uncapped individual operating environment with zero limits',
    workspaceType: 'independent',
    limits: {
      maxSeats: 1,
      maxActiveProjects: null,
      maxWorkflows: null,
      historyDays: null,
      maxInvoicesPerMonth: null,
      maxMeetingsPerMonth: null,
      analyticsTier: 'unlimited',
    },
    features: [
      'Unlimited projects',
      'Unlimited workflows',
      'Unlimited usage for covered features',
      '1 user workspace',
      'Unlimited history retention',
      'Advanced telemetry and analytics',
      'Priority support',
    ],
    pricing: {
      monthly: {
        priceInr: 599,
        pricePaise: 59900,
        razorpayPlanId: process.env.RAZORPAY_PLAN_FREELANCER_PRO_MONTHLY,
      },
    },
  },

  // ── Organization Plans ──
  business_free: {
    tier: 'business_free',
    name: 'Business Free',
    tagline: 'Team collaboration workspace for small startup founding squads',
    workspaceType: 'organization',
    limits: {
      maxSeats: 3, // Maximum 3 members, including the owner
      maxActiveProjects: 5,
      maxWorkflows: 3,
      historyDays: 7,
      maxInvoicesPerMonth: 25,
      maxMeetingsPerMonth: 25,
      analyticsTier: 'basic',
    },
    features: [
      'Maximum 5 projects',
      'Maximum 3 workflows',
      'Maximum 3 members, including the owner',
      '7-day history',
      'Standard team workspace & channels',
      'Standard community support',
    ],
    pricing: {
      monthly: {
        priceInr: 0,
        pricePaise: 0,
      },
    },
  },

  business_starter: {
    tier: 'business_starter',
    name: 'Business Starter',
    tagline: 'Collaborative operating workbench for agile teams and growing agencies',
    workspaceType: 'organization',
    limits: {
      maxSeats: 5, // Maximum 5 members
      maxActiveProjects: 25,
      maxWorkflows: 15,
      historyDays: 30,
      maxInvoicesPerMonth: 150,
      maxMeetingsPerMonth: 100,
      analyticsTier: 'standard',
    },
    features: [
      'Maximum 25 projects',
      'Maximum 15 workflows',
      'Maximum 5 members',
      '30-day history',
      'Role-based access controls (RBAC)',
      'Standard executive velocity reports',
      'Priority email & chat support',
    ],
    pricing: {
      monthly: {
        priceInr: 399,
        pricePaise: 39900,
        razorpayPlanId: process.env.RAZORPAY_PLAN_BUSINESS_STARTER_MONTHLY,
      },
    },
  },

  business_pro: {
    tier: 'business_pro',
    name: 'Business Pro',
    tagline: 'Uncapped velocity and enterprise governance without arbitrary limits',
    workspaceType: 'organization',
    limits: {
      maxSeats: null, // Unlimited team members
      maxActiveProjects: null, // Unlimited projects
      maxWorkflows: null, // Unlimited workflows
      historyDays: null, // Unlimited history
      maxInvoicesPerMonth: null, // Unlimited usage
      maxMeetingsPerMonth: null, // Unlimited usage
      analyticsTier: 'unlimited',
    },
    features: [
      'Unlimited projects',
      'Unlimited workflows',
      'Unlimited team members',
      'Unlimited usage for the features covered by the Pro subscription',
      'Unlimited audit log trails & compliance exports',
      'Dedicated 24/7 priority SLA support',
    ],
    pricing: {
      monthly: {
        priceInr: 499,
        pricePaise: 49900,
        razorpayPlanId: process.env.RAZORPAY_PLAN_BUSINESS_PRO_MONTHLY,
      },
    },
  },
};

// Legacy tier definitions for backward compatibility and test suites
SUBSCRIPTION_PLANS['freelancer'] = {
  tier: 'freelancer',
  name: 'Freelancer',
  tagline: 'Legacy individual workspace',
  workspaceType: 'independent',
  limits: {
    maxSeats: 1,
    maxActiveProjects: 5,
    maxWorkflows: 3,
    historyDays: 7,
    maxInvoicesPerMonth: 15,
    maxMeetingsPerMonth: 20,
    analyticsTier: 'basic',
  },
  features: [
    'Maximum 5 projects',
    'Maximum 3 workflows',
    '1 user workspace',
    '7-day history',
    '15 invoices / month',
    '20 meetings / month',
  ],
  pricing: {
    monthly: {
      priceInr: 0,
      pricePaise: 0,
    },
  },
};

SUBSCRIPTION_PLANS['starter'] = {
  tier: 'starter',
  name: 'Starter',
  tagline: 'Legacy team workspace',
  workspaceType: 'organization',
  limits: {
    maxSeats: 5,
    maxActiveProjects: 25,
    maxWorkflows: 15,
    historyDays: 30,
    maxInvoicesPerMonth: 100,
    maxMeetingsPerMonth: 100,
    analyticsTier: 'standard',
  },
  features: [
    'Maximum 25 projects',
    'Maximum 15 workflows',
    '5 members',
    '30-day history',
    '100 invoices / month',
    '100 meetings / month',
  ],
  pricing: {
    monthly: {
      priceInr: 399,
      pricePaise: 39900,
    },
  },
};

SUBSCRIPTION_PLANS['pro'] = {
  tier: 'pro',
  name: 'Pro',
  tagline: 'Legacy uncapped pro workspace',
  workspaceType: 'organization',
  limits: {
    maxSeats: null,
    maxActiveProjects: null,
    maxWorkflows: null,
    historyDays: null,
    maxInvoicesPerMonth: null,
    maxMeetingsPerMonth: null,
    analyticsTier: 'unlimited',
  },
  features: [
    'Unlimited projects',
    'Unlimited workflows',
    'Unlimited seats',
    'Unlimited history',
    'Unlimited invoices',
    'Unlimited meetings',
  ],
  pricing: {
    monthly: {
      priceInr: 499,
      pricePaise: 49900,
    },
  },
};

export const GRACE_PERIOD_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS || '3', 10);

export function normalizePlanTier(tier: string): PlanTier {
  const norm = (tier || '').toLowerCase().trim();
  if (norm === 'freelancer') return 'freelancer_starter';
  if (norm === 'starter') return 'business_starter';
  if (norm === 'pro') return 'business_pro';
  if (norm in SUBSCRIPTION_PLANS) return norm as PlanTier;
  return 'freelancer_free';
}

export function isFreelancerPlan(tier: string): boolean {
  const t = normalizePlanTier(tier);
  return t.startsWith('freelancer');
}

export function isOrganizationPlan(tier: string): boolean {
  const t = normalizePlanTier(tier);
  return t.startsWith('business') || t === 'business_starter' || t === 'business_pro' || t === 'business_free';
}

export function getPlanConfig(tier: string, interval: string = 'monthly'): {
  tier: PlanTier;
  interval: BillingInterval;
  plan: PlanDefinition;
  pricing: PlanPricing;
  planKey: string;
} | null {
  const normTier = normalizePlanTier(tier);
  const normInterval = 'monthly';

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

export function getAllPlansList(filterWorkspace?: 'independent' | 'organization') {
  const canonicalKeys = [
    'freelancer_free',
    'freelancer_starter',
    'freelancer_pro',
    'business_free',
    'business_starter',
    'business_pro',
  ];

  return canonicalKeys
    .map((key) => SUBSCRIPTION_PLANS[key])
    .filter((p) => {
      if (!p) return false;
      if (filterWorkspace) return p.workspaceType === filterWorkspace;
      return true;
    })
    .map((p) => ({
      tier: p.tier,
      name: p.name,
      tagline: p.tagline,
      workspaceType: p.workspaceType,
      limits: p.limits,
      features: p.features,
      pricing: {
        monthly: {
          priceInr: p.pricing.monthly.priceInr,
          pricePaise: p.pricing.monthly.pricePaise,
          interval: 'monthly',
        },
      },
    }));
}

/**
 * Maps Razorpay provider subscription status to internal SubscriptionStatus.
 */
export function mapRazorpaySubscriptionStatus(
  rzpStatus: string,
  currentPeriodEnd?: string | number | null,
  isGracePeriodActive: boolean = true
): SubscriptionStatus {
  const norm = (rzpStatus || '').toLowerCase().trim();

  switch (norm) {
    case 'created':
    case 'authenticated':
      return 'pending';

    case 'active':
      return 'active';

    case 'pending':
      // Razorpay 'pending' means a recurring debit attempt failed and retry is pending
      return isGracePeriodActive ? 'past_due' : 'suspended';

    case 'halted':
      // Max retries exhausted
      return isGracePeriodActive ? 'past_due' : 'suspended';

    case 'cancelled': {
      if (currentPeriodEnd) {
        const endTime = typeof currentPeriodEnd === 'number' 
          ? (currentPeriodEnd > 1e11 ? currentPeriodEnd : currentPeriodEnd * 1000)
          : new Date(currentPeriodEnd).getTime();
        if (endTime > Date.now()) {
          return 'cancelled'; // Still in paid period
        }
      }
      return 'expired';
    }

    case 'completed':
    case 'expired':
      return 'expired';

    default:
      return 'pending';
  }
}

/**
 * Maps Razorpay provider payment status to internal PaymentStatus.
 */
export function mapRazorpayPaymentStatus(
  rzpStatus: string,
  amountRefunded?: number,
  totalAmount?: number
): PaymentStatus {
  const norm = (rzpStatus || '').toLowerCase().trim();

  switch (norm) {
    case 'created':
      return 'created';

    case 'authorized':
      return 'pending';

    case 'captured':
    case 'paid':
      return 'paid';

    case 'failed':
      return 'failed';

    case 'refunded': {
      if (amountRefunded && totalAmount && amountRefunded < totalAmount) {
        return 'partially_refunded';
      }
      return 'refunded';
    }

    default:
      return 'pending';
  }
}
