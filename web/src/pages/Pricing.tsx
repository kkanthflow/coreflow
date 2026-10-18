import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Code2,
  Shield,
  Lock,
  Building2,
  User,
  Users,
  Clock,
  Briefcase,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { openRazorpaySubscriptionCheckout } from '../lib/razorpay';
import ContactTeamModal from '../components/ContactTeamModal';
import AuvrynLogo from '../components/AuvrynLogo';

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

export default function Pricing() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { session, user, accountType } = useAuth();
  const { orgId, orgName, membershipRole, canManageBilling } = useWorkspace();

  // Active Plan View: resolved strictly by authenticated account type
  const isOrganizationAccount = accountType === 'organization' || !!orgId;
  const isFreelancerAccount = accountType === 'freelancer';

  // For unauthenticated or setup-pending users, allow tab toggle. For logged-in users with established account types, lock to their account type.
  const [publicCategoryTab, setPublicCategoryTab] = useState<PlanCategory>('freelancer');
  const activeCategory: PlanCategory = session?.user?.id && (isOrganizationAccount || isFreelancerAccount)
    ? (isOrganizationAccount ? 'organization' : 'freelancer')
    : publicCategoryTab;

  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active subscription check
  const [activePlanTier, setActivePlanTier] = useState<string>(() => isOrganizationAccount ? 'business_free' : 'freelancer_free');
  const [activePlanStatus, setActivePlanStatus] = useState<string>('free');

  // Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : (import.meta.env.VITE_API_URL || 'http://localhost:3000/api');

  // Fetch current subscription and usage from server
  const fetchCurrentAndUsage = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const targetOrgId = isOrganizationAccount ? orgId : null;

      const subRes = await fetch(`${apiUrl}/subscriptions/current${targetOrgId ? `?orgId=${targetOrgId}` : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(targetOrgId ? { 'x-organization-id': targetOrgId } : {}),
        },
      });

      if (subRes.ok) {
        const data = await subRes.json();
        setActivePlanTier(data.tier || (isOrganizationAccount ? 'business_free' : 'freelancer_free'));
        setActivePlanStatus(data.status || 'free');
      }
    } catch (e) {
      console.warn('Failed to load active subscription or usage:', e);
    }
  };

  useEffect(() => {
    setActivePlanTier(isOrganizationAccount ? 'business_free' : 'freelancer_free');
    fetchCurrentAndUsage();
  }, [session?.user?.id, orgId, accountType, isOrganizationAccount]);

  // Handle Checkout / Upgrade
  const handleSubscribe = async (tier: string) => {
    setError(null);
    setSuccessMessage(null);

    // If user is not authenticated, redirect to sign up
    if (!session?.user?.id) {
      navigate(`/register`);
      return;
    }

    // RBAC Member Check: If in organization workspace and lacks billing permission, reject
    if (isOrganizationAccount && !canManageBilling) {
      setError('Contact your organization owner or billing administrator to manage your subscription.');
      return;
    }

    setLoadingTier(tier);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const isOrgPlan = tier.startsWith('business');
      const targetOrgId = isOrgPlan ? orgId : null;

      if (isOrgPlan && !targetOrgId) {
        throw new Error('An active Organization workspace is required to select a Business plan.');
      }

      // 1. Create or activate subscription on backend
      const createRes = await fetch(`${apiUrl}/subscriptions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tier,
          interval: 'monthly',
          orgId: targetOrgId,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to initiate checkout.');
      }

      // Handle Free Plan Direct Activation (₹0)
      if (createData.isFreePlan) {
        setSuccessMessage(`${createData.planName} activated successfully.`);
        setActivePlanTier(tier);
        setActivePlanStatus('free');
        await fetchCurrentAndUsage();
        setLoadingTier(null);
        return;
      }

      // If user already active on this exact plan
      if (createData.alreadySubscribed) {
        setSuccessMessage(`You are already subscribed to ${createData.planName}.`);
        setLoadingTier(null);
        return;
      }

      // 2. Open official Razorpay Checkout modal for Paid Plans
      await openRazorpaySubscriptionCheckout({
        key: createData.keyId,
        subscriptionId: createData.subscriptionId,
        name: 'Auvryn Platform',
        description: `${createData.planName} Monthly Subscription`,
        userEmail: session.user.email,
        userName: user?.user_metadata?.full_name || 'Auvryn Customer',
        onSuccess: async (verifyPayload) => {
          try {
            const verifyRes = await fetch(`${apiUrl}/subscriptions/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_payment_id: verifyPayload.razorpay_payment_id,
                razorpay_subscription_id: verifyPayload.razorpay_subscription_id,
                razorpay_signature: verifyPayload.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment signature verification failed.');
            }

            setSuccessMessage(`Payment successful! You are now subscribed to ${createData.planName}.`);
            setActivePlanTier(tier);
            setActivePlanStatus('active');
            await fetchCurrentAndUsage();
          } catch (verErr: any) {
            setError(verErr.message || 'Payment verified signature mismatch. Please contact support.');
          } finally {
            setLoadingTier(null);
          }
        },
        onDismiss: () => {
          setLoadingTier(null);
        },
        onError: (err) => {
          setError(err?.description || 'Checkout session was interrupted.');
          setLoadingTier(null);
        },
      });

    } catch (err: any) {
      console.error('Subscription error:', err);
      setError(err.message || 'Failed to initiate subscription.');
      setLoadingTier(null);
    }
  };

  // Applicable plans list strictly segregated
  const displayedPlans = activeCategory === 'organization' ? ORGANIZATION_PLANS : FREELANCER_PLANS;

  return (
    <div className="min-h-screen bg-app text-main flex flex-col justify-between selection:bg-[#FF6B4A]/30 font-sans relative overflow-x-hidden transition-colors duration-200">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-[#FF6B4A]/10 to-transparent blur-[150px] rounded-full dark:opacity-80 opacity-35" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 blur-[130px] rounded-full dark:opacity-80 opacity-20" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-divider bg-card-bg/40 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-3">
          <AuvrynLogo className="h-8 w-auto text-[#FF6B4A]" />
          <span className="font-extrabold text-lg tracking-wider text-main">AUVRYN</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-hover/70 border border-divider text-muted">
            Authoritative Plans
          </span>
        </Link>
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Quick Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light or dark theme"
            className="p-2 rounded-lg bg-card-bg hover:bg-hover border border-divider text-muted hover:text-main transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
            <span className="hidden sm:inline capitalize text-[11px]">{theme}</span>
          </button>

          {session?.user?.id ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg bg-card-bg hover:bg-hover border border-divider text-main transition-colors shadow-sm font-semibold"
            >
              Dashboard →
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-muted hover:text-main transition-colors font-medium">Sign In</Link>
              <Link to="/register" className="px-3.5 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold transition-colors shadow-md">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Title Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card-bg border border-divider text-xs font-mono text-muted shadow-sm">
            <Shield size={12} className="text-[#FF6B4A]" />
            <span>Role-Based Governance · Transparent Billing</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-main">
            {activeCategory === 'organization' ? 'Organization Subscription Plans' : 'Freelancer Subscription Plans'}
          </h1>
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto">
            {activeCategory === 'organization'
              ? 'Multi-member collaborative workbench for growing agencies, businesses, and enterprise teams.'
              : 'Independent operating architecture engineered for solo specialists, contractors, and consultants.'}
          </p>

          {/* Customer & Payer Context Indicator for Authenticated Users */}
          {session?.user?.id && (
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-3 rounded-xl bg-card-bg border border-divider text-xs font-mono text-main shadow-sm mx-auto mt-4">
              <div className="flex items-center gap-2">
                <span className="text-muted">Customer Account:</span>
                <span className="font-bold text-main flex items-center gap-1.5">
                  {isOrganizationAccount ? <Building2 size={13} className="text-[#FF6B4A]" /> : <User size={13} className="text-emerald-500" />}
                  {isOrganizationAccount ? (orgName || 'Organization Workspace') : 'Freelancer Account'}
                </span>
              </div>
              <span className="hidden sm:inline text-muted/40">|</span>
              <div className="flex items-center gap-2">
                <span className="text-muted">Current Plan:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  {activePlanTier.replace(/_/g, ' ')} ({activePlanStatus})
                </span>
              </div>
              {isOrganizationAccount && (
                <>
                  <span className="hidden sm:inline text-muted/40">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">Your Role:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      canManageBilling ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-hover text-muted border border-divider'
                    }`}>
                      {membershipRole || 'member'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Public Visitor Plan Suite Selector (Only rendered when unauthenticated) */}
          {!session?.user?.id && (
            <div className="flex justify-center mt-6">
              <div className="inline-flex p-1 rounded-xl bg-hover/60 border border-divider shadow-sm">
                <button
                  onClick={() => setPublicCategoryTab('freelancer')}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    publicCategoryTab === 'freelancer'
                      ? 'bg-[#FF6B4A] text-white shadow-md'
                      : 'text-muted hover:text-main'
                  }`}
                >
                  Freelancer Plans (₹0 – ₹599)
                </button>
                <button
                  onClick={() => setPublicCategoryTab('organization')}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    publicCategoryTab === 'organization'
                      ? 'bg-[#FF6B4A] text-white shadow-md'
                      : 'text-muted hover:text-main'
                  }`}
                >
                  Organization Plans (₹0 – ₹499)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Alerts & Messages */}
        {error && (
          <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-600 dark:text-red-400 text-xs sm:text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Member Restricted Billing Notice */}
        {isOrganizationAccount && !canManageBilling && (
          <div className="max-w-3xl mx-auto mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start sm:items-center gap-3 text-amber-700 dark:text-amber-300 text-xs sm:text-sm">
            <Lock size={18} className="shrink-0 mt-0.5 sm:mt-0 text-amber-500" />
            <div>
              <span className="font-semibold">Billing Actions Restricted: </span>
              <span>Contact your organization owner or billing administrator to manage your subscription.</span>
            </div>
          </div>
        )}

        {/* Plan Cards Grid (Strictly separated per account type) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
          {displayedPlans.map((plan) => {
            const isCurrent = activePlanTier === plan.tier;

            return (
              <div
                key={plan.tier}
                className={`rounded-2xl p-6 sm:p-8 border flex flex-col justify-between transition-all duration-300 relative ${
                  plan.isPopular
                    ? 'bg-card-bg border-[#FF6B4A] shadow-[0_4px_30px_rgba(255,107,74,0.15)] ring-1 ring-[#FF6B4A]/25'
                    : 'bg-card-bg border-divider hover:border-black/20 dark:hover:border-white/20 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Popular or Enterprise Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FF6B4A] text-[10px] font-mono font-bold tracking-wider text-white uppercase shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div>
                  {/* Header */}
                  <div className="space-y-2 mb-6">
                    <h3 className="text-xl font-extrabold text-main">{plan.name}</h3>
                    <p className="text-xs text-muted min-h-[32px] leading-relaxed">
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Pricing Display */}
                  <div className="mb-6 pb-6 border-b border-divider">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-main tabular-nums">
                        ₹{plan.priceMonthly.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-muted font-mono">/ month</span>
                    </div>
                    <div className="text-[11px] text-muted font-mono mt-1">
                      {plan.priceMonthly === 0 ? 'No credit card required' : 'Billed monthly via Razorpay'}
                    </div>
                  </div>

                  {/* Key Quota Limits */}
                  <div className="space-y-2.5 mb-6 text-xs font-mono text-muted">
                    <div className="flex items-center justify-between py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5"><Users size={12} className="text-[#FF6B4A]" /> Seats:</span>
                      <span className="font-semibold text-main">{plan.limits.seats}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5"><Briefcase size={12} className="text-[#FF6B4A]" /> Projects:</span>
                      <span className="font-semibold text-main">{plan.limits.projects}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5"><Sparkles size={12} className="text-[#FF6B4A]" /> Workflows:</span>
                      <span className="font-semibold text-main">{plan.limits.workflows}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-divider/60">
                      <span className="flex items-center gap-1.5"><Clock size={12} className="text-[#FF6B4A]" /> History:</span>
                      <span className="font-semibold text-main">{plan.limits.history}</span>
                    </div>
                  </div>

                  {/* Included Features List */}
                  <div className="space-y-2.5 text-xs text-muted mb-8">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <Check size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action CTA Button */}
                <div>
                  {!session?.user?.id ? (
                    <button
                      onClick={() => navigate('/register')}
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        plan.isPopular
                          ? 'bg-[#FF6B4A] hover:bg-[#FF552B] text-white shadow-lg shadow-[#FF6B4A]/25'
                          : 'bg-hover hover:bg-black/10 dark:hover:bg-white/10 text-main border border-divider shadow-sm'
                      }`}
                    >
                      <span>Sign Up to Get Started →</span>
                    </button>
                  ) : isCurrent ? (
                    <div className="w-full py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 size={14} />
                      <span>Current Active Plan</span>
                    </div>
                  ) : isOrganizationAccount && !canManageBilling ? (
                    <button
                      disabled
                      title="Only organization owner or billing administrator can purchase"
                      className="w-full py-3 px-4 rounded-xl bg-hover border border-divider text-muted opacity-60 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Lock size={12} />
                      <span>Locked (Contact Owner)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.tier)}
                      disabled={loadingTier === plan.tier}
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        plan.priceMonthly === 0
                          ? 'bg-hover hover:bg-black/10 dark:hover:bg-white/10 text-main border border-divider shadow-sm'
                          : plan.isPopular
                          ? 'bg-[#FF6B4A] hover:bg-[#FF552B] text-white shadow-lg shadow-[#FF6B4A]/25'
                          : 'bg-[#FF6B4A]/10 hover:bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30'
                      }`}
                    >
                      {loadingTier === plan.tier ? (
                        <span>Processing...</span>
                      ) : (
                        <>
                          <span>{plan.priceMonthly === 0 ? 'Activate Free Plan' : `Upgrade to ${plan.name}`}</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Development Banner */}
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-orange-500/[0.04] via-card-bg to-orange-500/[0.08] dark:from-[#181824] dark:via-[#121218] dark:to-[#181824] border border-divider rounded-2xl p-8 sm:p-10 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
          <div className="space-y-3 max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hover/70 border border-divider text-[11px] font-mono text-muted">
              <Code2 size={12} className="text-[#FF6B4A]" />
              <span>Bespoke Engineering Services</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">
              Need Custom Architecture or Tailored Quotas?
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              For enterprises needing company-specific workflows, private cloud deployments, custom ERP sync rails, or bespoke modules. Skavelon Technologies provides custom architectural scoping and tailored quotations.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="px-6 py-3.5 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>Contact Our Team →</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-divider py-10 px-6 bg-app text-xs font-mono text-muted transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} AUVRYN by Skavelon Technologies.</span>
            <Link to="/terms" className="hover:text-main transition-colors">Terms</Link>
            <Link to="/privacy-policy" className="hover:text-main transition-colors">Privacy</Link>
            <Link to="/contact" className="hover:text-main transition-colors">Support</Link>
          </div>
          <span>Razorpay Subscriptions Gateway · INR (₹)</span>
        </div>
      </footer>

      {/* Contact Team Modal */}
      <ContactTeamModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </div>
  );
}
