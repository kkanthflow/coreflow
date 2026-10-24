import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  KeyRound, 
  ShieldCheck, 
  Laptop, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Lock, 
  LogOut, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
import {
  SettingsSection,
  SettingsRow,
} from '../../components/settings';

export default function SecuritySettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Password Update Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  // Signing out other sessions state
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (pass: string): { score: number; label: string; color: string } => {
    if (!pass) return { score: 0, label: 'Empty', color: 'bg-surface-2' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score === 2 || score === 3) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    setPasswordUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Account password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleSignOutOtherSessions = async () => {
    setSigningOutOthers(true);
    try {
      // Supabase signOut with scope 'others' terminates other refresh tokens
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success('Successfully terminated all other active sessions');
    } catch (err: any) {
      toast.error(err.message || 'Failed to terminate other sessions');
    } finally {
      setSigningOutOthers(false);
    }
  };

  // Device detection from User Agent
  const getClientDevice = () => {
    if (typeof window === 'undefined') return { os: 'Unknown OS', browser: 'Browser' };
    const ua = navigator.userAgent;
    let os = 'Desktop';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    let browser = 'Browser';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
    else if (ua.includes('Edg')) browser = 'Microsoft Edge';
    else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';

    return { os, browser };
  };

  const currentDevice = getClientDevice();

  return (
    <div className="space-y-6">
      {/* ── Change Password ── */}
      <SettingsSection
        label="Account Credentials"
        description="Update your account sign-in password managed by Supabase authentication."
      >
        <div className="p-4 sm:p-5">
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="text-xs font-semibold text-text block mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3.5 py-2 pr-10 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-text cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Password strength meter */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1.5 h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${strength.color}`}
                      style={{ width: `${(strength.score / 3) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted">
                    Strength: <strong className="text-text">{strength.label}</strong>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-text block mb-1.5">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={passwordUpdating || !newPassword || !confirmPassword}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              {passwordUpdating ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </SettingsSection>

      {/* ── Two-Factor Authentication (2FA) Backend-Gated ── */}
      <SettingsSection
        label="Two-Factor Authentication (2FA)"
        description="Hardware security keys and TOTP authenticator application verification."
      >
        <SettingsRow
          icon={ShieldCheck}
          title="Authenticator App (TOTP)"
          description="Protect account access with 6-digit one-time passcodes generated on your mobile device."
        >
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-xl bg-surface-2 border border-line text-muted flex items-center gap-1.5">
              <Clock size={12} />
              <span>Coming Soon</span>
            </span>
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* ── Active Sessions ── */}
      <SettingsSection
        label="Active Sessions & Devices"
        description="Devices currently authenticated to your workspace identity."
      >
        <div className="p-4 sm:p-5 space-y-4">
          {/* Current Device Item */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-2 border border-line">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-text shrink-0">
                <Laptop size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-text">
                    {currentDevice.browser} on {currentDevice.os}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    This Device
                  </span>
                </div>
                <div className="text-[11px] font-mono text-muted mt-0.5">
                  Authenticated session · Active now
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted">
              Lost a device or signed in from a shared computer?
            </span>
            <button
              type="button"
              onClick={handleSignOutOtherSessions}
              disabled={signingOutOthers}
              className="px-3.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-muted hover:text-text border border-line text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <LogOut size={13} />
              <span>{signingOutOthers ? 'Signing out...' : 'Sign out other sessions'}</span>
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* ── Security Audit Log Link ── */}
      <SettingsSection
        label="Security Audit Trail"
        description="Comprehensive immutable ledger of login events, privilege elevations, and role shifts."
      >
        <SettingsRow
          icon={ExternalLink}
          title="Inspect Security Audit Logs"
          description="View timestamps, client IP addresses, actor identities, and security action payloads."
        >
          <button
            type="button"
            onClick={() => navigate('/audit-logs')}
            className="px-3.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-text border border-line text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>View Audit Logs</span>
            <ExternalLink size={12} />
          </button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
