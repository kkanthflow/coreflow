import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Lock, ArrowRight, Eye, EyeOff, Check, AlertCircle, Shield, Activity } from 'lucide-react';
import { EASINGS } from '../lib/motionSystem';
import AuvrynLogo from '../components/AuvrynLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [activeField, setActiveField] = useState<'email' | 'password' | 'none'>('none');
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const from = location.state?.from?.pathname || '/dashboard';

  if (user && !authSuccess) {
    navigate(from, { replace: true });
    return null;
  }

  const isFormValid = email.trim().length > 3 && password.length >= 6;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || authSuccess) return;
    setLoading(true);
    setError('');

    try {
      let { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError && authError.message.includes('Invalid login credentials')) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const fallback = await supabase.auth.signInWithPassword({
          email,
          password: hashedPassword,
        });
        authError = fallback.error;
      }

      if (authError) throw authError;

      // Hero transition sequence
      setAuthSuccess(true);
      setTimeout(() => {
        navigate(from, { replace: true, state: { fromAuthUnlock: true } });
      }, 750);

    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
      setLoading(false);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const x = Math.round((e.clientX / window.innerWidth) * 100);
    const y = Math.round((e.clientY / window.innerHeight) * 100);
    setMousePos({ x, y });
  };

  return (
    <div 
      onPointerMove={handlePointerMove}
      className="min-h-screen w-full flex items-center justify-center bg-[#060709] selection:bg-[#FF6B4A]/30 selection:text-white p-4 sm:p-6 lg:p-8 font-sans select-none text-zinc-300 relative overflow-hidden"
    >
      {/* ── 1. Locked Inactive Workspace Preview Silhouette (Dormant Operating System) ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex flex-col justify-between p-8 opacity-25 filter blur-[1px]">
        {/* Top Dormant Navigation Bar Mock */}
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[#12141F] border border-white/[0.08]" />
            <div className="h-3 w-32 bg-white/[0.04] rounded" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-3 w-16 bg-white/[0.04] rounded" />
            <div className="h-3 w-20 bg-white/[0.04] rounded" />
          </div>
        </div>

        {/* Faint Dormant Trajectories & Metric Widgets */}
        <div className="grid grid-cols-12 gap-6 my-auto max-w-6xl mx-auto w-full opacity-60">
          <div className="col-span-8 space-y-4">
            <div className="p-4 rounded-lg bg-[#0C0D12]/60 border border-white/[0.03] space-y-3">
              <div className="h-3 w-40 bg-white/[0.05] rounded" />
              <div className="h-1.5 w-full bg-white/[0.03] rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 bg-[#0C0D12]/40 rounded-lg border border-white/[0.02]" />
              <div className="h-20 bg-[#0C0D12]/40 rounded-lg border border-white/[0.02]" />
              <div className="h-20 bg-[#0C0D12]/40 rounded-lg border border-white/[0.02]" />
            </div>
          </div>
          <div className="col-span-4 space-y-3">
            <div className="h-44 bg-[#0C0D12]/50 rounded-lg border border-white/[0.03]" />
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="flex items-center justify-between border-t border-white/[0.04] pt-4 text-[10px] font-mono text-zinc-600">
          <span>LOCKED SYSTEM ENVIRONMENT</span>
          <span>AWAITING AUTHORIZED ACCESS TOKEN</span>
        </div>
      </div>

      {/* ── 2. Living Core Atmospheric Aura ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          className="absolute inset-0 transition-opacity duration-700 ease-out"
          style={{
            background: `radial-gradient(850px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 107, 74, 0.08), transparent 75%)`,
          }}
        />
        <div className="absolute -top-[10%] left-[25%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#FF6B4A]/[0.08] to-transparent blur-[140px] animate-pulse-glow" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-blue-600/[0.04] to-transparent blur-[120px]" />
        
        {/* Hairline Grid Mesh */}
        <div 
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* ── 3. Main Workspace Unlock Container (Assembles from structural line) ── */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ 
          opacity: authSuccess ? 0 : 1, 
          scale: authSuccess ? 1.04 : 1, 
          y: authSuccess ? -12 : 0,
          filter: authSuccess ? 'blur(4px)' : 'blur(0px)'
        }}
        transition={{ duration: 0.45, ease: EASINGS.spatial }}
        className="relative z-10 w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        
        {/* Left Column: AUVRYN Operating System Statement */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between space-y-6 pr-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#0C0D12] border border-white/[0.06] text-[11px] font-mono text-zinc-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B4A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF6B4A]" />
              </span>
              <span className="font-bold text-white uppercase tracking-wider">AUVRYN OS</span>
              <span className="text-zinc-600">/</span>
              <span>Workspace Unlock</span>
            </div>

            <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Enter your workspace. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B4A] via-[#FF8E75] to-white">
                Start the flow.
              </span>
            </h1>

            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-md">
              Sign in to unlock your unified command center for engineering deliverables, encrypted communications, LiveKit video rooms, and ledger telemetry.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.05] text-xs">
            <div className="p-3 rounded bg-[#0C0D12]/80 border border-white/[0.05] space-y-1 backdrop-blur-sm">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Activity size={12} className="text-[#FF6B4A]" />
                <span>DYNAMIC FLOW</span>
              </div>
              <div className="text-white font-semibold">Realtime Velocity</div>
            </div>
            <div className="p-3 rounded bg-[#0C0D12]/80 border border-white/[0.05] space-y-1 backdrop-blur-sm">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Shield size={12} className="text-emerald-400" />
                <span>ZERO-TRUST SEC</span>
              </div>
              <div className="text-white font-semibold">P-256 ECDH Ratchet</div>
            </div>
          </div>
        </div>

        {/* Right Column: Obsidian Auth Console & Structural Signal Line */}
        <div className="lg:col-span-5 w-full max-w-[420px] mx-auto">
          <div className="relative bg-[#0C0D12]/95 border border-white/[0.09] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5 overflow-hidden">
            
            {/* Structural Assembly Signal Line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, ease: EASINGS.precision }}
              className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF6B4A] to-transparent origin-center"
              style={{ boxShadow: '0 0 12px rgba(255,107,74,0.8)' }}
            />

            {/* Top Brand Marker */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#141622] border border-[#FF6B4A]/40 flex items-center justify-center text-[#FF6B4A] shadow-[0_0_12px_rgba(255,107,74,0.25)]">
                  <AuvrynLogo size={16} />
                </div>
                <div>
                  <span className="font-bold text-sm tracking-tight text-white uppercase font-mono block leading-none">AUVRYN</span>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase">Command Layer</span>
                </div>
              </div>
              
              {/* Traveling Focus Signal Node */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.03] border border-white/[0.06]">
                <motion.div 
                  animate={{
                    backgroundColor: isFormValid ? '#10B981' : '#FF6B4A',
                    boxShadow: isFormValid ? '0 0 8px #10B981' : '0 0 8px #FF6B4A'
                  }}
                  className="w-1.5 h-1.5 rounded-full"
                />
                <span className="text-[9px] font-mono text-zinc-400 font-semibold uppercase">
                  {authSuccess ? 'Unlocked' : isFormValid ? 'Ready' : 'Locked'}
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Unlock Workspace</h2>
              <p className="text-xs text-zinc-400 mt-0.5 font-normal">Provide authorized credentials to initialize session.</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-mono flex items-center gap-2"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Field with Active Focus Flow Accent */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                    Operator Identity
                  </label>
                  {email.includes('@') && email.includes('.') && (
                    <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-0.5">
                      <Check size={10} /> Valid format
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onFocus={() => setActiveField('email')}
                    onBlur={() => setActiveField('none')}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full bg-[#07080B] border rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all ${
                      activeField === 'email'
                        ? 'border-[#FF6B4A] shadow-[0_0_12px_rgba(255,107,74,0.2)] ring-1 ring-[#FF6B4A]/30'
                        : 'border-white/[0.08] hover:border-white/[0.14]'
                    }`}
                    placeholder="operator@company.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                    Security Passphrase
                  </label>
                  {password.length >= 6 && (
                    <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-0.5">
                      <Check size={10} /> Verified
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onFocus={() => setActiveField('password')}
                    onBlur={() => setActiveField('none')}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full bg-[#07080B] border rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all ${
                      activeField === 'password'
                        ? 'border-[#FF6B4A] shadow-[0_0_12px_rgba(255,107,74,0.2)] ring-1 ring-[#FF6B4A]/30'
                        : 'border-white/[0.08] hover:border-white/[0.14]'
                    }`}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Unlock Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !isFormValid || authSuccess}
                  className={`w-full relative overflow-hidden flex items-center justify-center gap-2 py-3 font-semibold text-xs rounded-xl transition-all shadow-lg ${
                    authSuccess
                      ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                      : isFormValid
                      ? 'bg-[#FF6B4A] hover:bg-[#FF552B] text-white shadow-[#FF6B4A]/25 cursor-pointer'
                      : 'bg-white/[0.05] text-zinc-500 border border-white/[0.06] cursor-not-allowed'
                  }`}
                >
                  {/* Subtle sweep line on ready */}
                  {isFormValid && !loading && !authSuccess && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
                  )}

                  {authSuccess ? (
                    <span className="flex items-center gap-1.5 font-bold tracking-wide">
                      <Check size={14} /> Authenticated · Unlocking...
                    </span>
                  ) : loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying with AUVRYN...</span>
                    </span>
                  ) : (
                    <>
                      <span>Unlock Workspace</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>

              {/* Sign Up Link */}
              <div className="pt-2 text-center text-xs text-zinc-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="text-[#FF6B4A] hover:text-[#FF552B] font-semibold transition-colors"
                >
                  Create workspace account
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <span className="flex items-center gap-1">
                <Lock size={11} className="text-emerald-400" />
                <span>NIST ECDH Secured</span>
              </span>
              <span>TLS 1.3</span>
            </div>

          </div>
        </div>

      </motion.div>

    </div>
  );
}
