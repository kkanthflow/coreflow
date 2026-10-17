import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Building2, 
  Briefcase, 
  Check, 
  Sparkles,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { SUPPORTED_CURRENCIES } from '../lib/currency';
import AuvrynLogo from '../components/AuvrynLogo';

export default function Register() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already authenticated
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  // Account identity
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Registration Mode: Join Org, Create Org, or Freelancer
  const [accountType, setAccountType] = useState<'join' | 'create' | 'freelancer'>('join');
  const [freelancerWorkType, setFreelancerWorkType] = useState<'organization' | 'independent'>('organization');

  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState('general_member');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [agreed, setAgreed] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string | null> = {};
    let isValid = true;

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    const needsOrg = accountType !== 'freelancer' || (accountType === 'freelancer' && freelancerWorkType === 'organization');
    if (needsOrg && !organization.trim()) {
      newErrors.organization = 'Organization name is required';
      isValid = false;
    }

    if (!agreed) {
      newErrors.agreed = 'You must agree to the Terms and Privacy Policy to proceed.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      let orgId = null;
      let existingOrg = null;
      const cleanOrgName = organization.trim();
      const needsOrg = accountType !== 'freelancer' || (accountType === 'freelancer' && freelancerWorkType === 'organization');

      if (needsOrg) {
        const { data: orgData, error: orgSearchError } = await supabase
          .from('organizations')
          .select('id')
          .ilike('name', cleanOrgName)
          .maybeSingle();

        if (orgSearchError) throw orgSearchError;
        existingOrg = orgData;

        if ((accountType === 'join' || accountType === 'freelancer') && !existingOrg) {
          throw new Error(`Organization "${cleanOrgName}" not found. Please verify the name or create a new organization.`);
        }
        if (accountType === 'create' && existingOrg) {
          throw new Error(`Organization "${cleanOrgName}" already exists. Please join it instead.`);
        }
      }

      // 2. Sign up user
      const metaRole = accountType === 'freelancer'
        ? 'freelancer'
        : (accountType === 'create' ? 'owner' : role);

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: metaRole,
          }
        }
      });

      let userId = authData?.user?.id;

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          const signInResult = await supabase.auth.signInWithPassword({ email, password });
          if (signInResult.error) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          userId = signInResult.data.user?.id;
        } else {
          throw signUpError;
        }
      }

      if (!userId) throw new Error('Failed to obtain user session after registration.');

      // Helpers for workspace seeding
      const joinOrgWorkspace = async (orgDbId: string) => {
        const { data: existingWs } = await supabase
          .from('workspaces')
          .select('id')
          .eq('organization_id', orgDbId)
          .eq('type', 'organization')
          .maybeSingle();

        let wsId = existingWs?.id;
        if (!wsId) {
          const { data: newWs } = await supabase
            .from('workspaces')
            .insert({ name: cleanOrgName + ' Organization', type: 'organization', owner_id: userId, organization_id: orgDbId, status: 'active' })
            .select('id')
            .single();
          wsId = newWs?.id;
        }
        if (wsId) {
          await supabase
            .from('workspace_members')
            .upsert({ workspace_id: wsId, user_id: userId, status: 'active' }, { onConflict: 'workspace_id,user_id' });
        }
      };

      const createIndependentWorkspace = async () => {
        const { data: existingWs } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', userId)
          .eq('type', 'independent')
          .maybeSingle();

        if (!existingWs) {
          const { data: newWs } = await supabase
            .from('workspaces')
            .insert({ name: fullName.trim() + ' Freelancing', type: 'independent', owner_id: userId, status: 'active' })
            .select('id')
            .single();

          if (newWs?.id) {
            await supabase
              .from('workspace_members')
              .insert({ workspace_id: newWs.id, user_id: userId, status: 'active' });
          }
        }
      };

      // 3. Associate roles and organizations
      if (accountType === 'freelancer') {
        if (freelancerWorkType === 'organization' && existingOrg) {
          orgId = existingOrg.id;
          await supabase.from('user_organizations').insert({ user_id: userId, org_id: orgId, role: 'freelancer' });
          await supabase.from('users').update({ role: 'freelancer', freelancer_type: 'organization' }).eq('id', userId);
          await supabase.from('freelancer_profiles').upsert({ id: userId, freelancer_type: 'organization' }, { onConflict: 'id' });
          await joinOrgWorkspace(orgId);
          await createIndependentWorkspace();
        } else {
          await supabase.from('users').update({ role: 'freelancer', freelancer_type: 'independent' }).eq('id', userId);
          await supabase.from('freelancer_profiles').upsert({ id: userId, freelancer_type: 'independent' }, { onConflict: 'id' });
          await createIndependentWorkspace();
        }
      } else if (accountType === 'join' && existingOrg) {
        orgId = existingOrg.id;
        const assignedRole = role || 'employee';
        await supabase.from('user_organizations').insert({ user_id: userId, org_id: orgId, role: assignedRole });
        await supabase.from('users').update({ role: assignedRole }).eq('id', userId);
        await joinOrgWorkspace(orgId);
        await createIndependentWorkspace();
      } else if (accountType === 'create') {
        const { data: newOrg, error: createOrgError } = await supabase
          .from('organizations')
          .insert({ name: cleanOrgName, default_currency: defaultCurrency })
          .select('id')
          .single();

        if (createOrgError) throw createOrgError;
        orgId = newOrg.id;

        await supabase.from('user_organizations').insert({ user_id: userId, org_id: orgId, role: 'owner' });
        await supabase.from('users').update({ role: 'owner' }).eq('id', userId);
        await joinOrgWorkspace(orgId);
        await createIndependentWorkspace();
      }

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Registration failed:', err);
      let msg = err.message || 'Registration failed. Please check inputs.';
      if (msg.includes('duplicate key value violates unique constraint') || msg.includes('users_email_key')) {
        msg = 'This email is already registered. Please sign in instead.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      setError(null);
      const redirectTo = window.location.hostname === 'localhost'
        ? `${window.location.origin}/`
        : 'https://auvrynplatform.vercel.app/';

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error('Google login failed:', error.message);
        throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-up failed.');
      setLoading(false);
    }
  };

  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const handlePointerMove = (e: React.PointerEvent) => {
    const x = Math.round((e.clientX / window.innerWidth) * 100);
    const y = Math.round((e.clientY / window.innerHeight) * 100);
    setMousePos({ x, y });
  };

  return (
    <div 
      onPointerMove={handlePointerMove}
      className="min-h-screen w-full flex items-center justify-center bg-app selection:bg-[#FF6B4A]/30 selection:text-main p-4 sm:p-6 lg:p-8 font-sans select-none text-muted relative overflow-hidden"
    >
      {/* Living AUVRYN Atmospheric Background Canvas */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Cursor-responsive living AUVRYN atmospheric gradient aura */}
        <div 
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: `radial-gradient(750px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 107, 74, 0.09), transparent 75%)`,
          }}
        />

        {/* Ambient Top Glow */}
        <div className="absolute -top-[10%] left-[25%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#FF6B4A]/[0.10] to-transparent blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-blue-600/[0.06] to-transparent blur-[100px]" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-[1040px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-start my-8">
        
        {/* Left Column: Platform Identity & Perks */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between space-y-6 sticky top-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-card-bg border border-divider text-[11px] font-mono text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B4A]" />
              <span className="font-bold text-main uppercase tracking-wider">AUVRYN OS</span>
              <span className="text-zinc-600">/</span>
              <span>Account Provisioning</span>
            </div>

            <h1 className="text-3xl xl:text-4xl font-extrabold text-main tracking-tight leading-tight">
              Scale operations & <br />
              <span className="text-[#FF6B4A]">unify your enterprise.</span>
            </h1>

            <p className="text-muted text-xs sm:text-sm leading-relaxed">
              Create an organization account or register as an independent contractor to manage projects, WebRTC conferences, and automated billing.
            </p>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-divider text-xs">
            <div className="flex items-center gap-2.5 p-3 rounded bg-card-bg border border-divider">
              <Building2 size={16} className="text-[#FF6B4A]" />
              <div>
                <div className="text-main font-semibold">Multi-Tenant Hierarchy</div>
                <div className="text-[10px] text-muted">Autonomous organization workspaces with role-based policies.</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded bg-card-bg border border-divider">
              <Briefcase size={16} className="text-[#FF6B4A]" />
              <div>
                <div className="text-main font-semibold">Freelancer Portal</div>
                <div className="text-[10px] text-muted">Independent billing, client invoicing, and cross-team scopes.</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded bg-card-bg border border-divider">
              <ShieldCheck size={16} className="text-[#FF6B4A]" />
              <div>
                <div className="text-main font-semibold">Military-Grade Privacy</div>
                <div className="text-[10px] text-muted">ECDH P-256 chat E2EE with Postgres Row-Level Security.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Registration Console */}
        <div className="lg:col-span-7 w-full max-w-[620px] mx-auto">
          <div className="bg-card-bg border border-divider rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
            
            {/* Top Brand Marker */}
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-hover border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
                  <AuvrynLogo size={15} />
                </div>
                <span className="font-bold text-sm tracking-tight text-main uppercase font-mono">AUVRYN</span>
              </div>
              <span className="text-[10px] font-mono text-muted uppercase">Registration</span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-main tracking-tight">Create Workspace Account</h2>
              <p className="text-xs text-muted mt-1">Configure your membership mode, organization details, and credentials.</p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              
              {/* Personal Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">
                    Full Name <span className="text-[#FF6B4A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    disabled={loading}
                    className={`w-full bg-app border ${errors.fullName ? 'border-red-500' : 'border-divider'} focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors`}
                  />
                  {errors.fullName && <div className="text-[10px] text-red-400 mt-1">{errors.fullName}</div>}
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">
                    Email Address <span className="text-[#FF6B4A]">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={loading}
                    className={`w-full bg-app border ${errors.email ? 'border-red-500' : 'border-divider'} focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors`}
                  />
                  {errors.email && <div className="text-[10px] text-red-400 mt-1">{errors.email}</div>}
                </div>
              </div>

              {/* Account Type Selector */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                  I want to...
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'join', title: 'Join Organization', desc: 'Join an existing team' },
                    { id: 'create', title: 'Create Organization', desc: 'Found a new enterprise' },
                    { id: 'freelancer', title: 'Register Freelancer', desc: 'Independent contractor' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAccountType(item.id as any)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        accountType === item.id 
                          ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-main' 
                          : 'bg-app border-divider text-muted hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{item.title}</span>
                        {accountType === item.id && <Check size={13} className="text-[#FF6B4A]" />}
                      </div>
                      <p className="text-[10px] text-muted">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Freelancer Scope (if Freelancer chosen) */}
              {accountType === 'freelancer' && (
                <div className="space-y-2 p-3.5 bg-app border border-divider rounded-lg">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                    Freelancer Engagement Model
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFreelancerWorkType('organization')}
                      className={`p-2.5 rounded border text-left transition-all ${
                        freelancerWorkType === 'organization'
                          ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-main'
                          : 'bg-white/[0.02] border-divider text-muted'
                      }`}
                    >
                      <div className="text-xs font-semibold">Join Organization</div>
                      <div className="text-[10px] text-muted">Contract within an agency</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFreelancerWorkType('independent')}
                      className={`p-2.5 rounded border text-left transition-all ${
                        freelancerWorkType === 'independent'
                          ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-main'
                          : 'bg-white/[0.02] border-divider text-muted'
                      }`}
                    >
                      <div className="text-xs font-semibold">Work Independently</div>
                      <div className="text-[10px] text-muted">Solo client invoicing</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Organization Input (for Join, Create, or Org Freelancer) */}
              {((accountType !== 'freelancer') || (accountType === 'freelancer' && freelancerWorkType === 'organization')) && (
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">
                    {accountType === 'create' ? 'New Organization Name' : 'Organization Name to Join'} <span className="text-[#FF6B4A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Acme Corp"
                    disabled={loading}
                    className={`w-full bg-app border ${errors.organization ? 'border-red-500' : 'border-divider'} focus:border-[#FF6B4A]/50 rounded px-3 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors`}
                  />
                  {errors.organization && <div className="text-[10px] text-red-400 mt-1">{errors.organization}</div>}
                </div>
              )}

              {/* Role Picker (when joining organization) */}
              {accountType === 'join' && (
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">
                    Requested Workspace Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-app border border-divider rounded px-3 py-2 text-xs text-main focus:outline-none"
                  >
                    <option value="administrator">Administrator — Org-wide management</option>
                    <option value="director">Director — Senior leadership</option>
                    <option value="senior_manager">Senior Manager — Cross-team leadership</option>
                    <option value="manager">Manager — Team management</option>
                    <option value="team_lead">Team Lead — Frontline leadership</option>
                    <option value="senior_employee">Senior Employee — Experienced contributor</option>
                    <option value="employee">Employee — Team member</option>
                    <option value="intern">Intern — Entry level</option>
                    <option value="freelancer">Freelancer — External contractor</option>
                  </select>
                </div>
              )}

              {/* Owner Role Notice & Currency Selector (when creating new org) */}
              {accountType === 'create' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded bg-[#FF6B4A]/10 border border-[#FF6B4A]/20">
                    <div className="text-xs font-bold text-[#FF6B4A] flex items-center gap-1.5">
                      <Sparkles size={13} />
                      <span>Role: Organization Owner</span>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      As the founder, you will be assigned the <strong>Owner</strong> role with complete access to administrative controls, global audit logs, and invoicing.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">
                      Default Organization Currency
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SUPPORTED_CURRENCIES.map((curr) => {
                        const isSelected = defaultCurrency === curr.code;
                        return (
                          <button
                            key={curr.code}
                            type="button"
                            onClick={() => setDefaultCurrency(curr.code)}
                            className={`p-2 rounded border text-left flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-[#FF6B4A]/10 border-[#FF6B4A] text-main'
                                : 'bg-app border-divider text-muted hover:border-white/[0.1]'
                            }`}
                          >
                            <span className="text-xs font-semibold">{curr.name}</span>
                            {isSelected && <Check size={13} className="text-[#FF6B4A]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">
                    Passphrase <span className="text-[#FF6B4A]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={loading}
                      className={`w-full bg-app border ${errors.password ? 'border-red-500' : 'border-divider'} focus:border-[#FF6B4A]/50 rounded pl-3 pr-9 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main"
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  {errors.password && <div className="text-[10px] text-red-400 mt-1">{errors.password}</div>}
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">
                    Confirm Passphrase <span className="text-[#FF6B4A]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={loading}
                      className={`w-full bg-app border ${errors.confirmPassword ? 'border-red-500' : 'border-divider'} focus:border-[#FF6B4A]/50 rounded pl-3 pr-9 py-2 text-xs text-main placeholder-zinc-500 focus:outline-none transition-colors`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main"
                    >
                      {showConfirmPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <div className="text-[10px] text-red-400 mt-1">{errors.confirmPassword}</div>}
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="space-y-1 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-white/[0.1] bg-app text-[#FF6B4A] focus:ring-0 focus:outline-none"
                  />
                  <span className="text-[11px] text-muted leading-relaxed">
                    I acknowledge and agree to the{' '}
                    <Link
                      to="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#FF6B4A] font-semibold hover:underline"
                    >
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link
                      to="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#FF6B4A] font-semibold hover:underline"
                    >
                      Terms & Conditions
                    </Link>.
                  </span>
                </label>
                {errors.agreed && <div className="text-[10px] text-red-400">{errors.agreed}</div>}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-40 text-main font-semibold text-xs rounded transition-colors shadow-sm"
                >
                  {loading ? (
                    <span>Provisioning workspace...</span>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>

              {/* Divider & Google OAuth */}
              <div className="relative flex items-center justify-center pt-2">
                <div className="w-full border-t border-divider" />
                <span className="absolute bg-card-bg px-3 text-[10px] font-mono text-muted uppercase">or</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-divider text-main font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Sign In Link */}
              <div className="pt-2 text-center text-xs text-muted">
                Already registered?{' '}
                <Link to="/login" className="text-[#FF6B4A] hover:text-[#FF552B] font-semibold transition-colors">
                  Access existing session
                </Link>
              </div>
            </form>

            <div className="pt-3 border-t border-divider flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-600">
              <Lock size={11} />
              <span>TLS 1.3 · Postgres RLS Encrypted</span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
