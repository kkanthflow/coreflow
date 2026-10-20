import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Building2, 
  Briefcase, 
  User, 
  LogIn, 
  UserPlus, 
  Lock, 
  RefreshCw,
  MailWarning
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { causalityApi } from '../lib/causalityApi';
import { saveInviteToken, getStoredInviteToken, clearStoredInviteToken } from '../lib/inviteTokenStorage';
import AuvrynLogo from '../components/AuvrynLogo';
import { toast } from '../components/ui/Toast';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUserDetails } = useAuth();

  const [token, setToken] = useState<string>(() => {
    return searchParams.get('token') || searchParams.get('invite') || getStoredInviteToken() || '';
  });

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize and persist token
  useEffect(() => {
    const urlToken = searchParams.get('token') || searchParams.get('invite');
    if (urlToken && urlToken.trim()) {
      setToken(urlToken.trim());
      saveInviteToken(urlToken.trim());
    }
  }, [searchParams]);

  // Fetch invite details
  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorStatus('MISSING_TOKEN');
      setErrorMessage('No invitation token found in link or session. Please request a new invite link.');
      return;
    }

    let isMounted = true;
    saveInviteToken(token);

    causalityApi.getInviteDetails(token)
      .then((res) => {
        if (!isMounted) return;
        if (!res.valid) {
          setErrorStatus(res.status || res.reason || 'INVALID');
          setErrorMessage(res.message || 'This invitation has expired or has already been accepted.');
          setInviteData(res.invite || null);
        } else {
          setInviteData(res.invite);
          setErrorStatus(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorStatus('FETCH_ERROR');
        setErrorMessage(err.message || 'Unable to retrieve invitation details.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [token]);

  // Handle Accept
  const handleAcceptInvite = async () => {
    if (!user) return;
    setAccepting(true);
    try {
      const res = await causalityApi.acceptProjectInvite(token);
      toast.success('Invitation accepted successfully! Welcome to your project.');
      clearStoredInviteToken();
      await refreshUserDetails();

      const targetProjectId = res.project_id || inviteData?.project?.id;
      if (targetProjectId) {
        navigate(`/projects/${targetProjectId}/client-room`, { replace: true });
      } else {
        navigate('/projects', { replace: true });
      }
    } catch (err: any) {
      console.error('Accept invite error:', err);
      toast.error(err.message || 'Failed to accept invitation.');
      setAccepting(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      saveInviteToken(token);
      const origin = window.location.hostname === 'localhost' 
        ? window.location.origin 
        : 'https://auvrynplatform.vercel.app';
      const redirectTo = `${origin}/invite/client?token=${encodeURIComponent(token)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Google authentication failed.');
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center text-main p-4">
        <div className="w-10 h-10 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-sm font-mono tracking-wider text-muted">VERIFYING CLIENT INVITATION...</h2>
      </div>
    );
  }

  // 2. Error / Expired / Invalid State
  if (errorStatus || !inviteData) {
    const isExpired = errorStatus === 'expired' || errorStatus === 'INVITE_EXPIRED';
    const isUsed = errorStatus === 'accepted' || errorStatus === 'INVITE_ALREADY_USED';

    return (
      <div className="min-h-screen bg-app flex items-center justify-center p-4 sm:p-6 font-sans text-muted select-none">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-card-bg border border-divider rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            {isExpired ? <Clock size={28} /> : isUsed ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
          </div>

          <div>
            <h1 className="text-lg font-bold text-main tracking-tight">
              {isExpired ? 'Invitation Expired' : isUsed ? 'Invitation Already Used' : 'Invalid Invitation'}
            </h1>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              {errorMessage || 'This invitation link is no longer valid.'}
            </p>
          </div>

          {inviteData?.project && (
            <div className="p-3.5 bg-hover rounded-xl border border-divider text-left text-xs space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Project</span>
              <div className="text-main font-semibold truncate">{inviteData.project.title}</div>
              {inviteData.inviter && (
                <div className="text-muted text-[11px]">
                  Invited by: {inviteData.inviter.full_name || inviteData.inviter.email}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              onClick={() => {
                clearStoredInviteToken();
                navigate('/login', { replace: true });
              }}
              className="w-full py-2.5 px-4 bg-hover hover:bg-hover text-main rounded-xl text-xs font-semibold border border-divider transition-colors"
            >
              Go to Sign In
            </button>
            <p className="text-[11px] text-zinc-500">
              Need a fresh link? Contact the project owner to resend an invitation.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Valid Invitation State
  const clientName = inviteData.client?.name || 'Client Contact';
  const companyName = inviteData.client?.company_name;
  const projectTitle = inviteData.project?.title || 'Client Project';
  const inviterName = inviteData.inviter?.full_name || inviteData.inviter?.email || 'The project manager';
  const invitedEmail = inviteData.email;
  const currentUserEmail = user?.email;
  const isEmailMismatch = user && currentUserEmail && currentUserEmail.toLowerCase() !== invitedEmail.toLowerCase();

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-muted select-none relative overflow-hidden">
      {/* Background Aura */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FF6B4A]/[0.08] to-transparent blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-card-bg border border-divider rounded-2xl shadow-2xl overflow-hidden relative z-10 flex flex-col"
      >
        {/* Header Ribbon */}
        <div className="p-6 border-b border-divider bg-card-bg flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A] shrink-0">
            <AuvrynLogo size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF6B4A] font-bold block">
              AUVRYN CLIENT PORTAL
            </span>
            <h1 className="text-base font-bold text-main truncate tracking-tight">
              Project Collaboration Invitation
            </h1>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Welcome Message */}
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-main">
              Hello {clientName},
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              <strong className="text-main">{inviterName}</strong> has invited you to collaborate in the dedicated Client Project Room for{' '}
              <strong className="text-[#FF6B4A]">{projectTitle}</strong>{companyName ? ` (${companyName})` : ''}.
            </p>
          </div>

          {/* Scoped Project Badges */}
          <div className="p-4 bg-app rounded-xl border border-divider space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-divider">
              <span className="text-muted flex items-center gap-1.5 font-mono text-[11px]">
                <Briefcase size={13} className="text-[#FF6B4A]" /> Project Scope:
              </span>
              <span className="font-bold text-main truncate max-w-[200px]">{projectTitle}</span>
            </div>

            <div className="flex items-center justify-between text-xs pb-2 border-b border-divider">
              <span className="text-muted flex items-center gap-1.5 font-mono text-[11px]">
                <User size={13} className="text-emerald-400" /> Invited Email:
              </span>
              <span className="font-mono text-zinc-300 font-semibold">{invitedEmail}</span>
            </div>

            <div className="pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted block mb-2">
                Granted Client Capabilities
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span>Real-time Deliverables</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span>Change Request Approvals</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span>Statements & Invoices</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span>Cryptographic Proofs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Email Mismatch Notice (Graceful Link with Record of Both Emails) */}
          {isEmailMismatch && (
            <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
              <MailWarning size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-muted space-y-1">
                <span className="font-bold text-amber-300 block">Different Authenticated Email</span>
                <p className="text-[11px] leading-relaxed">
                  You are currently logged in as <strong className="text-main">{currentUserEmail}</strong>. 
                  Accepting will link this client record to your account and log both email addresses.
                </p>
              </div>
            </div>
          )}

          {/* Action Decision: Logged-in vs Unauthenticated */}
          {user ? (
            <div className="space-y-3 pt-2">
              <button
                onClick={handleAcceptInvite}
                disabled={accepting}
                className="w-full py-3 px-4 bg-[#FF6B4A] hover:bg-[#FF5530] text-main font-bold text-xs rounded-xl shadow-lg shadow-[#FF6B4A]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {accepting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Accepting & Linking Project...</span>
                  </>
                ) : (
                  <>
                    <span>Accept Invitation & Enter Project</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
              
              <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                <span>Signed in as <strong className="text-zinc-400">{currentUserEmail}</strong></span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="text-[#FF6B4A] hover:underline"
                >
                  Switch Account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="text-center pb-1">
                <span className="text-xs font-semibold text-main">
                  Sign in or create an account to claim your client workspace:
                </span>
              </div>

              {/* Google OAuth Button */}
              <button
                onClick={handleGoogleAuth}
                className="w-full py-2.5 px-4 bg-hover hover:bg-hover text-main rounded-xl border border-divider text-xs font-semibold transition-all flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-divider" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono">
                  <span className="bg-card-bg px-2 text-zinc-500">or password account</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  to={`/register?token=${encodeURIComponent(token)}`}
                  className="py-2.5 px-3 bg-[#FF6B4A] hover:bg-[#FF5530] text-main text-center rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <UserPlus size={13} />
                  <span>Create Account</span>
                </Link>

                <Link
                  to={`/login?token=${encodeURIComponent(token)}`}
                  className="py-2.5 px-3 bg-hover hover:bg-hover text-main text-center rounded-xl text-xs font-semibold border border-divider transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogIn size={13} />
                  <span>Sign In</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
