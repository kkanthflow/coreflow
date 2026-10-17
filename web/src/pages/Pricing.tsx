import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { openRazorpaySubscriptionCheckout } from '../lib/razorpay';
import ContactTeamModal from '../components/ContactTeamModal';
import AuvrynLogo from '../components/AuvrynLogo';

type BillingInterval = 'monthly' | 'yearly';
type PlanTier = 'freelancer' | 'starter' | 'pro';

// Catchy conversion-focused Auvryn CTA buttons
function getPlanCtaText(tier: PlanTier): string {
  switch (tier) {
    case 'freelancer':
      return 'Get Started →';
    case 'starter':
      return 'Grow with Auvryn →';
    case 'pro':
      return 'Unlock Auvryn Pro →';
    default:
      return 'Get Started →';
  }
}

interface PlanDetail {
  tier: PlanTier;
  name: string;
  tagline: string;
  badge?: string;
  isPopular?: boolean;
  priceMonthly: number;
  priceYearly: number;
  workspaceType: string;
  limits: {
    seats: string;
    invoices: string;
    projects: string;
    meetings: string;
    analytics: string;
  };
  features: string[];
}

const PLANS: PlanDetail[] = [
  {
    tier: 'freelancer',
    name: 'Freelancer',
    tagline: 'Individual workspace for solo specialists and consultants',
    priceMonthly: 299,
    priceYearly: 2990,
    workspaceType: 'Individual (1 User)',
    limits: {
      seats: '1 Workspace Member',
      invoices: '15 Invoices / month',
      projects: '5 Active Projects',
      meetings: '20 Meetings / month',
      analytics: 'Basic Telemetry',
    },
    features: [
      'Individual workspace for 1 user',
      'Configurable invoice quotas (15/mo)',
      'Active project limits (up to 5)',
      'Secure encrypted meetings (up to 20/mo)',
      'Basic analytics & revenue ledger',
      'Automated PDF invoice generation',
      'Standard community & email support',
    ],
  },
  {
    tier: 'starter',
    name: 'Business Starter',
    tagline: 'Team collaboration workspace for small agencies and growing teams',
    priceMonthly: 399,
    priceYearly: 3990,
    workspaceType: 'Organization (Up to 5 Users)',
    limits: {
      seats: 'Up to 5 Team Members',
      invoices: '100 Invoices / month',
      projects: '25 Active Projects',
      meetings: '100 Meetings / month',
      analytics: 'Standard Reports',
    },
    features: [
      'One organization workspace',
      'Up to 5 team members (seat limit)',
      'Higher invoice limits (100/mo)',
      'Up to 25 active concurrent projects',
      'Up to 100 meetings/month with recording',
      'Standard executive velocity analytics',
      'Role-based access control (Admin, Manager, Lead)',
      'Priority email & ticket support',
    ],
  },
  {
    tier: 'pro',
    name: 'Auvryn Pro',
    tagline: 'Uncapped velocity and enterprise governance without arbitrary limits',
    badge: 'MOST POPULAR',
    isPopular: true,
    priceMonthly: 499,
    priceYearly: 4990,
    workspaceType: 'Unlimited Seats',
    limits: {
      seats: 'No Fixed Seat Limit (Unlimited)',
      invoices: 'Unlimited Invoices',
      projects: 'Unlimited Projects',
      meetings: 'Unlimited Meetings',
      analytics: 'Unlimited Analytics & Reports',
    },
    features: [
      'Include all Freelancer & Starter features',
      'No fixed team-member seat limit',
      'Unlimited invoices & billing cycles',
      'Unlimited active projects & milestones',
      'Unlimited meetings with cloud recordings',
      'Unlimited telemetry, velocity & audit logs',
      'Multi-currency billing & custom payment rails',
      'Dedicated 24/7 priority SLA support',
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { orgId } = useWorkspace();

  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active subscription check
  const [currentSubscription, setCurrentSubscription] = useState<any | null>(null);

  // Confirmation screen state
  const [confirmationData, setConfirmationData] = useState<{
    tier: PlanTier;
    planName: string;
    subscriptionId: string;
    interval: string;
    amount: number;
    currentPeriodEnd?: string;
  } | null>(null);

  // Live Usage Report & Quotas
  const [usageReport, setUsageReport] = useState<{
    tier: PlanTier;
    planName: string;
    status: string;
    interval: string;
    period: {
      start: string;
      end: string;
      resetDate: string;
    };
    entitlements: {
      invoices: {
        allowed: boolean;
        current: number;
        limit: number | null;
        tier: PlanTier;
        resetDate?: string;
        remaining?: number | null;
        percent?: number;
        unlimited: boolean;
      };
      projects: {
        allowed: boolean;
        current: number;
        limit: number | null;
        tier: PlanTier;
        remaining?: number | null;
        percent?: number;
        unlimited: boolean;
      };
      meetings: {
        allowed: boolean;
        current: number;
        limit: number | null;
        tier: PlanTier;
        resetDate?: string;
        remaining?: number | null;
        percent?: number;
        unlimited: boolean;
      };
      seats: {
        allowed: boolean;
        current: number;
        limit: number | null;
        tier: PlanTier;
        remaining?: number | null;
        percent?: number;
        unlimited: boolean;
      };
    };
  } | null>(null);

  // Custom development modal
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const intervalParam = searchParams.get('interval') as BillingInterval | null;
    if (intervalParam === 'monthly' || intervalParam === 'yearly') {
      setInterval(intervalParam);
    }
    if (searchParams.get('inquiry') === 'true' || searchParams.get('contact') === 'true') {
      setIsContactModalOpen(true);
    }
  }, [searchParams]);

  const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : (import.meta.env.VITE_API_URL || 'http://localhost:3000/api');

  // Fetch current subscription status and live usage quotas if user is logged in
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchCurrentAndUsage = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;

        const [subRes, usageRes] = await Promise.all([
          fetch(`${apiUrl}/subscriptions/current`, {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(orgId ? { 'x-organization-id': orgId } : {}),
            },
          }),
          fetch(`${apiUrl}/subscriptions/usage`, {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(orgId ? { 'x-organization-id': orgId } : {}),
            },
          }),
        ]);

        if (subRes.ok) {
          const data = await subRes.json();
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

    fetchCurrentAndUsage();
  }, [session?.user?.id, orgId]);

  // Handle Checkout Flow
  // Handle Checkout Flow (Auto-Debit Subscription e-Mandate)
  const handleSubscribe = async (tier: PlanTier) => {
    setError(null);

    // If user is not authenticated, redirect to login with redirect back
    if (!session?.user?.id) {
      navigate(`/login?redirect=/pricing?plan=${tier}&interval=${interval}`);
      return;
    }

    setLoadingTier(tier);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const selectedPlan = PLANS.find(p => p.tier === tier);
      if (!selectedPlan) throw new Error('Invalid plan selected');

      // 1. Create subscription on backend via Razorpay Subscriptions API
      const createRes = await fetch(`${apiUrl}/subscriptions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tier,
          interval,
          orgId: tier === 'freelancer' ? null : orgId,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to initiate subscription');
      }

      // If user already active on this exact plan
      if (createData.alreadySubscribed) {
        setConfirmationData({
          tier,
          planName: createData.planName,
          subscriptionId: createData.subscriptionId,
          interval,
          amount: tier === 'freelancer' ? (interval === 'monthly' ? 299 : 2990) : (interval === 'monthly' ? 399 : 3990),
          currentPeriodEnd: createData.currentPeriodEnd,
        });
        setLoadingTier(null);
        return;
      }

      // 2. Open Razorpay Checkout Modal with subscription_id for e-mandate authorization
      await openRazorpaySubscriptionCheckout({
        key: createData.keyId,
        subscriptionId: createData.subscriptionId,
        name: 'Auvryn',
        description: `${createData.planName} (${interval.toUpperCase()})`,
        userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Auvryn Customer',
        userEmail: user?.email || '',
        themeColor: '#FF6B4A',
        onSuccess: async (rzpResponse) => {
          // 3. Verify signature on backend
          try {
            const verifyRes = await fetch(`${apiUrl}/subscriptions/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                subscriptionId: rzpResponse.razorpay_subscription_id,
                paymentId: rzpResponse.razorpay_payment_id,
                signature: rzpResponse.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment signature verification failed');
            }

            // Show Confirmation Screen
            setConfirmationData({
              tier,
              planName: createData.planName,
              subscriptionId: rzpResponse.razorpay_subscription_id,
              interval,
              amount: createData.amountInr,
              currentPeriodEnd: verifyData.subscription?.current_period_end,
            });
            setCurrentSubscription(verifyData.subscription);
          } catch (verifyErr: any) {
            setError(verifyErr.message || 'Verification failed. Please contact support.');
          } finally {
            setLoadingTier(null);
          }
        },
        onDismiss: () => {
          setLoadingTier(null);
        },
        onError: (rzpErr: any) => {
          const desc = rzpErr?.description || '';
          setError(desc || 'Payment was unsuccessful or cancelled.');
          setLoadingTier(null);
        },
      });
    } catch (err: any) {
      console.error('Subscription checkout error:', err);
      setError(err.message || 'Failed to start subscription checkout. Please try again.');
      setLoadingTier(null);
    }
  };

  // ── Confirmation Screen Render ──
  if (confirmationData) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col justify-between selection:bg-[#FF6B4A]/30 selection:text-white">
        <header className="border-b border-white/10 bg-[#0e0e15]/80 backdrop-blur-md px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center">
                <AuvrynLogo size={16} />
              </div>
              <span className="font-bold tracking-tight text-white">AUVRYN</span>
            </Link>
            <Link to="/dashboard" className="text-xs font-mono text-zinc-400 hover:text-white transition-colors">
              Return to Dashboard →
            </Link>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(52,211,153,0.2)]">
            <CheckCircle2 size={36} />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Subscription Activated & Verified</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Welcome to {confirmationData.planName}
          </h1>

          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Your Razorpay subscription has been confirmed and verified. Your workspace entitlements and quotas have been unlocked.
          </p>

          <div className="bg-[#121218] border border-white/10 rounded-xl p-6 text-left space-y-3.5 max-w-md mx-auto shadow-xl">
            <div className="flex justify-between text-xs pb-3 border-b border-white/10">
              <span className="text-zinc-400 font-mono">Plan Tier:</span>
              <span className="text-white font-bold">{confirmationData.planName}</span>
            </div>
            <div className="flex justify-between text-xs pb-3 border-b border-white/10">
              <span className="text-zinc-400 font-mono">Billing Interval:</span>
              <span className="text-white capitalize">{confirmationData.interval}</span>
            </div>
            <div className="flex justify-between text-xs pb-3 border-b border-white/10">
              <span className="text-zinc-400 font-mono">Settlement Amount:</span>
              <span className="text-[#FF6B4A] font-bold font-mono">₹{confirmationData.amount.toLocaleString()} / {confirmationData.interval === 'yearly' ? 'year' : 'month'}</span>
            </div>
            <div className="flex justify-between text-xs pb-3 border-b border-white/10">
              <span className="text-zinc-400 font-mono">Subscription Reference:</span>
              <span className="text-zinc-300 font-mono text-[11px] truncate max-w-[200px]">{confirmationData.subscriptionId}</span>
            </div>
            {confirmationData.currentPeriodEnd && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-mono">Next Renewal Date:</span>
                <span className="text-zinc-300 font-mono">
                  {new Date(confirmationData.currentPeriodEnd).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-8 py-3 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded-xl transition-all shadow-[0_0_20px_rgba(255,107,74,0.4)] flex items-center justify-center gap-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              to="/projects"
              className="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-mono rounded-xl transition-colors"
            >
              Create New Project
            </Link>
          </div>
        </main>

        <footer className="border-t border-white/10 py-6 text-center text-xs text-zinc-500 font-mono">
          AUVRYN Operating Architecture by Skavelon Technologies
        </footer>
      </div>
    );
  }

  // ── Standard Pricing Page Render ──
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-[#FF6B4A]/30 selection:text-white flex flex-col justify-between">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center">
              <AuvrynLogo size={16} />
            </div>
            <span className="text-white font-bold text-sm tracking-tight">AUVRYN</span>
          </Link>

          <div className="flex items-center gap-4">
            {session?.user?.id ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-[#FF6B4A]/15 hover:bg-[#FF6B4A]/25 border border-[#FF6B4A]/40 text-xs font-mono text-[#FF6B4A] rounded-lg transition-colors flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,107,74,0.2)]"
              >
                <span>← Back to Dashboard</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 rounded-lg transition-colors"
              >
                Sign In
              </Link>
            )}
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-400 hover:text-white rounded-lg transition-colors"
            >
              <Code2 size={13} className="text-[#FF6B4A]" />
              <span>Contact Team</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-20 px-4 sm:px-6 max-w-7xl mx-auto w-full space-y-16">
        
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 text-xs font-mono text-[#FF6B4A] shadow-sm">
            <Sparkles size={12} />
            <span>Transparent Scalable Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Plans built for solo execution <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B4A] via-white to-zinc-400">
              and unbounded enterprise scale.
            </span>
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Recurring subscription plans with seamless Razorpay integration, automated quotas, and zero artificial roadblocks.
          </p>

          {/* Monthly / Yearly Billing Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <div className="bg-[#121218] border border-white/10 rounded-xl p-1.5 flex items-center gap-1 shadow-lg">
              <button
                onClick={() => setInterval('monthly')}
                className={`px-5 py-2 rounded-lg text-xs font-mono font-semibold transition-all ${
                  interval === 'monthly'
                    ? 'bg-[#FF6B4A] text-white shadow-[0_0_15px_rgba(255,107,74,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setInterval('yearly')}
                className={`px-5 py-2 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
                  interval === 'yearly'
                    ? 'bg-[#FF6B4A] text-white shadow-[0_0_15px_rgba(255,107,74,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Save 2 Months
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="max-w-2xl mx-auto p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-xs text-rose-400">
            <AlertCircle size={18} className="shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Checkout Alert: </span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-zinc-400 hover:text-white text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Active Subscription & Live Usage Telemetry Dashboard */}
        {usageReport && (
          <div className="max-w-4xl mx-auto p-5 bg-[#14141e] border border-white/10 rounded-2xl shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-white/10 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <span className="text-white font-bold">Current Subscription: </span>
                  <span className="text-emerald-400 font-mono capitalize font-bold">{usageReport.planName} ({usageReport.interval || interval})</span>
                  {usageReport.period?.resetDate && (
                    <span className="text-zinc-400 ml-2 text-xs font-mono">
                      · Monthly quotas reset on {new Date(usageReport.period.resetDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to="/settings"
                className="text-xs font-mono text-zinc-300 hover:text-white underline underline-offset-4"
              >
                Manage in Settings →
              </Link>
            </div>

            {/* Live Usage Meters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              {/* Invoices Meter */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Invoices / Mo</span>
                  {usageReport.entitlements.invoices.unlimited ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Unlimited</span>
                  ) : usageReport.entitlements.invoices.percent! >= 100 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">100% Limit Reached</span>
                  ) : usageReport.entitlements.invoices.percent! >= 80 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">80%+ High Usage</span>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">{usageReport.entitlements.invoices.percent}%</span>
                  )}
                </div>
                <div className="text-sm font-bold text-white">
                  {usageReport.entitlements.invoices.unlimited
                    ? `${usageReport.entitlements.invoices.current} generated (Unlimited)`
                    : `${usageReport.entitlements.invoices.current} / ${usageReport.entitlements.invoices.limit} invoices used this month`}
                </div>
                {!usageReport.entitlements.invoices.unlimited && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        usageReport.entitlements.invoices.percent! >= 100
                          ? 'bg-rose-500'
                          : usageReport.entitlements.invoices.percent! >= 80
                          ? 'bg-amber-400'
                          : 'bg-[#FF6B4A]'
                      }`}
                      style={{ width: `${Math.min(100, usageReport.entitlements.invoices.percent || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Active Projects Meter */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Active Projects</span>
                  {usageReport.entitlements.projects.unlimited ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Unlimited</span>
                  ) : usageReport.entitlements.projects.percent! >= 100 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">100% Limit Reached</span>
                  ) : usageReport.entitlements.projects.percent! >= 80 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">80%+ High Usage</span>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">{usageReport.entitlements.projects.percent}%</span>
                  )}
                </div>
                <div className="text-sm font-bold text-white">
                  {usageReport.entitlements.projects.unlimited
                    ? `${usageReport.entitlements.projects.current} active (Unlimited)`
                    : `${usageReport.entitlements.projects.current} / ${usageReport.entitlements.projects.limit} active projects`}
                </div>
                {!usageReport.entitlements.projects.unlimited && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        usageReport.entitlements.projects.percent! >= 100
                          ? 'bg-rose-500'
                          : usageReport.entitlements.projects.percent! >= 80
                          ? 'bg-amber-400'
                          : 'bg-[#FF6B4A]'
                      }`}
                      style={{ width: `${Math.min(100, usageReport.entitlements.projects.percent || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Meetings Meter */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Meetings / Mo</span>
                  {usageReport.entitlements.meetings.unlimited ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Unlimited</span>
                  ) : usageReport.entitlements.meetings.percent! >= 100 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">100% Limit Reached</span>
                  ) : usageReport.entitlements.meetings.percent! >= 80 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">80%+ High Usage</span>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">{usageReport.entitlements.meetings.percent}%</span>
                  )}
                </div>
                <div className="text-sm font-bold text-white">
                  {usageReport.entitlements.meetings.unlimited
                    ? `${usageReport.entitlements.meetings.current} held (Unlimited)`
                    : `${usageReport.entitlements.meetings.current} / ${usageReport.entitlements.meetings.limit} meetings`}
                </div>
                {!usageReport.entitlements.meetings.unlimited && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        usageReport.entitlements.meetings.percent! >= 100
                          ? 'bg-rose-500'
                          : usageReport.entitlements.meetings.percent! >= 80
                          ? 'bg-amber-400'
                          : 'bg-[#FF6B4A]'
                      }`}
                      style={{ width: `${Math.min(100, usageReport.entitlements.meetings.percent || 0)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Team Seats Meter */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Team Seats</span>
                  {usageReport.entitlements.seats.unlimited ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Unlimited</span>
                  ) : usageReport.entitlements.seats.percent! >= 100 ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">Seat Limit</span>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">{usageReport.entitlements.seats.percent}%</span>
                  )}
                </div>
                <div className="text-sm font-bold text-white">
                  {usageReport.entitlements.seats.unlimited
                    ? `${usageReport.entitlements.seats.current} member(s) (Unlimited)`
                    : `${usageReport.entitlements.seats.current} / ${usageReport.entitlements.seats.limit} member(s)`}
                </div>
                {!usageReport.entitlements.seats.unlimited && (
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        usageReport.entitlements.seats.percent! >= 100
                          ? 'bg-rose-500'
                          : 'bg-[#FF6B4A]'
                      }`}
                      style={{ width: `${Math.min(100, usageReport.entitlements.seats.percent || 0)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {PLANS.map((plan) => {
            const isMonthly = interval === 'monthly';
            const price = isMonthly ? plan.priceMonthly : plan.priceYearly;
            const effectiveMonthly = isMonthly ? plan.priceMonthly : Math.round(plan.priceYearly / 12);
            const isCurrent = (currentSubscription?.plan_tier === plan.tier && currentSubscription?.status === 'active') ||
                              (!currentSubscription && usageReport?.tier === plan.tier);
            const isPro = plan.tier === 'pro';

            return (
              <div
                key={plan.tier}
                className={`relative rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                  plan.isPopular
                    ? 'bg-[#14141e] border-2 border-[#FF6B4A] shadow-[0_0_35px_rgba(255,107,74,0.25)]'
                    : 'bg-[#111118] border border-white/10 hover:border-white/20 shadow-xl'
                }`}
              >
                {/* Popular Ribbon */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#FF6B4A] text-white text-[10px] font-mono font-bold tracking-wider rounded-full shadow-[0_0_12px_#FF6B4A]">
                    {plan.badge}
                  </div>
                )}

                <div className="p-7 space-y-6">
                  {/* Title & Tagline */}
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">{plan.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1 min-h-[36px] leading-relaxed">{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="pt-2 pb-4 border-b border-white/10">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold font-mono text-white tracking-tight">
                        ₹{price.toLocaleString()}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        / {isMonthly ? 'month' : 'year'}
                      </span>
                    </div>

                    {!isMonthly && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                        <span>Equivalent to ₹{effectiveMonthly}/mo</span>
                        <span className="text-zinc-500">·</span>
                        <span>2 months free</span>
                      </div>
                    )}
                  </div>

                  {/* Core Limit Meters */}
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Workspace Seats:</span>
                      <span className={isPro ? 'text-emerald-400 font-bold' : isCurrent && usageReport ? (usageReport.entitlements.seats.percent! >= 100 ? 'text-rose-400 font-bold' : 'text-zinc-200') : 'text-zinc-300'}>
                        {isCurrent && usageReport && !isPro
                          ? `${usageReport.entitlements.seats.current} / ${plan.limits.seats}`
                          : plan.limits.seats}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Invoices Quota:</span>
                      <span className={isPro ? 'text-emerald-400 font-bold' : isCurrent && usageReport ? (usageReport.entitlements.invoices.percent! >= 100 ? 'text-rose-400 font-bold' : usageReport.entitlements.invoices.percent! >= 80 ? 'text-amber-400 font-bold' : 'text-zinc-200') : 'text-zinc-300'}>
                        {isCurrent && usageReport && !isPro
                          ? `${usageReport.entitlements.invoices.current} / ${usageReport.entitlements.invoices.limit} used`
                          : plan.limits.invoices}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Active Projects:</span>
                      <span className={isPro ? 'text-emerald-400 font-bold' : isCurrent && usageReport ? (usageReport.entitlements.projects.percent! >= 100 ? 'text-rose-400 font-bold' : usageReport.entitlements.projects.percent! >= 80 ? 'text-amber-400 font-bold' : 'text-zinc-200') : 'text-zinc-300'}>
                        {isCurrent && usageReport && !isPro
                          ? `${usageReport.entitlements.projects.current} / ${usageReport.entitlements.projects.limit} active`
                          : plan.limits.projects}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Meetings Quota:</span>
                      <span className={isPro ? 'text-emerald-400 font-bold' : isCurrent && usageReport ? (usageReport.entitlements.meetings.percent! >= 100 ? 'text-rose-400 font-bold' : usageReport.entitlements.meetings.percent! >= 80 ? 'text-amber-400 font-bold' : 'text-zinc-200') : 'text-zinc-300'}>
                        {isCurrent && usageReport && !isPro
                          ? `${usageReport.entitlements.meetings.current} / ${usageReport.entitlements.meetings.limit} held`
                          : plan.limits.meetings}
                      </span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block">
                      Included Entitlements
                    </span>
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                        <Check size={14} className="text-[#FF6B4A] shrink-0 mt-0.5" />
                        <span className="leading-snug">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Action */}
                <div className="p-7 pt-0 space-y-2">
                  <button
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={loadingTier !== null || isCurrent}
                    aria-label={isCurrent ? `Current Active Plan (${plan.name})` : `${getPlanCtaText(plan.tier)} for ${plan.name}`}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0d0d12] cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default focus:ring-emerald-500'
                        : plan.isPopular
                        ? 'bg-[#FF6B4A] hover:bg-[#FF552B] text-white shadow-[0_0_22px_rgba(255,107,74,0.4)] focus:ring-[#FF6B4A]'
                        : 'bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20 focus:ring-white/30'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {loadingTier === plan.tier ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Opening Checkout...</span>
                      </div>
                    ) : isCurrent ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Current Active Plan</span>
                      </>
                    ) : (
                      <span>{getPlanCtaText(plan.tier)}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix Table */}
        <div className="max-w-5xl mx-auto bg-[#111118] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/10">
            <h3 className="text-lg font-bold text-white tracking-tight">Detailed Plan Comparison</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Comprehensive quota matrix and capability specification.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] font-mono text-[11px] text-zinc-400 uppercase">
                  <th className="py-3 px-6">Capability / Metric</th>
                  <th className="py-3 px-6">Freelancer</th>
                  <th className="py-3 px-6">Business Starter</th>
                  <th className="py-3 px-6 text-[#FF6B4A]">Auvryn Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-zinc-300">
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Monthly Price</td>
                  <td className="py-3 px-6">₹299</td>
                  <td className="py-3 px-6">₹399</td>
                  <td className="py-3 px-6 text-[#FF6B4A] font-bold">₹499</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Yearly Price (2 Mo Free)</td>
                  <td className="py-3 px-6">₹2,990</td>
                  <td className="py-3 px-6">₹3,990</td>
                  <td className="py-3 px-6 text-[#FF6B4A] font-bold">₹4,990</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Workspace Type</td>
                  <td className="py-3 px-6">Individual</td>
                  <td className="py-3 px-6">Organization</td>
                  <td className="py-3 px-6 text-emerald-400 font-bold">Organization</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Workspace Team Seats</td>
                  <td className="py-3 px-6">1 User</td>
                  <td className="py-3 px-6">Up to 5 Users</td>
                  <td className="py-3 px-6 text-emerald-400 font-bold">Unlimited (No Fixed Cap)</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Invoices / Month</td>
                  <td className="py-3 px-6">15 Invoices</td>
                  <td className="py-3 px-6">100 Invoices</td>
                  <td className="py-3 px-6 text-emerald-400 font-bold">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Active Projects</td>
                  <td className="py-3 px-6">5 Projects</td>
                  <td className="py-3 px-6">25 Projects</td>
                  <td className="py-3 px-6 text-emerald-400 font-bold">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Meetings / Month</td>
                  <td className="py-3 px-6">20 Meetings</td>
                  <td className="py-3 px-6">100 Meetings</td>
                  <td className="py-3 px-6 text-emerald-400 font-bold">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Analytics Depth</td>
                  <td className="py-3 px-6">Basic Telemetry</td>
                  <td className="py-3 px-6">Standard Velocity</td>
                  <td className="py-3 px-6 text-emerald-400 font-bold">Unlimited Deep Reports</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Role-Based Access (RBAC)</td>
                  <td className="py-3 px-6 text-zinc-500">—</td>
                  <td className="py-3 px-6 text-emerald-400">Included</td>
                  <td className="py-3 px-6 text-emerald-400 font-bold">Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-sans text-white font-semibold">Security & Encryption</td>
                  <td className="py-3 px-6">NIST P-256 E2EE</td>
                  <td className="py-3 px-6">NIST P-256 E2EE</td>
                  <td className="py-3 px-6 text-[#FF6B4A] font-bold">NIST P-256 + Audit Trails</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Custom Development Banner (Section 7) */}
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-[#181824] via-[#121218] to-[#181824] border border-white/10 rounded-2xl p-8 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-zinc-400">
              <Code2 size={12} className="text-[#FF6B4A]" />
              <span>Bespoke Engineering Services</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Need Custom Architecture or Specialized Integrations?
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              For enterprises needing company-specific workflows, private cloud deployments, custom ERP sync rails, or bespoke modules. Skavelon Technologies provides custom architectural scoping and tailored quotations.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setIsContactModalOpen(true)}
              aria-label="Contact Our Team for Custom Development"
              className="px-6 py-3.5 bg-white text-zinc-900 hover:bg-zinc-200 font-bold text-xs rounded-xl transition-all shadow-[0_0_25px_rgba(255,255,255,0.2)] flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#181824] focus:ring-white"
            >
              <span>Contact Our Team →</span>
            </button>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 px-6 bg-[#08080c] text-xs font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span>© 2026 AUVRYN by Skavelon Technologies.</span>
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
