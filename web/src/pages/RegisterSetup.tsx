import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  User, 
  Building2, 
  Users2, 
  ArrowRight, 
  Check, 
  Loader2, 
  AlertCircle, 
  Search, 
  Clock, 
  RotateCw, 
  X, 
  LogOut, 
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import AuvrynLogo from '../components/AuvrynLogo';
import { JobTitleSelect } from '../components/ui/JobTitleSelect';

type SetupMode = 'freelancer' | 'create_org' | 'join_org' | null;

interface DiscoverableOrg {
  id: string;
  name: string;
  industry?: string | null;
  size_category?: string | null;
  logo_url?: string | null;
  member_count?: number;
  created_at?: string;
}

interface PendingJoinRequest {
  has_pending_request: boolean;
  request_id?: string;
  org_id?: string;
  org_name?: string;
  industry?: string | null;
  size_category?: string | null;
  status?: string;
  created_at?: string;
  job_title?: string | null;
}

export default function RegisterSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, fullName: authFullName, accountType, accountSetupCompleted, refreshUserDetails, signOut } = useAuth();

  // If already completed onboarding, redirect to dashboard
  useEffect(() => {
    if (accountSetupCompleted && accountType) {
      navigate('/dashboard', { replace: true });
    }
  }, [accountSetupCompleted, accountType, navigate]);

  // If not authenticated or stale session cleared, redirect to landing page
  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Check if current user has an active pending join request
  const [pendingRequest, setPendingRequest] = useState<PendingJoinRequest | null>(null);
  const [checkingPendingStatus, setCheckingPendingStatus] = useState<boolean>(true);
  const [refreshingStatus, setRefreshingStatus] = useState<boolean>(false);
  const [cancellingRequest, setCancellingRequest] = useState<boolean>(false);

  const checkJoinRequestStatus = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_user_join_request_status');
      if (!error && data?.has_pending_request) {
        setPendingRequest(data);
      } else {
        setPendingRequest(null);
      }
    } catch (err) {
      console.warn('[RegisterSetup] Error checking pending join request status:', err);
    } finally {
      setCheckingPendingStatus(false);
    }
  };

  useEffect(() => {
    checkJoinRequestStatus();
  }, [user?.id]);

  // Initial setup mode (UNSELECTED by default)
  const [selectedMode, setSelectedMode] = useState<SetupMode>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('join') === 'true' || searchParams.get('mode') === 'join_org') {
      return 'join_org';
    }
    return null;
  });

  const verifiedEmail = user?.email || (location.state as any)?.email || '';
  const initialName = (location.state as any)?.fullName 
    || user?.user_metadata?.full_name 
    || user?.user_metadata?.name 
    || authFullName 
    || (verifiedEmail ? verifiedEmail.split('@')[0] : '');

  // Form states
  const [fullName, setFullName] = useState(initialName);
  const [jobTitle, setJobTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [orgName, setOrgName] = useState((location.state as any)?.organization || '');
  const [currency, setCurrency] = useState('INR');

  // Searchable Organization states (Self-Service Joining)
  const [orgSearchQuery, setOrgSearchQuery] = useState('');
  const [orgSearchResults, setOrgSearchResults] = useState<DiscoverableOrg[]>([]);
  const [isSearchingOrgs, setIsSearchingOrgs] = useState(false);
  const [hasSearchedOrgs, setHasSearchedOrgs] = useState(false);
  const [selectedOrgToJoin, setSelectedOrgToJoin] = useState<DiscoverableOrg | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync auth full name or Google metadata when available
  useEffect(() => {
    if (!fullName) {
      const resolved = (location.state as any)?.fullName 
        || user?.user_metadata?.full_name 
        || user?.user_metadata?.name 
        || authFullName;
      if (resolved) setFullName(resolved);
    }
  }, [authFullName, user, location.state]);

  // Debounced organization search
  useEffect(() => {
    const query = orgSearchQuery.trim();
    if (query.length < 1) {
      setOrgSearchResults([]);
      setIsSearchingOrgs(false);
      setHasSearchedOrgs(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOrgs(true);
      setHasSearchedOrgs(true);
      try {
        const { data, error } = await supabase.rpc('search_discoverable_organizations', {
          p_query: query,
        });
        if (!error && data) {
          setOrgSearchResults(data);
        } else {
          setOrgSearchResults([]);
        }
      } catch (err) {
        console.warn('Search organization failed:', err);
        setOrgSearchResults([]);
      } finally {
        setIsSearchingOrgs(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [orgSearchQuery]);

  // Handle explicit Freelancer setup
  const handleFreelancerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    const skillArray = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('complete_freelancer_setup', {
        p_full_name: fullName.trim() || 'Freelancer',
        p_skills: skillArray,
        p_portfolio: portfolio.trim() || '',
      });

      if (!rpcErr && rpcData?.success) {
        await refreshUserDetails();
        navigate('/dashboard', { replace: true });
        return;
      }

      console.warn('[RegisterSetup] Freelancer RPC fallback:', rpcErr?.message);

      // Direct fallback
      const { error: userErr } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName.trim() || 'Freelancer',
          account_type: 'freelancer',
          role: 'freelancer',
          default_workspace_id: 'independent',
          account_setup_completed: true,
          current_plan_tier: 'freelancer_free',
          subscription_status: 'free',
        });

      if (userErr) throw userErr;

      await refreshUserDetails();
      sessionStorage.setItem('auvryn_just_signed_up', 'true');
      navigate('/dashboard', { replace: true, state: { fromSignUp: true } });
    } catch (err: any) {
      console.error('Freelancer setup failed:', err);
      setError(err.message || 'Failed to complete Freelancer registration.');
      setLoading(false);
    }
  };

  // Handle explicit Create Organization setup
  const handleCreateOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!orgName.trim()) {
      setError('Organization name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_organization_with_owner', {
        p_name: orgName.trim(),
        p_currency: currency || 'INR',
      });

      if (!rpcErr && rpcData) {
        await refreshUserDetails();
        sessionStorage.setItem('auvryn_just_signed_up', 'true');
        navigate('/dashboard', { replace: true, state: { fromSignUp: true } });
        return;
      }

      console.warn('[RegisterSetup] Create org RPC fallback:', rpcErr?.message);

      // Fallback
      const { error: userErr } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName.trim() || 'Organization Owner',
          account_type: 'organization',
          role: 'owner',
          account_setup_completed: false,
          current_plan_tier: 'business_free',
          subscription_status: 'free',
        });

      if (userErr) throw userErr;

      const { data: newOrg, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          owner_id: user.id,
          default_currency: currency,
          current_plan_tier: 'business_free',
          subscription_status: 'free',
        })
        .select()
        .single();

      if (orgErr || !newOrg) throw (orgErr || new Error('Failed to create organization record'));

      await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          org_id: newOrg.id,
          role: 'owner',
        });

      await supabase
        .from('users')
        .update({
          default_workspace_id: newOrg.id,
          account_setup_completed: true,
        })
        .eq('id', user.id);

      await refreshUserDetails();
      sessionStorage.setItem('auvryn_just_signed_up', 'true');
      navigate('/dashboard', { replace: true, state: { fromSignUp: true } });
    } catch (err: any) {
      console.error('Organization creation failed:', err);
      setError(err.message || 'Failed to complete organization setup.');
      setLoading(false);
    }
  };

  // Handle Self-Service Join Organization Submit
  const handleJoinOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!selectedOrgToJoin) {
      setError('Please search for and select your organization.');
      return;
    }
    if (!fullName.trim()) {
      setError('Your full name is required to submit a join request.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Update full name in public.users if changed
      await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      // Call atomic submit_join_request RPC
      const { data, error: rpcErr } = await supabase.rpc('submit_join_request', {
        p_org_id: selectedOrgToJoin.id,
        p_job_title: jobTitle.trim() || null,
        p_department_id: null,
      });

      if (rpcErr) throw rpcErr;

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to submit join request.');
      }

      // Successfully submitted or already pending
      setPendingRequest({
        has_pending_request: true,
        request_id: data.request_id,
        org_id: selectedOrgToJoin.id,
        org_name: data.org_name || selectedOrgToJoin.name,
        industry: selectedOrgToJoin.industry,
        size_category: selectedOrgToJoin.size_category,
        status: data.status || 'pending',
        created_at: new Date().toISOString(),
        job_title: jobTitle.trim() || null,
      });

      setSelectedOrgToJoin(null);
      setOrgSearchQuery('');
      setSuccessMessage('Join request submitted successfully. Awaiting management review.');
    } catch (err: any) {
      console.error('Join request submission failed:', err);
      setError(err.message || 'Failed to submit join request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Refresh approval status
  const handleRefreshStatus = async () => {
    setRefreshingStatus(true);
    setError(null);
    try {
      // 1. Refresh user details in useAuth
      await refreshUserDetails();

      // 2. Query public.users to see if approved
      const { data: userRecord } = await supabase
        .from('users')
        .select('account_setup_completed, default_workspace_id, role')
        .eq('id', user?.id)
        .maybeSingle();

      if (userRecord?.account_setup_completed && userRecord?.default_workspace_id) {
        // Approved! Redirect to dashboard
        navigate('/dashboard', { replace: true });
        return;
      }

      // 3. Otherwise re-check join request status
      const { data, error: rpcErr } = await supabase.rpc('get_user_join_request_status');
      if (!rpcErr && data) {
        if (data.has_pending_request) {
          setPendingRequest(data);
        } else {
          // No pending request left (e.g. was rejected or cancelled)
          setPendingRequest(null);
        }
      }
    } catch (err: any) {
      console.warn('Status refresh failed:', err);
    } finally {
      setRefreshingStatus(false);
    }
  };

  // Cancel own pending join request
  const handleCancelRequest = async () => {
    if (!pendingRequest?.request_id) return;
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel your join request? You can then search for another organization or choose a different workspace.'
    );
    if (!confirmCancel) return;

    setCancellingRequest(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('cancel_join_request', {
        p_request_id: pendingRequest.request_id,
      });

      if (rpcErr) throw rpcErr;

      if (data?.success) {
        setPendingRequest(null);
        setSelectedOrgToJoin(null);
        setOrgSearchQuery('');
        setSuccessMessage('Join request cancelled. You may search for another organization.');
      } else {
        throw new Error(data?.message || 'Failed to cancel join request.');
      }
    } catch (err: any) {
      console.error('Cancel join request failed:', err);
      setError(err.message || 'Failed to cancel join request.');
    } finally {
      setCancellingRequest(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070A] text-zinc-100 flex flex-col justify-between selection:bg-[#FF6B4A]/30 font-sans relative overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#FF6B4A]/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <AuvrynLogo className="h-8 w-auto text-[#FF6B4A]" />
          <span className="font-extrabold text-lg tracking-wider text-white">AUVRYN</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-zinc-400">
            Account Architecture
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-zinc-400 font-mono hidden sm:block">
            {pendingRequest?.has_pending_request ? 'Status: Verification Pending' : 'Step 2 of 2: Workspace Setup'}
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Sign out of current account"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-4xl mx-auto w-full my-6">
        
        {/* Loading state for pending status check */}
        {checkingPendingStatus ? (
          <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-[#FF6B4A]" />
            <p className="text-xs font-mono text-zinc-400">Verifying account & organization status...</p>
          </div>
        ) : pendingRequest?.has_pending_request ? (
          /* ═══════════════════════════════════════════════════════════════
             PENDING APPROVAL SCREEN
             ═══════════════════════════════════════════════════════════════ */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white/[0.03] border border-amber-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 relative overflow-hidden"
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#FF6B4A] to-amber-400" />

            {/* Status Pill */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>PENDING MANAGEMENT APPROVAL</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                {pendingRequest.created_at ? new Date(pendingRequest.created_at).toLocaleDateString() : 'Recent'}
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <Clock className="text-amber-400 shrink-0" size={24} />
                <span>Join Request Under Review</span>
              </h2>
              <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
                Your request to join <strong className="text-white font-semibold">{pendingRequest.org_name}</strong> has been securely routed to the company's authorized administrators and department managers.
              </p>
            </div>

            {/* Organization & Application Summary Card */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-[#FF6B4A] shrink-0">
                  <Building2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">{pendingRequest.org_name}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                    {pendingRequest.industry && <span>{pendingRequest.industry}</span>}
                    {pendingRequest.industry && pendingRequest.size_category && <span>•</span>}
                    {pendingRequest.size_category && <span>{pendingRequest.size_category} team</span>}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-mono block">Applicant</span>
                  <span className="text-zinc-200 font-medium">{fullName || verifiedEmail}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-mono block">Requested Role</span>
                  <span className="text-zinc-200 font-medium">{pendingRequest.job_title || 'Team Member'}</span>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-xs text-blue-300 leading-relaxed">
              <ShieldCheck size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-200 block font-semibold mb-0.5">RBAC Governance Protected</strong>
                Organization files, client projects, and internal channels remain restricted until an authorized manager approves your profile and assigns your official role.
              </div>
            </div>

            {/* Error or Alert Message if any */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-400">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleRefreshStatus}
                disabled={refreshingStatus}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF552B] hover:from-[#FF7A5C] hover:to-[#FF6B4A] disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-[#FF6B4A]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RotateCw size={14} className={refreshingStatus ? 'animate-spin' : ''} />
                <span>{refreshingStatus ? 'Checking Status...' : 'Check Approval Status'}</span>
              </button>

              <button
                onClick={handleCancelRequest}
                disabled={cancellingRequest}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.1] hover:border-red-500/30 text-zinc-400 hover:text-red-400 disabled:opacity-50 font-medium text-xs transition-all cursor-pointer"
              >
                {cancellingRequest ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          </motion.div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════
             NORMAL OPERATING ARCHITECTURE SELECTION
             ═══════════════════════════════════════════════════════════════ */
          <>
            <div className="text-center space-y-3 mb-8">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Choose Your Operating Architecture
              </h1>
              <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
                Select how you want to work on Auvryn. Your workspace, role permissions, and access governance will be configured accordingly.
              </p>
            </div>

            {error && (
              <div className="w-full max-w-2xl mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs sm:text-sm">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="w-full max-w-2xl mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-xs sm:text-sm">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Verified Authentication Identity Pill */}
            {verifiedEmail && (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-300 mb-6 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Authenticated: <strong className="text-white">{verifiedEmail}</strong></span>
                {fullName && (
                  <>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-400">{fullName}</span>
                  </>
                )}
              </div>
            )}

            {/* ── 3 Explicit Choices (Initial state: UNSELECTED) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mb-8">
              {/* Option A: Register Freelancer */}
              <div
                onClick={() => { setSelectedMode('freelancer'); setError(null); }}
                className={`cursor-pointer rounded-2xl p-6 border transition-all duration-200 relative flex flex-col justify-between ${
                  selectedMode === 'freelancer'
                    ? 'bg-[#FF6B4A]/[0.08] border-[#FF6B4A] shadow-[0_0_30px_rgba(255,107,74,0.15)] ring-1 ring-[#FF6B4A]'
                    : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.04]'
                }`}
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Register Freelancer</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      Individual workspace for solo specialists, consultants, and independent developers.
                    </p>
                  </div>
                  <ul className="text-xs text-zinc-400 space-y-2 pt-2 border-t border-white/[0.06]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" />
                      <span>1 User Workspace</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" />
                      <span>Client & Project Tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" />
                      <span>Freelancer Pricing (Free / Starter / Pro)</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold">
                  <span className={selectedMode === 'freelancer' ? 'text-[#FF6B4A]' : 'text-zinc-500'}>
                    {selectedMode === 'freelancer' ? 'Selected' : 'Select Freelancer'}
                  </span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedMode === 'freelancer' ? 'border-[#FF6B4A] bg-[#FF6B4A] text-white' : 'border-zinc-600'
                  }`}>
                    {selectedMode === 'freelancer' && <Check size={12} />}
                  </div>
                </div>
              </div>

              {/* Option B: Create Organization */}
              <div
                onClick={() => { setSelectedMode('create_org'); setError(null); }}
                className={`cursor-pointer rounded-2xl p-6 border transition-all duration-200 relative flex flex-col justify-between ${
                  selectedMode === 'create_org'
                    ? 'bg-[#FF6B4A]/[0.08] border-[#FF6B4A] shadow-[0_0_30px_rgba(255,107,74,0.15)] ring-1 ring-[#FF6B4A]'
                    : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.04]'
                }`}
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B4A]/20 to-[#FF6B4A]/5 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Create Organization</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      Dedicated company workbench for teams, startups, agencies, and businesses.
                    </p>
                  </div>
                  <ul className="text-xs text-zinc-400 space-y-2 pt-2 border-t border-white/[0.06]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#FF6B4A] shrink-0" />
                      <span>Multi-member Team Workspace</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#FF6B4A] shrink-0" />
                      <span>Owner & RBAC Governance</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-[#FF6B4A] shrink-0" />
                      <span>Business Plans & Centralized Billing</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold">
                  <span className={selectedMode === 'create_org' ? 'text-[#FF6B4A]' : 'text-zinc-500'}>
                    {selectedMode === 'create_org' ? 'Selected' : 'Select Create Organization'}
                  </span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedMode === 'create_org' ? 'border-[#FF6B4A] bg-[#FF6B4A] text-white' : 'border-zinc-600'
                  }`}>
                    {selectedMode === 'create_org' && <Check size={12} />}
                  </div>
                </div>
              </div>

              {/* Option C: Join Organization */}
              <div
                onClick={() => { setSelectedMode('join_org'); setError(null); }}
                className={`cursor-pointer rounded-2xl p-6 border transition-all duration-200 relative flex flex-col justify-between ${
                  selectedMode === 'join_org'
                    ? 'bg-[#FF6B4A]/[0.08] border-[#FF6B4A] shadow-[0_0_30px_rgba(255,107,74,0.15)] ring-1 ring-[#FF6B4A]'
                    : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.04]'
                }`}
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Users2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Join Organization</h3>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      Find your company by name and request to join. Management approves your access.
                    </p>
                  </div>
                  <ul className="text-xs text-zinc-400 space-y-2 pt-2 border-t border-white/[0.06]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-400 shrink-0" />
                      <span>Searchable Company Name</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-400 shrink-0" />
                      <span>No Org ID or Invite Code Needed</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-blue-400 shrink-0" />
                      <span>Role & Department Assigned by Manager</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold">
                  <span className={selectedMode === 'join_org' ? 'text-[#FF6B4A]' : 'text-zinc-500'}>
                    {selectedMode === 'join_org' ? 'Selected' : 'Select Join Organization'}
                  </span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    selectedMode === 'join_org' ? 'border-[#FF6B4A] bg-[#FF6B4A] text-white' : 'border-zinc-600'
                  }`}>
                    {selectedMode === 'join_org' && <Check size={12} />}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Active Step Form (Rendered only after selection) ── */}
            <AnimatePresence mode="wait">
              {selectedMode === 'freelancer' && (
                <motion.form
                  key="freelancer_form"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleFreelancerSubmit}
                  className="w-full max-w-xl bg-white/[0.03] border border-white/[0.1] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-5"
                >
                  <div className="border-b border-white/[0.08] pb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <User size={20} className="text-emerald-400" />
                      Complete Freelancer Profile
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      You'll be provisioned a dedicated individual workspace with Free Freelancer tier limits.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Your Full Name <span className="text-[#FF6B4A]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Professional Title / Specialization
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Full-Stack Engineer, UI Designer"
                      className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Primary Skills (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="e.g. React, Node.js, TypeScript, PostgreSQL"
                      className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Portfolio or Website (Optional)
                    </label>
                    <input
                      type="url"
                      value={portfolio}
                      onChange={(e) => setPortfolio(e.target.value)}
                      placeholder="https://yourportfolio.com"
                      className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={loading || !fullName.trim()}
                      className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <>Complete Freelancer Setup <ArrowRight size={16} /></>}
                    </button>
                  </div>
                </motion.form>
              )}

              {selectedMode === 'create_org' && (
                <motion.form
                  key="create_org_form"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleCreateOrgSubmit}
                  className="w-full max-w-xl bg-white/[0.03] border border-white/[0.1] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-5"
                >
                  <div className="border-b border-white/[0.08] pb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Building2 size={20} className="text-[#FF6B4A]" />
                      Create Business Organization
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      You will be assigned as the Organization Owner with full administrative and billing governance.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Organization / Company Name <span className="text-[#FF6B4A]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Acme Corp or Stellar Labs"
                      className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Your Full Name <span className="text-[#FF6B4A]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                        Your Executive Title
                      </label>
                      <JobTitleSelect
                        value={jobTitle || 'Founder'}
                        onChange={(val) => setJobTitle(val)}
                        placeholder="Select your executive title..."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                        Operating Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-[#121217] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                      >
                        <option value="INR">INR (₹) - Indian Rupee</option>
                        <option value="USD">USD ($) - US Dollar</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={loading || !orgName.trim() || !fullName.trim()}
                      className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF552B] hover:from-[#FF7A5C] hover:to-[#FF6B4A] disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-[#FF6B4A]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <>Create Organization & Proceed <ArrowRight size={16} /></>}
                    </button>
                  </div>
                </motion.form>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  OPTION C: SELF-SERVICE JOIN WORKFLOW (Search by Org Name)
                  ═══════════════════════════════════════════════════════════════ */}
              {selectedMode === 'join_org' && (
                <motion.form
                  key="join_org_form"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleJoinOrgSubmit}
                  className="w-full max-w-xl bg-white/[0.03] border border-white/[0.1] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-5"
                >
                  <div className="border-b border-white/[0.08] pb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Users2 size={20} className="text-blue-400" />
                      Join Your Organization
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Search for your company by name to request access. Your company's management will review and assign your role.
                    </p>
                  </div>

                  {/* 1. Searchable Organization Field */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      Organization Name <span className="text-[#FF6B4A]">*</span>
                    </label>

                    {selectedOrgToJoin ? (
                      /* Selected Organization Preview Pill */
                      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                            <Building2 size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                              <span>{selectedOrgToJoin.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Selected</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {selectedOrgToJoin.industry ? `${selectedOrgToJoin.industry} • ` : ''}
                              {selectedOrgToJoin.member_count !== undefined ? `${selectedOrgToJoin.member_count} team members` : 'Active Workspace'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedOrgToJoin(null); setOrgSearchQuery(''); }}
                          className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      /* Search Input & Live Results */
                      <div className="relative">
                        <div className="relative">
                          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="text"
                            value={orgSearchQuery}
                            onChange={(e) => setOrgSearchQuery(e.target.value)}
                            placeholder="Type to search company name (e.g. Acme, Coreflow)..."
                            className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-blue-500 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                          />
                          {isSearchingOrgs ? (
                            <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-blue-400" />
                          ) : orgSearchQuery ? (
                            <button
                              type="button"
                              onClick={() => { setOrgSearchQuery(''); setOrgSearchResults([]); }}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          ) : null}
                        </div>

                        {/* Search Results Dropdown / List */}
                        {orgSearchQuery.trim().length > 0 && (
                          <div className="mt-2 max-h-52 overflow-y-auto rounded-xl bg-[#0F0F14] border border-white/[0.1] shadow-xl divide-y divide-white/[0.05]">
                            {orgSearchResults.length > 0 ? (
                              orgSearchResults.map((org) => (
                                <div
                                  key={org.id}
                                  onClick={() => {
                                    setSelectedOrgToJoin(org);
                                    setOrgSearchQuery('');
                                    setOrgSearchResults([]);
                                    setError(null);
                                  }}
                                  className="p-3 hover:bg-white/[0.05] cursor-pointer flex items-center justify-between transition-colors group"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors shrink-0">
                                      <Building2 size={15} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                                        {org.name}
                                      </div>
                                      <div className="text-[10px] text-zinc-500 flex items-center gap-2 truncate">
                                        {org.industry && <span>{org.industry}</span>}
                                        {org.industry && <span>•</span>}
                                        <span>{org.member_count !== undefined ? `${org.member_count} members` : 'Organization'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-mono text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1">
                                    Select <ArrowRight size={11} />
                                  </span>
                                </div>
                              ))
                            ) : !isSearchingOrgs && hasSearchedOrgs ? (
                              <div className="p-4 text-center space-y-1">
                                <p className="text-xs text-zinc-400 font-medium">
                                  No organizations found matching "{orgSearchQuery}".
                                </p>
                                <p className="text-[11px] text-zinc-500">
                                  Please check the spelling or ask your company administrator to ensure their organization is set to discoverable.
                                </p>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Applicant Full Name */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Your Full Name <span className="text-[#FF6B4A]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* 3. Applicant Job Title */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                      Your Professional Job Title
                    </label>
                    <JobTitleSelect
                      value={jobTitle || 'Software Engineer'}
                      onChange={(val) => setJobTitle(val)}
                      placeholder="Select your professional job title..."
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Helps authorized management identify your position and assign workspace permissions.
                    </span>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={loading || !selectedOrgToJoin || !fullName.trim()}
                      className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>Submit Join Request <ArrowRight size={16} /></>
                      )}
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center mt-2">
                      Access will be granted immediately upon approval by your organization's management.
                    </p>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div>
          © {new Date().getFullYear()} Auvryn. Developed by Skavelon Technologies. All rights reserved.
        </div>
        <div className="flex items-center gap-6">
          <Link to="/terms" target="_blank" className="hover:text-zinc-300 transition-colors">Terms of Service</Link>
          <Link to="/privacy-policy" target="_blank" className="hover:text-zinc-300 transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}

