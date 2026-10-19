export type PlanCategory = 'freelancer' | 'organization';

export interface PlanDetail {
  tier: string;
  name: string;
  tagline: string;
  badge?: string;
  isPopular?: boolean;
  priceMonthly: number;
  workspaceType: string;
  limits: {
    seats: string;
    projects: string;
    workflows: string;
    history: string;
  };
  features: string[];
}

// ── Freelancer Plans (Authoritative Limits & Pricing) ──
export const FREELANCER_PLANS: PlanDetail[] = [
  {
    tier: 'freelancer_free',
    name: 'Free',
    tagline: 'Individual workspace for solo specialists and consultants',
    priceMonthly: 0,
    workspaceType: 'Individual (1 User)',
    limits: {
      seats: '1 User',
      projects: 'Maximum 3 projects',
      workflows: 'Maximum 2 workflows',
      history: '7-day history',
    },
    features: [
      'Maximum 3 projects',
      'Maximum 2 workflows',
      '1 user workspace',
      '7-day history retention',
      'PDF invoice export & client portal',
      'Standard community support',
    ],
  },
  {
    tier: 'freelancer_starter',
    name: 'Starter',
    tagline: 'Expanded capacity for growing freelancers and solo practitioners',
    priceMonthly: 299,
    workspaceType: 'Individual (1 User)',
    limits: {
      seats: '1 User',
      projects: 'Maximum 10 projects',
      workflows: 'Maximum 5 workflows',
      history: '30-day history',
    },
    features: [
      'Maximum 10 projects',
      'Maximum 5 workflows',
      '1 user workspace',
      '30-day history retention',
      'Up to 50 invoices / month',
      'Basic revenue & task analytics',
      'Standard email support',
    ],
  },
  {
    tier: 'freelancer_pro',
    name: 'Pro',
    tagline: 'Uncapped individual operating environment with zero artificial limits',
    badge: 'MOST POPULAR',
    isPopular: true,
    priceMonthly: 599,
    workspaceType: 'Individual (1 User)',
    limits: {
      seats: '1 User',
      projects: 'Unlimited projects',
      workflows: 'Unlimited workflows',
      history: 'Unlimited history',
    },
    features: [
      'Unlimited projects',
      'Unlimited workflows',
      'Unlimited usage for covered features',
      '1 user workspace',
      'Unlimited history retention',
      'Deep telemetry & task analytics',
      '24/7 priority SLA support',
    ],
  },
];

// ── Organization Plans (Authoritative Limits & Pricing) ──
export const ORGANIZATION_PLANS: PlanDetail[] = [
  {
    tier: 'business_free',
    name: 'Business Free',
    tagline: 'Team collaboration workspace for small startup founding squads',
    priceMonthly: 0,
    workspaceType: 'Organization (Up to 3 Members)',
    limits: {
      seats: 'Max 3 members (inc. owner)',
      projects: 'Maximum 5 projects',
      workflows: 'Maximum 3 workflows',
      history: '7-day history',
    },
    features: [
      'Maximum 5 projects',
      'Maximum 3 workflows',
      'Maximum 3 members, including the owner',
      '7-day history retention',
      'Team workspace & channels',
      'Standard community support',
    ],
  },
  {
    tier: 'business_starter',
    name: 'Business Starter',
    tagline: 'Collaborative operating workbench for agile teams and growing agencies',
    priceMonthly: 399,
    workspaceType: 'Organization (Up to 5 Members)',
    limits: {
      seats: 'Maximum 5 members',
      projects: 'Maximum 25 projects',
      workflows: 'Maximum 15 workflows',
      history: '30-day history',
    },
    features: [
      'Maximum 25 projects',
      'Maximum 15 workflows',
      'Maximum 5 members',
      '30-day history retention',
      'Role-based access controls (RBAC)',
      'Executive velocity reports',
      'Priority email & chat support',
    ],
  },
  {
    tier: 'business_pro',
    name: 'Business Pro',
    tagline: 'Uncapped velocity and enterprise governance without arbitrary limits',
    badge: 'ENTERPRISE POWER',
    isPopular: true,
    priceMonthly: 499,
    workspaceType: 'Organization (Unlimited)',
    limits: {
      seats: 'Unlimited team members',
      projects: 'Unlimited projects',
      workflows: 'Unlimited workflows',
      history: 'Unlimited history',
    },
    features: [
      'Unlimited projects',
      'Unlimited workflows',
      'Unlimited team members',
      'Unlimited usage for covered features',
      'Unlimited audit log trails & compliance exports',
      'Dedicated 24/7 priority SLA support',
    ],
  },
];
