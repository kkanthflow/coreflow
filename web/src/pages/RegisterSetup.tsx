import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, Building2, Users2, ArrowRight, Check, Shield, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { trpc } from '../lib/trpc';
import AuvrynLogo from '../components/AuvrynLogo';

type SetupMode = 'freelancer' | 'create_org' | 'join_org' | null;

export default function RegisterSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, fullName: authFullName, accountType, accountSetupCompleted, refreshUserDetails } = useAuth();

  // If already completed onboarding, redirect to dashboard
  useEffect(() => {
    if (accountSetupCompleted && accountType) {
      navigate('/dashboard', { replace: true });
    }
  }, [accountSetupCompleted, accountType, navigate]);

  // Initial state is strictly UNSELECTED
  const [selectedMode, setSelectedMode] = useState<SetupMode>(null);

  // Form states
  const [fullName, setFullName] = useState(authFullName || (location.state as any)?.fullName || user?.user_metadata?.full_name || '');
  const [jobTitle, setJobTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgIdToJoin, setOrgIdToJoin] = useState('');
  const [currency, setCurrency] = useState('INR');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync auth full name when available
  useEffect(() => {
    if (!fullName && (authFullName || user?.user_metadata?.full_name)) {
      setFullName(authFullName || user?.user_metadata?.full_name || '');
    }
  }, [authFullName, user]);

  // Handle explicit Freelancer setup
  const handleFreelancerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Update public.users
      const { error: userErr } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim() || 'Freelancer',
          account_type: 'freelancer',
          role: 'freelancer',
          default_workspace_id: 'independent',
          account_setup_completed: true,
          current_plan_tier: 'freelancer_free',
          subscription_status: 'free',
        })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // 2. Upsert freelancer_profiles
      const skillArray = skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const { error: profileErr } = await supabase
        .from('freelancer_profiles')
        .upsert({
          id: user.id,
          freelancer_type: 'independent',
          skills: skillArray,
          portfolio: portfolio.trim() || null,
        });

      if (profileErr) console.warn('[RegisterSetup] freelancer_profiles warning:', profileErr.message);

      // 3. Ensure independent workspace
      const { data: existingWs } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .eq('type', 'independent')
        .maybeSingle();

      if (!existingWs) {
        await supabase.from('workspaces').insert({
          name: `${fullName.trim() || 'Freelancer'} Workspace`,
          type: 'independent',
          owner_id: user.id,
          status: 'active',
        });
      }

      await refreshUserDetails();
      navigate('/dashboard', { replace: true });
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
      // 1. Create Organization in public.organizations
      const { data: newOrg, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          default_currency: currency,
          current_plan_tier: 'business_free',
          subscription_status: 'free',
        })
        .select()
        .single();

      if (orgErr || !newOrg) throw (orgErr || new Error('Failed to create organization record'));

      // 2. Add creator as Owner in user_organizations
      const { error: memErr } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          org_id: newOrg.id,
          role: 'owner',
        });

      if (memErr) throw memErr;

      // 3. Update public.users
      const { error: userErr } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim() || 'Organization Owner',
          account_type: 'organization',
          role: 'owner',
          default_workspace_id: newOrg.id,
          account_setup_completed: true,
          current_plan_tier: 'business_free',
          subscription_status: 'free',
        })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // 4. Create default organization workspace
      await supabase.from('workspaces').insert({
        name: orgName.trim(),
        type: 'organization',
        owner_id: user.id,
        status: 'active',
      });

      await refreshUserDetails();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Organization creation failed:', err);
      setError(err.message || 'Failed to complete organization setup.');
      setLoading(false);
    }
  };

  // Handle explicit Join Organization setup
  const handleJoinOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!orgIdToJoin.trim()) {
      setError('Organization ID is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify organization exists
      const { data: targetOrg, error: orgFindErr } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgIdToJoin.trim())
        .maybeSingle();

      if (orgFindErr || !targetOrg) {
        throw new Error('Organization not found. Please check the Organization ID provided by your administrator.');
      }

      // 2. Add as regular employee member (never self-assign elevated role)
      const { error: memErr } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          org_id: targetOrg.id,
          role: 'employee',
        });

      if (memErr && !memErr.message.includes('duplicate')) {
        throw memErr;
      }

      // 3. Update user profile
      const { error: userErr } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim() || 'Team Member',
          account_type: 'organization',
          role: 'employee',
          default_workspace_id: targetOrg.id,
          account_setup_completed: true,
        })
        .eq('id', user.id);

      if (userErr) throw userErr;

      await refreshUserDetails();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Join organization failed:', err);
      setError(err.message || 'Failed to join organization. Please verify the ID.');
      setLoading(false);
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
        <div className="text-xs text-zinc-400 font-mono">
          Step 2 of 2: Workspace Configuration
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-4xl mx-auto w-full my-6">
        <div className="text-center space-y-3 mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Choose Your Operating Architecture
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
            Select how you want to work on Auvryn. Your workspace, role permissions, and subscription limits will be configured accordingly.
          </p>
        </div>

        {error && (
          <div className="w-full max-w-2xl mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-xs sm:text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
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
                  Join your company's existing workspace using an Organization ID or invitation code.
                </p>
              </div>
              <ul className="text-xs text-zinc-400 space-y-2 pt-2 border-t border-white/[0.06]">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-blue-400 shrink-0" />
                  <span>Access Team Projects & Channels</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-blue-400 shrink-0" />
                  <span>Standard Employee Permissions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-blue-400 shrink-0" />
                  <span>No Individual Billing Required</span>
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
                  You'll be provisioned a dedicated individual workspace with Free Freelancer tier limits (up to 3 projects, 2 workflows, 7-day history).
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
                  You will be assigned as the Organization Owner with full administrative and billing governance. Your team starts on Business Free (up to 3 members).
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
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Founder & CEO"
                    className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-[#FF6B4A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
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
                  Join Existing Organization
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter the Organization ID provided by your company owner or administrator to request access to their workspace.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Organization ID (UUID) <span className="text-[#FF6B4A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={orgIdToJoin}
                  onChange={(e) => setOrgIdToJoin(e.target.value)}
                  placeholder="e.g. 7f4a8b9c-1234-5678-abcd-ef0123456789"
                  className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors font-mono"
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
                  placeholder="e.g. Jane Smith"
                  className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                  Your Job Role
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Developer"
                  className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading || !orgIdToJoin.trim() || !fullName.trim()}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <>Request Access & Join <ArrowRight size={16} /></>}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
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
