import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  CreditCard,
  Clock,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
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
    priceMonthly: 999,
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
    priceMonthly: 2499,
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
  const [searchParams] = useSearchParams();
  const { session, user, accountType, role: userRole } = useAuth();
  const { orgId, orgName, membershipRole, canManageBilling, isOwner } = useWorkspace();

  // Active Plan View: resolved strictly by authenticated account type
  const isFreelancerAccount = accountType === 'freelancer' || (!orgId && !accountType);
  const isOrganizationAccount = accountType === 'organization' || !!orgId;

  // For unauthenticated visitors, allow tab toggle. For logged-in users, lock to their account type.
  const [publicCategoryTab, setPublicCategoryTab] = useState<PlanCategory>('freelancer');
  const activeCategory: PlanCategory = session?.user?.id 
    ? (isOrganizationAccount ? 'organization' : 'freelancer')
    : publicCategoryTab;

  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active subscription check
  const [currentSubscription, setCurrentSubscription] = useState<any | null>(null);
  const [activePlanTier, setActivePlanTier] = useState<string>('freelancer_free');
  const [activePlanStatus, setActivePlanStatus] = useState<string>('free');

  // Confirmation screen state
  const [confirmationData, setConfirmationData] = useState<{
    tier: string;
    planName: string;
    subscriptionId?: string;
    amount: number;
    currentPeriodEnd?: string;
  } | null>(null);

  // Live Usage Report & Quotas
  const [usageReport, setUsageReport] = useState<any | null>(null);

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

      const [subRes, usageRes] = await Promise.all([
        fetch(`${apiUrl}/subscriptions/current${targetOrgId ? `?orgId=${targetOrgId}` : ''}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(targetOrgId ? { 'x-organization-id': targetOrgId } : {}),
          },
        }),
        fetch(`${apiUrl}/subscriptions/usage${targetOrgId ? `?orgId=${targetOrgId}` : ''}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(targetOrgId ? { 'x-organization-id': targetOrgId } : {}),
          },
        }),
      ]);

      if (subRes.ok) {
        const data = await subRes.json();
        setActivePlanTier(data.tier || (isOrganizationAccount ? 'business_free' : 'freelancer_free'));
        setActivePlanStatus(data.status || 'free');
        if (data.hasActiveSubscription) {
          setCurrentSubscription(data.subscription);
        }
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsageReport(usageData);
      }
    } catch (e) {
      console.warn('Failed to load active subscription or usage:', e);
    }
  };

  useEffect(() => {
    fetchCurrentAndUsage();
  }, [session?.user?.id, orgId, accountType]);

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
        setConfirmationData({
          tier,
          planName: createData.planName,
          subscriptionId: createData.subscriptionId,
          amount: tier.includes('starter') ? (isOrgPlan ? 999 : 299) : (isOrgPlan ? 2499 : 599),
          currentPeriodEnd: createData.currentPeriodEnd,
        });
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

            setConfirmationData({
              tier,
              planName: createData.planName,
              subscriptionId: verifyPayload.razorpay_subscription_id,
              amount: createData.amountInr,
              currentPeriodEnd: verifyData.subscription?.current_period_end,
            });

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
    <div className="min-h-screen bg-[#07070A] text-zinc-100 flex flex-col justify-between selection:bg-[#FF6B4A]/30 font-sans relative overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-[#FF6B4A]/10 to-transparent blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/5 blur-[130px] rounded-full" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/[0.06]">
        <Link to="/" className="flex items-center gap-3">
          <AuvrynLogo className="h-8 w-auto text-[#FF6B4A]" />
          <span className="font-extrabold text-lg tracking-wider text-white">AUVRYN</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-400">
            Authoritative Plans
          </span>
        </Link>
        <div className="flex items-center gap-4 text-xs font-mono">
          {session?.user?.id ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white transition-colors"
            >
              Dashboard →
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-zinc-400 hover:text-white transition-colors">Sign In</Link>
              <Link to="/register" className="px-3.5 py-1.5 rounded-lg bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-semibold transition-colors">
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-400">
            <Shield size={12} className="text-[#FF6B4A]" />
            <span>Role-Based Governance · Transparent Billing</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            {activeCategory === 'organization' ? 'Organization Subscription Plans' : 'Freelancer Subscription Plans'}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
            {activeCategory === 'organization'
              ? 'Multi-member collaborative workbench for growing agencies, businesses, and enterprise teams.'
              : 'Independent operating architecture engineered for solo specialists, contractors, and consultants.'}
          </p>

          {/* Customer & Payer Context Indicator for Authenticated Users */}
          {session?.user?.id && (
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-xs font-mono text-zinc-300 mx-auto mt-4">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Customer Account:</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  {isOrganizationAccount ? <Building2 size={13} className="text-[#FF6B4A]" /> : <User size={13} className="text-emerald-400" />}
                  {isOrganizationAccount ? (orgName || 'Organization Workspace') : 'Freelancer Account'}
                </span>
              </div>
              <span className="hidden sm:inline text-zinc-600">|</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Current Plan:</span>
                <span className="font-semibold text-emerald-400 uppercase tracking-wider">{activePlanTier.replace(/_/g, ' ')}</span>
              </div>
              {isOrganizationAccount && (
                <>
                  <span className="hidden sm:inline text-zinc-600">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">Your Role:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      canManageBilling ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'
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
              <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <button
                  onClick={() => setPublicCategoryTab('freelancer')}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    publicCategoryTab === 'freelancer'
                      ? 'bg-[#FF6B4A] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Freelancer Plans (₹0 – ₹599)
                </button>
                <button
                  onClick={() => setPublicCategoryTab('organization')}
                  className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    publicCategoryTab === 'organization'
                      ? 'bg-[#FF6B4A] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Organization Plans (₹0 – ₹2,499)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Alerts & Messages */}
        {error && (
          <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs sm:text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-xs sm:text-sm">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Member Restricted Billing Notice */}
        {isOrganizationAccount && !canManageBilling && (
          <div className="max-w-3xl mx-auto mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start sm:items-center gap-3 text-amber-300 text-xs sm:text-sm">
            <Lock size={18} className="shrink-0 mt-0.5 sm:mt-0 text-amber-400" />
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
            const isPro = plan.tier.includes('pro');

            return (
              <div
                key={plan.tier}
                className={`rounded-2xl p-6 sm:p-8 border flex flex-col justify-between transition-all duration-300 relative ${
                  plan.isPopular
                    ? 'bg-gradient-to-b from-white/[0.06] to-white/[0.02] border-[#FF6B4A]/60 shadow-[0_0_35px_rgba(255,107,74,0.12)]'
                    : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.18]'
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
                    <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>
                    <p className="text-xs text-zinc-400 min-h-[32px] leading-relaxed">
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Pricing Display */}
                  <div className="mb-6 pb-6 border-b border-white/[0.08]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-white">
                        ₹{plan.priceMonthly.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">/ month</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-1">
                      {plan.priceMonthly === 0 ? 'No credit card required' : 'Billed monthly via Razorpay'}
                    </div>
                  </div>

                  {/* Key Quota Limits */}
                  <div className="space-y-2.5 mb-6 text-xs font-mono text-zinc-300">
                    <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                      <span className="text-zinc-500 flex items-center gap-1.5"><Users size={12} /> Seats:</span>
                      <span className="font-semibold text-white">{plan.limits.seats}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                      <span className="text-zinc-500 flex items-center gap-1.5"><Briefcase size={12} /> Projects:</span>
                      <span className="font-semibold text-white">{plan.limits.projects}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                      <span className="text-zinc-500 flex items-center gap-1.5"><Sparkles size={12} /> Workflows:</span>
                      <span className="font-semibold text-white">{plan.limits.workflows}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                      <span className="text-zinc-500 flex items-center gap-1.5"><Clock size={12} /> History:</span>
                      <span className="font-semibold text-white">{plan.limits.history}</span>
                    </div>
                  </div>

                  {/* Included Features List */}
                  <div className="space-y-2.5 text-xs text-zinc-400 mb-8">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
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
                          : 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1]'
                      }`}
                    >
                      <span>Sign Up to Get Started →</span>
                    </button>
                  ) : isCurrent ? (
                    <div className="w-full py-3 px-4 rounded-xl bg-white/[0.04] border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 size={14} />
                      <span>Current Active Plan</span>
                    </div>
                  ) : isOrganizationAccount && !canManageBilling ? (
                    <button
                      disabled
                      title="Only organization owner or billing administrator can purchase"
                      className="w-full py-3 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-600 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
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
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/[0.1]'
                          : plan.isPopular
                          ? 'bg-[#FF6B4A] hover:bg-[#FF552B] text-white shadow-lg shadow-[#FF6B4A]/25'
                          : 'bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.1]'
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
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-[#181824] via-[#121218] to-[#181824] border border-white/10 rounded-2xl p-8 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
          <div className="space-y-3 max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-zinc-400">
              <Code2 size={12} className="text-[#FF6B4A]" />
              <span>Bespoke Engineering Services</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Need Custom Architecture or Tailored Quotas?
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              For enterprises needing company-specific workflows, private cloud deployments, custom ERP sync rails, or bespoke modules. Skavelon Technologies provides custom architectural scoping and tailored quotations.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="px-6 py-3.5 bg-white text-zinc-900 hover:bg-zinc-200 font-bold text-xs rounded-xl transition-all shadow-[0_0_25px_rgba(255,255,255,0.2)] flex items-center gap-2 cursor-pointer"
            >
              <span>Contact Our Team →</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 px-6 bg-[#08080c] text-xs font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} AUVRYN by Skavelon Technologies.</span>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Support</Link>
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
