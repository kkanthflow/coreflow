import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { 
  Moon, 
  Smartphone, 
  Shield, 
  Lock, 
  Bell, 
  Video, 
  Briefcase, 
  ChevronRight, 
  X, 
  Check, 
  Calendar, 
  AlarmClock, 
  ShieldAlert, 
  AlertCircle, 
  Mail, 
  Building2,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  User
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from '../components/ui/Toast';
import { SUPPORTED_CURRENCIES } from '../lib/currency';
import { PageHeader, EmptyState } from '../components/ui/ObsidianPrimitives';
import SettingsRow from '../components/settings/SettingsRow';
import Toggle from '../components/settings/Toggle';

export default function Settings() {
  const navigate = useNavigate();
  const { tab: paramTab } = useParams();
  const [searchParams] = useSearchParams();
  const { user, role, accountType } = useAuth();
  const { orgId, orgName: wsOrgName, canManageBilling, refreshWorkspace } = useWorkspace();
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  // Active Screen / Sub-Screen View ('main' | 'privacy' | 'notifications' | 'freelancer' | 'media' | 'security' | 'billing')
  const [currentView, setCurrentView] = useState<'main' | 'privacy' | 'notifications' | 'freelancer' | 'media' | 'security' | 'billing'>(() => {
    const tab = paramTab || searchParams.get('tab');
    if (tab === 'billing') return 'billing';
    if (tab === 'privacy') return 'privacy';
    if (tab === 'notifications') return 'notifications';
    if (tab === 'freelancer') return 'freelancer';
    if (tab === 'media' || tab === 'audio-video') return 'media';
    if (tab === 'security') return 'security';
    return 'main';
  });

  // Watch URL params / search param for tab changes
  useEffect(() => {
    const tab = paramTab || searchParams.get('tab');
    if (tab === 'billing') {
      setCurrentView('billing');
    } else if (tab === 'privacy') {
      setCurrentView('privacy');
    } else if (tab === 'notifications') {
      setCurrentView('notifications');
    } else if (tab === 'freelancer') {
      setCurrentView('freelancer');
    } else if (tab === 'media' || tab === 'audio-video') {
      setCurrentView('media');
    } else if (tab === 'security') {
      setCurrentView('security');
    } else if (!tab) {
      setCurrentView('main');
    }
  }, [searchParams, paramTab]);

  const navigateToView = (view: 'main' | 'privacy' | 'notifications' | 'freelancer' | 'media' | 'security' | 'billing') => {
    setCurrentView(view);
    if (view === 'main') {
      navigate('/settings');
    } else {
      navigate(`/settings/${view}`);
    }
  };

  // Billing & Subscription Telemetry state
  const [subData, setSubData] = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);

  const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : (import.meta.env.VITE_API_URL || 'http://localhost:3000/api');

  const fetchBillingData = useCallback(async () => {
    if (!user) return;
    setLoadingBilling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const targetOrgId = orgId || activeOrgId;

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
        const subJson = await subRes.json();
        setSubData(subJson);
      }
      if (usageRes.ok) {
        const usageJson = await usageRes.json();
        setUsageData(usageJson);
      }

      if (!targetOrgId || canManageBilling) {
        const payRes = await fetch(`${apiUrl}/subscriptions/payments${targetOrgId ? `?orgId=${targetOrgId}` : ''}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(targetOrgId ? { 'x-organization-id': targetOrgId } : {}),
          },
        });
        if (payRes.ok) {
          const payJson = await payRes.json();
          setPaymentHistory(payJson.payments || []);
        }
      }
    } catch (err) {
      console.error('Error fetching billing telemetry:', err);
    } finally {
      setLoadingBilling(false);
    }
  }, [user, orgId, activeOrgId, canManageBilling, apiUrl]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel this subscription? Entitlements remain active until the end of your billing cycle.')) {
      return;
    }
    setCancellingSub(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const targetOrgId = orgId || activeOrgId;
      const res = await fetch(`${apiUrl}/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(targetOrgId ? { 'x-organization-id': targetOrgId } : {}),
        },
        body: JSON.stringify({
          orgId: targetOrgId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel subscription');
      toast.success('Subscription scheduled for cancellation at period end.');
      await fetchBillingData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel subscription');
    } finally {
      setCancellingSub(false);
    }
  };

  // Role checking
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  // General & Preferences
  const { theme, setTheme } = useTheme();
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Organization settings
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [updatingCurrency, setUpdatingCurrency] = useState(false);
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgGst, setOrgGst] = useState('');

  // Privacy Settings (Status visibility, read receipts, blocks, mutes)
  const [showOnline, setShowOnline] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [showLastSeen, setShowLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [readReceipts, setReadReceipts] = useState<boolean>(true);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [mutedChannels, setMutedChannels] = useState<any[]>([]);

  // Notifications Preferences
  const [meetingInvites, setMeetingInvites] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const [roleChanges, setRoleChanges] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(false);
  const [emailDigest, setEmailDigest] = useState(true);

  // Resend Test Email State
  const [testEmailAddress, setTestEmailAddress] = useState(user?.email || '');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; deliveryId?: string } | null>(null);

  // Freelancer Scope & Portal
  const isFreelancerRole = role === 'freelancer';
  const [freelancerWorkType, setFreelancerWorkType] = useState<'organization' | 'independent'>('independent');
  const [freelancerStats, setFreelancerStats] = useState({
    activeProjects: 0,
    openTasks: 0,
    invoicesCount: 0,
  });

  // Media / Hardware WebRTC
  const [audioInput, setAudioInput] = useState('Default System Microphone');
  const [videoInput, setVideoInput] = useState('Integrated HD Webcam (1080p)');
  const [e2eeEnabled, setE2eeEnabled] = useState(true);

  // Security / Password Reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  // Load All User & Org Settings
  const loadSettings = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Fetch User Data & Preferences
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (uData) {
        if (uData.preferences) {
          const p = uData.preferences;
          setTheme(p.theme === 'light' ? 'light' : 'dark');
          setHapticsEnabled(p.hapticFeedback ?? true);
          setMeetingInvites(p.meetingInvites ?? true);
          setMeetingReminders(p.meetingReminders ?? true);
          setRoleChanges(p.roleUpdates ?? true);
          setSystemAlerts(p.systemAlerts ?? false);
          setEmailDigest(p.weeklyDigest ?? true);
        }
        if (uData.freelancer_type) {
          setFreelancerWorkType(uData.freelancer_type);
        }
      }

      // 2. Check Org & Role Permissions
      let currentOrgId = orgId || uData?.org_id;

      if (!currentOrgId) {
        // Fallback check user_organizations or owned organizations
        const { data: userOrgs } = await supabase
          .from('user_organizations')
          .select('org_id, role')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (userOrgs?.org_id) {
          currentOrgId = userOrgs.org_id;
        } else {
          const { data: ownedOrg } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id)
            .limit(1)
            .maybeSingle();
          if (ownedOrg?.id) {
            currentOrgId = ownedOrg.id;
          }
        }
      }

      if (currentOrgId) {
        setActiveOrgId(currentOrgId);
        const { data: userOrg } = await supabase
          .from('user_organizations')
          .select('role')
          .eq('user_id', user.id)
          .eq('org_id', currentOrgId)
          .maybeSingle();

        if (userOrg && (userOrg.role === 'owner' || userOrg.role === 'administrator')) {
          setIsOwnerOrAdmin(true);
        } else if (['owner', 'administrator'].includes(role || '')) {
          setIsOwnerOrAdmin(true);
        }

        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, address, gst_number, default_currency')
          .eq('id', currentOrgId)
          .maybeSingle();

        if (orgData) {
          if (orgData.default_currency) setDefaultCurrency(orgData.default_currency);
          setOrgName(orgData.name || '');
          setOrgAddress(orgData.address || '');
          setOrgGst(orgData.gst_number || '');
        }
      } else if (['owner', 'administrator', 'director', 'ceo'].includes(role || '')) {
        setIsOwnerOrAdmin(true);
      }

      // Check if user preferences has a currency fallback
      if (uData?.preferences?.currency) {
        setDefaultCurrency(uData.preferences.currency);
      }

      // 3. Privacy Settings
      const { data: pData } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (pData) {
        setShowOnline(pData.show_online || 'everyone');
        setShowLastSeen(pData.show_last_seen || 'everyone');
        setReadReceipts(pData.enable_read_receipts ?? true);
      }

      // 4. Blocked Users
      const { data: bData } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, blocked_user:blocked_id(id, full_name, email, avatar_url)')
        .eq('blocker_id', user.id);
      setBlockedUsers(bData || []);

      // 5. Muted Channels
      const { data: mData } = await supabase
        .from('channel_mutes')
        .select('id, channel_id, channel:channel_id(id, name, type)')
        .eq('user_id', user.id);
      setMutedChannels(mData || []);

      // 6. Freelancer stats
      if (role === 'freelancer' || isFreelancerRole) {
        const [projRes, tasksRes, invRes] = await Promise.all([
          supabase.from('projects').select('id', { count: 'exact', head: true }).or(`owner_id.eq.${user.id}`),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', user.id),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('owner_id', user.id)
        ]);
        setFreelancerStats({
          activeProjects: projRes.count || 0,
          openTasks: tasksRes.count || 0,
          invoicesCount: invRes.count || 0,
        });
      }

    } catch (err) {
      console.error('Settings load error:', err);
    }
  }, [user, orgId, role, isFreelancerRole]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update Currency
  const handleUpdateCurrency = async (currCode: string) => {
    if (!user) return;
    setDefaultCurrency(currCode); // Optimistic UI update
    setUpdatingCurrency(true);

    try {
      const targetOrgId = activeOrgId || orgId;
      if (targetOrgId) {
        await supabase
          .from('organizations')
          .update({ default_currency: currCode })
          .eq('id', targetOrgId);
      }

      // Also persist to user preferences so currency stays functional for individual/all views
      const { data: uData } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      const nextPreferences = { ...(uData?.preferences || {}), currency: currCode };
      await supabase
        .from('users')
        .update({ preferences: nextPreferences })
        .eq('id', user.id);

      if (refreshWorkspace) {
        await refreshWorkspace();
      }

      toast.success(`Currency switched to ${currCode}`);
    } catch (e: any) {
      console.error('Currency update failed:', e);
      toast.error(e.message || 'Failed to update currency');
    } finally {
      setUpdatingCurrency(false);
    }
  };

  // Update Org Details
  const handleSaveOrgDetails = async () => {
    const targetOrgId = activeOrgId || orgId;
    if (!targetOrgId) {
      toast.error('No organization associated with this account');
      return;
    }
    if (!orgName.trim() || !orgAddress.trim()) {
      toast.error('Company Name and Address are required');
      return;
    }
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName.trim(),
          address: orgAddress.trim(),
          gst_number: orgGst.trim() || null,
        })
        .eq('id', targetOrgId);

      if (error) throw error;
      setIsCompanyModalVisible(false);
      toast.success('Company profile updated successfully.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update company details');
    }
  };

  // Save Preferences
  const handleUpdatePreference = async (partial: any) => {
    if (!user) return;
    try {
      const { data: uData } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .single();

      const nextPreferences = { ...(uData?.preferences || {}), ...partial };
      await supabase
        .from('users')
        .update({ preferences: nextPreferences, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Save Privacy Setting
  const handleSavePrivacySetting = async (key: string, value: any) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('privacy_settings')
        .upsert({
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Privacy control updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update privacy setting');
    }
  };

  // Unblock user
  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);

      if (error) throw error;
      setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedId));
      toast.success('User unblocked');
    } catch (err: any) {
      toast.error('Failed to unblock user');
    }
  };

  // Unmute channel
  const handleUnmute = async (channelId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('channel_mutes')
        .delete()
        .eq('user_id', user.id)
        .eq('channel_id', channelId);

      if (error) throw error;
      setMutedChannels(prev => prev.filter(m => m.channel_id !== channelId));
      toast.success('Channel unmuted');
    } catch (err: any) {
      toast.error('Failed to unmute channel');
    }
  };

  // Save Notifications
  const handleSaveNotificationPreferences = async () => {
    try {
      await handleUpdatePreference({
        meetingInvites,
        meetingReminders,
        roleUpdates: roleChanges,
        systemAlerts,
        weeklyDigest: emailDigest,
      });
      toast.success('Notification preferences saved successfully.');
      setCurrentView('main');
    } catch (e) {
      toast.error('Failed to save preferences.');
    }
  };

  // Test Email Workflow
  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const apiUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : '';
      const res = await fetch(`${apiUrl}/api/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ recipient: testEmailAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to send test email');
      }
      setTestEmailResult({ success: true, message: data.message, deliveryId: data.deliveryId });
      toast.success('Test email sent via Resend successfully!');
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err.message });
      toast.error(err.message || 'Error dispatching test email');
    } finally {
      setTestEmailSending(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      setPasswordUpdating(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentView('main');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setPasswordUpdating(false);
    }
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'privacy': return 'Privacy Controls';
      case 'notifications': return 'Notification Preferences';
      case 'freelancer': return 'Freelancer Workspace Scope';
      case 'media': return 'Audio & Video Routing';
      case 'security': return 'Change Password & Security';
      case 'billing': return 'Subscription & Plans';
      default: return 'Settings';
    }
  };

  const getViewDescription = () => {
    switch (currentView) {
      case 'privacy': return 'Manage real-time status visibility, read receipts, blocked members, and muted channels.';
      case 'notifications': return 'Customize alert thresholds, meeting reminders, role updates, and weekly digest.';
      case 'freelancer': return 'Select your active engagement mode, rate scoping, and client project assignments.';
      case 'media': return 'Configure hardware microphones, capture camera devices, and E2EE parameters.';
      case 'security': return 'Update master password credentials and inspect active session tokens.';
      case 'billing': return 'Customer account plan, live quota entitlements, verified payer attribution, and transaction ledger.';
      default: return 'Configure theme display, notification preferences, organization currency, and security credentials.';
    }
  };

  return (
    <div className="flex-1 space-y-6 pb-12 font-sans select-none text-muted">
      
      {/* ── Page Header Standard ── */}
      <PageHeader
        title={getViewTitle()}
        description={getViewDescription()}
        actions={
          <button
            type="button"
            onClick={() => {
              if (currentView !== 'main') {
                navigateToView('main');
              } else {
                navigate('/dashboard');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface hover:bg-surface-2 text-muted hover:text-text border border-line text-xs font-medium transition-colors shrink-0 cursor-pointer shadow-2xs"
            title={currentView !== 'main' ? 'Return to Settings' : 'Return to Dashboard'}
          >
            <span>{currentView !== 'main' ? '← Settings' : '← Dashboard'}</span>
          </button>
        }
      />

      {/* ── VIEW 1: MAIN SETTINGS ── */}
      {currentView === 'main' && (
        <div className="space-y-6 animate-fade-in">

          {/* 1. Display */}
          <div className="animate-fade-up stagger-1">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              DISPLAY
            </span>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-visible">
              <SettingsRow
                icon={Moon}
                title="Dark Mode"
                description="Use dark theme across the app"
              >
                <Toggle
                  checked={theme === 'dark'}
                  onChange={() => {
                    const next = theme === 'dark' ? 'light' : 'dark';
                    setTheme(next);
                    handleUpdatePreference({ theme: next });
                  }}
                  ariaLabel="Toggle dark mode"
                />
              </SettingsRow>
            </div>
          </div>

          {/* 2. Preferences */}
          <div className="animate-fade-up stagger-2">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              PREFERENCES
            </span>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-visible">
              <SettingsRow
                icon={Smartphone}
                title="Haptic & Audio Feedback"
                description="Feedback sound on interaction toggles and room alerts"
              >
                <Toggle
                  checked={hapticsEnabled}
                  onChange={(next) => {
                    setHapticsEnabled(next);
                    handleUpdatePreference({ hapticFeedback: next });
                  }}
                  ariaLabel="Toggle haptic and audio feedback"
                />
              </SettingsRow>

              <div 
                onClick={() => navigateToView('notifications')}
                className="cursor-pointer"
              >
                <SettingsRow
                  icon={Bell}
                  title="Notification Preferences"
                  description="Push alerts, 15m meeting reminders & email digests"
                >
                  <ChevronRight size={15} className="text-muted shrink-0" />
                </SettingsRow>
              </div>

              <div 
                onClick={() => navigateToView('media')}
                className="cursor-pointer"
              >
                <SettingsRow
                  icon={Video}
                  title="Audio & Video Routing"
                  description="Default microphone, camera capture & WebRTC E2EE"
                >
                  <ChevronRight size={15} className="text-muted shrink-0" />
                </SettingsRow>
              </div>
            </div>
          </div>

          {/* 3. Subscription & Plans */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              SUBSCRIPTION & PLANS
            </span>
            <div className="bg-surface rounded-xl border border-line p-4 sm:p-5 overflow-visible flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <CreditCard size={18} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14.5px] font-medium text-text leading-tight">{subData?.planName || 'Free Tier'}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-accent-soft text-accent border border-accent/20">
                      {subData?.status ? subData.status.toUpperCase() : 'FREE'}
                    </span>
                    {subData?.customerType && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-surface-2 text-muted border border-line">
                        {subData.customerType === 'organization' ? 'Organization' : 'Freelancer'}
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-muted leading-relaxed">
                    {subData?.hasActiveSubscription 
                      ? 'Active monthly subscription. Payer tracked separately from account owner.'
                      : 'Baseline Free plan quota active. Upgrade anytime for higher project & workflow limits.'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={() => navigateToView('billing')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface hover:bg-surface-2 text-muted hover:text-text text-xs font-medium border border-line transition-colors cursor-pointer shadow-2xs"
                >
                  <CreditCard size={13} />
                  <span>Subscription Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  <span>Plans & Pricing →</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Freelancer Workspace Portal (for Freelancers) */}
          {(role === 'freelancer' || isFreelancerRole) && (
            <div>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
                FREELANCER WORKSPACE
              </span>
              <div 
                onClick={() => navigateToView('freelancer')}
                className="bg-surface rounded-xl border border-line overflow-visible cursor-pointer"
              >
                <SettingsRow
                  icon={Briefcase}
                  title="Freelancer Engagement & Rates"
                  description="Contract scopes, independent invoicing & deliverables"
                >
                  <ChevronRight size={15} className="text-muted shrink-0" />
                </SettingsRow>
              </div>
            </div>
          )}

          {/* 5. Organization Settings for Owners & Admins */}
          {isOwnerOrAdmin && (
            <>
              {/* Organization Currency */}
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase">
                    ORGANIZATION CURRENCY
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-medium tracking-[0.08em] text-accent">
                    Active: {SUPPORTED_CURRENCIES.find(c => c.code === defaultCurrency)?.name || defaultCurrency}
                  </span>
                </div>
                <div className="bg-surface rounded-xl border border-line p-4 overflow-visible">
                  <div 
                    className="grid gap-[10px] w-full"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
                  >
                    {SUPPORTED_CURRENCIES.map((curr) => {
                      const isSelected = defaultCurrency === curr.code;
                      return (
                        <button
                          key={curr.code}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          disabled={updatingCurrency}
                          onClick={() => handleUpdateCurrency(curr.code)}
                          className={`flex flex-col justify-between p-3 rounded-[10px] border text-left transition-all duration-150 cursor-pointer select-none h-full min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 ${
                            isSelected 
                              ? 'bg-accent border-accent text-white shadow-2xs' 
                              : 'bg-surface border-line text-muted hover:text-text hover:bg-surface-2'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-xs font-mono font-bold ${isSelected ? 'text-white' : 'text-text'}`}>
                                {curr.symbol}
                              </span>
                              <span className={`font-mono font-bold text-xs tracking-wide truncate ${isSelected ? 'text-white' : 'text-text'}`}>
                                {curr.code}
                              </span>
                            </div>
                            <div className="shrink-0 ml-1.5">
                              {isSelected ? (
                                <div className="w-4 h-4 rounded-full bg-white text-accent flex items-center justify-center">
                                  <Check size={10} strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-line bg-surface-2" />
                              )}
                            </div>
                          </div>
                          <span className={`text-[11px] truncate w-full leading-tight ${isSelected ? 'text-white/85' : 'text-muted'}`}>
                            {curr.name.replace(/\s*\([^)]*\)/, '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Organization Settings */}
              <div>
                <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
                  ORGANIZATION SETTINGS
                </span>
                <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-visible">
                  <div 
                    onClick={() => setIsCompanyModalVisible(true)}
                    className="cursor-pointer"
                  >
                    <SettingsRow
                      icon={Building2}
                      title="Company Profile"
                      description="Billed-from details, tax GSTIN & registered office"
                    >
                      <ChevronRight size={15} className="text-muted shrink-0" />
                    </SettingsRow>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 6. Security & Privacy */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              SECURITY & PRIVACY
            </span>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-visible">
              <div 
                onClick={() => navigateToView('privacy')}
                className="cursor-pointer"
              >
                <SettingsRow
                  icon={Shield}
                  title="Privacy Controls"
                  description="Online visibility, read receipts, blocked users & mute list"
                >
                  <ChevronRight size={15} className="text-muted shrink-0" />
                </SettingsRow>
              </div>

              <div 
                onClick={() => navigateToView('security')}
                className="cursor-pointer"
              >
                <SettingsRow
                  icon={Lock}
                  title="Change Password"
                  description="Update master authentication credentials"
                >
                  <ChevronRight size={15} className="text-muted shrink-0" />
                </SettingsRow>
              </div>
            </div>
          </div>

          {/* 7. About */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              ABOUT
            </span>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-visible">
              <div className="flex justify-between items-center py-3.5 px-[18px]">
                <span className="text-xs text-muted">App Version</span>
                <span className="text-xs font-mono font-medium text-text">1.0.0 (Production)</span>
              </div>
              <div className="flex justify-between items-center py-3.5 px-[18px]">
                <span className="text-xs text-muted">Supabase Environment</span>
                <span className="text-xs font-mono font-medium text-emerald-500">Connected</span>
              </div>
              <div className="flex justify-between items-center py-3.5 px-[18px] min-w-0">
                <span className="text-xs text-muted shrink-0 mr-3">Signed In As</span>
                <span className="text-xs font-mono font-medium text-text truncate max-w-[260px] sm:max-w-none" title={user?.email}>
                  {user?.email}
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── VIEW 2: PRIVACY CONTROLS ── */}
      {currentView === 'privacy' && (
        <div className="space-y-6">
          {/* Status Visibility */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              STATUS VISIBILITY
            </span>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-hidden">
              <div className="py-4 px-[18px]">
                <div className="text-[14.5px] font-medium text-text leading-tight">Who can see my online status</div>
                <div className="text-[12.5px] text-muted leading-relaxed mt-0.5">Control whether workspace colleagues can see your real-time presence.</div>
                <div className="grid grid-cols-3 gap-2 mt-3 max-w-sm">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setShowOnline(opt);
                        handleSavePrivacySetting('show_online', opt);
                      }}
                      className={`py-1.5 px-3 rounded text-xs font-medium capitalize border transition-colors cursor-pointer text-center ${
                        showOnline === opt 
                          ? 'bg-accent border-accent text-white shadow-2xs' 
                          : 'bg-surface-2 border-line text-muted hover:text-text'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-4 px-[18px]">
                <div className="text-[14.5px] font-medium text-text leading-tight">Who can see my last seen status</div>
                <div className="text-[12.5px] text-muted leading-relaxed mt-0.5">Control visibility of your last recorded session activity.</div>
                <div className="grid grid-cols-3 gap-2 mt-3 max-w-sm">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setShowLastSeen(opt);
                        handleSavePrivacySetting('show_last_seen', opt);
                      }}
                      className={`py-1.5 px-3 rounded text-xs font-medium capitalize border transition-colors cursor-pointer text-center ${
                        showLastSeen === opt 
                          ? 'bg-accent border-accent text-white shadow-2xs' 
                          : 'bg-surface-2 border-line text-muted hover:text-text'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Messaging */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              MESSAGING
            </span>
            <div className="bg-surface rounded-xl border border-line overflow-hidden">
              <SettingsRow
                title="Read Receipts"
                description="If turned off, you won't send or receive read receipts."
              >
                <Toggle
                  checked={readReceipts}
                  onChange={(next) => {
                    setReadReceipts(next);
                    handleSavePrivacySetting('enable_read_receipts', next);
                  }}
                  ariaLabel="Toggle read receipts"
                />
              </SettingsRow>
            </div>
          </div>

          {/* Blocked Users */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              BLOCKED USERS
            </span>
            <div className="bg-surface rounded-xl border border-line overflow-hidden divide-y divide-line">
              {blockedUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  No blocked users
                </div>
              ) : (
                blockedUsers.map((item) => (
                  <div key={item.blocked_id} className="py-3.5 px-[18px] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-text text-xs">{item.blocked_user?.full_name || 'User'}</div>
                      <div className="text-[11px] text-muted">{item.blocked_user?.email || ''}</div>
                    </div>
                    <button
                      onClick={() => handleUnblock(item.blocked_id)}
                      className="px-2.5 py-1 rounded bg-surface-2 hover:bg-danger/10 text-muted hover:text-danger border border-line text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Muted Conversations */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              MUTED CONVERSATIONS
            </span>
            <div className="bg-surface rounded-xl border border-line overflow-hidden divide-y divide-line">
              {mutedChannels.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  No muted conversations
                </div>
              ) : (
                mutedChannels.map((item) => (
                  <div key={item.channel_id} className="py-3.5 px-[18px] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-text text-xs">{item.channel?.name || 'Muted Channel'}</div>
                      <div className="text-[11px] text-muted capitalize">{item.channel?.type || ''}</div>
                    </div>
                    <button
                      onClick={() => handleUnmute(item.channel_id)}
                      className="px-2.5 py-1 rounded bg-surface-2 hover:bg-danger/10 text-muted hover:text-danger border border-line text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Unmute
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 3: NOTIFICATIONS ── */}
      {currentView === 'notifications' && (
        <div className="space-y-6">
          {/* Push Notifications Section */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              PUSH NOTIFICATIONS
            </span>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-hidden">
              <SettingsRow
                icon={Calendar}
                title="Meeting Invitations"
                description="Notify me of new meeting invites"
              >
                <Toggle
                  checked={meetingInvites}
                  onChange={setMeetingInvites}
                  ariaLabel="Toggle meeting invitations"
                />
              </SettingsRow>
              <SettingsRow
                icon={AlarmClock}
                title="Meeting Reminders"
                description="Send notifications 15m before meetings"
              >
                <Toggle
                  checked={meetingReminders}
                  onChange={setMeetingReminders}
                  ariaLabel="Toggle meeting reminders"
                />
              </SettingsRow>
              <SettingsRow
                icon={ShieldAlert}
                title="Role Updates"
                description="Alert me when my role is updated"
              >
                <Toggle
                  checked={roleChanges}
                  onChange={setRoleChanges}
                  ariaLabel="Toggle role updates"
                />
              </SettingsRow>
              <SettingsRow
                icon={AlertCircle}
                title="System Alerts"
                description="Notify about downtime & server maintenance"
              >
                <Toggle
                  checked={systemAlerts}
                  onChange={setSystemAlerts}
                  ariaLabel="Toggle system alerts"
                />
              </SettingsRow>
            </div>
          </div>

          {/* Email Preferences Section */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              EMAIL PREFERENCES
            </span>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line overflow-hidden">
              <SettingsRow
                icon={Mail}
                title="Weekly Digest"
                description="Get weekly summary of tasks & meetings"
              >
                <Toggle
                  checked={emailDigest}
                  onChange={setEmailDigest}
                  ariaLabel="Toggle weekly digest"
                />
              </SettingsRow>
            </div>
          </div>

          {/* Resend Diagnostic Test Workflow */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              RESEND EMAIL VERIFICATION
            </span>
            <div className="bg-surface rounded-xl border border-line p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <div className="text-[14.5px] font-medium text-text leading-tight">Send Diagnostic Email</div>
                  <div className="text-[12.5px] text-muted leading-relaxed">Verify runtime email delivery and inspect Resend delivery logs</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1 max-w-lg">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 px-3 py-1.5 rounded bg-app border border-line text-xs text-text placeholder-muted focus:outline-none focus:border-accent/50 font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={testEmailSending}
                  className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <RefreshCw size={12} className={testEmailSending ? 'animate-spin' : ''} />
                  <span>{testEmailSending ? 'Dispatching...' : 'Send Test Email'}</span>
                </button>
              </div>

              {testEmailResult && (
                <div
                  className={`p-3 rounded-lg text-xs font-mono border max-w-lg ${
                    testEmailResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400'
                      : 'bg-danger/10 border-danger/20 text-danger'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    {testEmailResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    <span>{testEmailResult.success ? 'Resend Delivery Verified' : 'Delivery Error'}</span>
                  </div>
                  <div>{testEmailResult.message}</div>
                  {testEmailResult.deliveryId && (
                    <div className="text-[10px] text-muted mt-1">
                      Delivery ID: {testEmailResult.deliveryId}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveNotificationPreferences}
              className="px-4 py-2 rounded bg-accent hover:bg-accent/90 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* ── VIEW 4: FREELANCER ENGAGEMENT PORTAL ── */}
      {currentView === 'freelancer' && (
        <div className="space-y-6">
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              ENGAGEMENT MODEL
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div 
                onClick={() => setFreelancerWorkType('independent')}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  freelancerWorkType === 'independent'
                    ? 'bg-accent-soft border-accent text-text'
                    : 'bg-surface border-line hover:bg-surface-2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[14.5px] font-medium text-text leading-tight">Independent Contractor</span>
                  {freelancerWorkType === 'independent' && <Check size={16} className="text-accent" />}
                </div>
                <p className="text-[12.5px] text-muted leading-relaxed">Direct client contracts, personal invoicing, and independent project management.</p>
              </div>

              <div 
                onClick={() => setFreelancerWorkType('organization')}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  freelancerWorkType === 'organization'
                    ? 'bg-accent-soft border-accent text-text'
                    : 'bg-surface border-line hover:bg-surface-2 text-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[14.5px] font-medium text-text leading-tight">Agency / Org Assigned</span>
                  {freelancerWorkType === 'organization' && <Check size={16} className="text-accent" />}
                </div>
                <p className="text-[12.5px] text-muted leading-relaxed">Assigned into agency workspaces with strict deliverable-based permissions.</p>
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              DELIVERABLE TELEMETRY
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 bg-surface border border-line rounded-xl">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Active Projects</div>
                <div className="text-xl sm:text-2xl font-bold text-text mt-1">{freelancerStats.activeProjects}</div>
              </div>
              <div className="p-4 bg-surface border border-line rounded-xl">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Open Tasks</div>
                <div className="text-xl sm:text-2xl font-bold text-text mt-1">{freelancerStats.openTasks}</div>
              </div>
              <div className="p-4 bg-surface border border-line rounded-xl">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Invoices</div>
                <div className="text-xl sm:text-2xl font-bold text-text mt-1">{freelancerStats.invoicesCount}</div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                supabase.from('users').update({ freelancer_type: freelancerWorkType }).eq('id', user?.id).then();
                toast.success('Freelancer preferences saved');
                navigateToView('main');
              }}
              className="px-4 py-2 rounded bg-accent hover:bg-accent/90 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              Save Scope Settings
            </button>
          </div>
        </div>
      )}

      {/* ── VIEW 5: AUDIO & VIDEO ROUTING ── */}
      {currentView === 'media' && (
        <div className="space-y-6">
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              HARDWARE & CAPTURE DEVICES
            </span>
            <div className="bg-surface rounded-xl border border-line p-4 sm:p-5 space-y-4 max-w-lg">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
                  Microphone Input Device
                </label>
                <select 
                  value={audioInput} 
                  onChange={(e) => setAudioInput(e.target.value)}
                  className="w-full bg-app border border-line rounded px-3 py-1.5 text-xs text-text focus:outline-none focus:border-accent/50 transition-colors"
                >
                  <option>Default System Microphone</option>
                  <option>Studio USB Condenser</option>
                  <option>Communications Headset</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
                  Camera Capture Device
                </label>
                <select 
                  value={videoInput} 
                  onChange={(e) => setVideoInput(e.target.value)}
                  className="w-full bg-app border border-line rounded px-3 py-1.5 text-xs text-text focus:outline-none focus:border-accent/50 transition-colors"
                >
                  <option>Integrated HD Webcam (1080p)</option>
                  <option>External 4K Capture Device</option>
                </select>
              </div>

              <div className="pt-2 border-t border-line">
                <SettingsRow
                  icon={Shield}
                  title="End-to-End Encryption (E2EE)"
                  description="LiveKit SFU and private chat mesh crypto."
                  className="!px-0 !py-2 hover:!bg-transparent"
                >
                  <Toggle
                    checked={e2eeEnabled}
                    onChange={setE2eeEnabled}
                    ariaLabel="Toggle End-to-End Encryption"
                  />
                </SettingsRow>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 6: SECURITY / CHANGE PASSWORD ── */}
      {currentView === 'security' && (
        <div className="space-y-6">
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              MASTER CREDENTIALS
            </span>
            <div className="bg-surface rounded-xl border border-line p-5 sm:p-6 max-w-lg">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
                    New Password
                  </label>
                  <input 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-app border border-line focus:border-accent/50 rounded px-3 py-1.5 text-xs text-text placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1.5">
                    Confirm New Password
                  </label>
                  <input 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-app border border-line focus:border-accent/50 rounded px-3 py-1.5 text-xs text-text placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={passwordUpdating}
                    className="px-4 py-2 rounded bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    {passwordUpdating ? 'Updating Password...' : 'Save New Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 7: CUSTOMER SUBSCRIPTION & BILLING TELEMETRY ── */}
      {currentView === 'billing' && (
        <div className="space-y-6">
          {/* Top Actions & Sync Bar */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1">
              CUSTOMER SUBSCRIPTION DETAILS
            </span>
            <button
              onClick={() => fetchBillingData()}
              disabled={loadingBilling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface hover:bg-surface-2 border border-line text-xs font-medium text-muted hover:text-text transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw size={12} className={loadingBilling ? 'animate-spin' : ''} />
              <span>Refresh Telemetry</span>
            </button>
          </div>

          {/* Member Restricted Billing Alert Banner */}
          {(orgId || subData?.customerType === 'organization') && !canManageBilling && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-amber-600 dark:text-amber-300 text-xs">
              <Lock size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                  Billing & Subscription Management Restricted
                </div>
                <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                  Contact your organization owner or billing administrator to manage your subscription.
                </div>
                <div className="text-[10px] text-amber-700/70 dark:text-amber-300/70 pt-0.5">
                  You are viewing read-only plan details for this organization workspace. Billing mutations, payments, and checkout actions require elevated billing privileges.
                </div>
              </div>
            </div>
          )}

          {/* 1. Customer Account & Plan Overview Card */}
          <div className="bg-surface rounded-xl border border-line overflow-visible p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-line">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-[38px] h-[38px] rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  {subData?.customerType === 'organization' ? <Building2 size={18} /> : <User size={18} />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-text">
                      {subData?.customerName || wsOrgName || user?.user_metadata?.full_name || 'Customer Account'}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-accent-soft text-accent border border-accent/20">
                      {subData?.planName || ((orgId || activeOrgId || accountType === 'organization') ? 'Business Free' : (accountType === 'freelancer' ? 'Freelancer Free' : 'Free Plan'))}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      subData?.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20'
                        : subData?.status === 'free'
                        ? 'bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20'
                        : 'bg-surface-2 text-muted border border-line'
                    }`}>
                      {subData?.status || 'FREE'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Customer Account: <span className="text-text font-medium capitalize">{subData?.customerType || ((orgId || activeOrgId || accountType === 'organization') ? 'Organization' : (accountType === 'freelancer' ? 'Freelancer' : 'Pending Selection'))}</span>
                    {' · '}
                    Billing Interval: <span className="text-text font-medium capitalize">{subData?.interval || 'monthly'}</span>
                  </p>
                </div>
              </div>

              {/* Permitted Plan Upgrades or Downgrades */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
                {(!orgId || canManageBilling) ? (
                  <>
                    <button
                      onClick={() => navigate('/pricing')}
                      className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>Change Plan / Upgrade</span>
                    </button>
                    {subData?.hasActiveSubscription && subData?.tier && !subData.tier.includes('free') && (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancellingSub}
                        className="px-3 py-1.5 bg-surface hover:bg-danger/10 border border-line hover:border-danger/30 text-muted hover:text-danger text-xs font-medium rounded transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {cancellingSub ? 'Cancelling...' : 'Cancel Subscription'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    disabled
                    title="Only organization owner or billing administrator can modify subscription"
                    className="px-3.5 py-1.5 bg-surface-2 text-muted cursor-not-allowed text-xs font-semibold rounded border border-line flex items-center gap-1.5 opacity-60"
                  >
                    <Lock size={13} />
                    <span>Manage Plans (Restricted)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Key Subscription Telemetry Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-surface border border-line">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Current Recurring Rate</div>
                <div className="text-lg font-bold text-text mt-1">
                  {subData?.subscription?.last_payment_amount 
                    ? `₹${Math.round(subData.subscription.last_payment_amount / 100)}`
                    : subData?.tier === 'freelancer_starter' ? '₹299'
                    : subData?.tier === 'freelancer_pro' ? '₹599'
                    : subData?.tier === 'business_starter' ? '₹399'
                    : subData?.tier === 'business_pro' ? '₹499'
                    : '₹0'}
                  <span className="text-xs font-normal text-muted"> / mo</span>
                </div>
                <div className="text-[11px] text-muted mt-0.5">Authoritative Server Rate</div>
              </div>

              <div className="p-3.5 rounded-lg bg-surface border border-line">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Account Entitlement Scope</div>
                <div className="text-base font-bold text-text mt-1 capitalize">
                  {subData?.customerType === 'organization' ? 'Organization-wide' : 'Individual Freelancer'}
                </div>
                <div className="text-[11px] text-muted mt-0.5">Applies to all workspace assets</div>
              </div>

              <div className="p-3.5 rounded-lg bg-surface border border-line">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Current Period Activated</div>
                <div className="text-sm font-semibold text-text mt-1">
                  {subData?.currentPeriodStart ? new Date(subData.currentPeriodStart).toLocaleDateString() : 'Active Baseline'}
                </div>
                <div className="text-[11px] text-muted mt-0.5">Validated provider timestamp</div>
              </div>

              <div className="p-3.5 rounded-lg bg-surface border border-line">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Next Billing / Expiry Date</div>
                <div className="text-sm font-semibold text-text mt-1">
                  {subData?.currentPeriodEnd ? new Date(subData.currentPeriodEnd).toLocaleDateString() : 'Perpetual Free Tier'}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {subData?.cancelAtPeriodEnd ? 'Cancels at end of cycle' : 'Auto-renewing cycle'}
                </div>
              </div>
            </div>

            {/* Payer Attribution */}
            <div className="p-3.5 rounded-lg bg-surface-2 border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-text flex items-center gap-1.5">
                  <Shield size={14} className="text-accent" />
                  <span>Audited Payer Tracking</span>
                </div>
                <div className="text-muted text-[11px]">
                  The customer receiving entitlements is <strong className="text-text">{subData?.customerName || 'This Account'}</strong>.
                  {' '}
                  Payer attribution records the authenticated user executing payment transactions.
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <div className="text-[11px] font-mono text-muted">Registered Payer:</div>
                <div className="text-xs font-mono font-medium text-text">
                  {subData?.payerUserId ? `User: ${subData.payerUserId}` : (subData?.hasActiveSubscription ? 'Verified Purchaser' : 'System Default Allocation')}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Usage Limits & Live Entitlements Grid */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase block px-1 mb-2">
              LIVE ENTITLEMENTS & RESOURCE QUOTAS
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Active Projects Quota */}
              <div className="bg-surface rounded-xl border border-line p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-muted uppercase tracking-wider">Active Projects</span>
                  <span className="text-xs font-mono font-bold text-text">
                    {usageData?.projects?.current ?? 0} / {usageData?.projects?.max === -1 ? '∞' : (usageData?.projects?.max ?? 3)}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden border border-line">
                  <div 
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ 
                      width: usageData?.projects?.max === -1 
                        ? '100%' 
                        : `${Math.min(100, Math.round(((usageData?.projects?.current || 0) / (usageData?.projects?.max || 3)) * 100))}%` 
                    }}
                  />
                </div>
                <div className="text-[11px] text-muted flex items-center justify-between">
                  <span>Backend limit enforced</span>
                  <span className="font-mono">{usageData?.projects?.max === -1 ? 'Unlimited' : `${usageData?.projects?.max || 3} Max`}</span>
                </div>
              </div>

              {/* Workflows Quota */}
              <div className="bg-surface rounded-xl border border-line p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-muted uppercase tracking-wider">Active Workflows</span>
                  <span className="text-xs font-mono font-bold text-text">
                    {usageData?.workflows?.current ?? 0} / {usageData?.workflows?.max === -1 ? '∞' : (usageData?.workflows?.max ?? 2)}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden border border-line">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ 
                      width: usageData?.workflows?.max === -1 
                        ? '100%' 
                        : `${Math.min(100, Math.round(((usageData?.workflows?.current || 0) / (usageData?.workflows?.max || 2)) * 100))}%` 
                    }}
                  />
                </div>
                <div className="text-[11px] text-muted flex items-center justify-between">
                  <span>Pipeline & task automations</span>
                  <span className="font-mono">{usageData?.workflows?.max === -1 ? 'Unlimited' : `${usageData?.workflows?.max || 2} Max`}</span>
                </div>
              </div>

              {/* Organization Seats Quota */}
              <div className="bg-surface rounded-xl border border-line p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-muted uppercase tracking-wider">
                    {subData?.customerType === 'organization' ? 'Team Members / Seats' : 'Licensed Seats'}
                  </span>
                  <span className="text-xs font-mono font-bold text-text">
                    {usageData?.seats?.current ?? 1} / {usageData?.seats?.max === -1 ? '∞' : (usageData?.seats?.max ?? 1)}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden border border-line">
                  <div 
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{ 
                      width: usageData?.seats?.max === -1 
                        ? '100%' 
                        : `${Math.min(100, Math.round(((usageData?.seats?.current || 1) / (usageData?.seats?.max || 1)) * 100))}%` 
                    }}
                  />
                </div>
                <div className="text-[11px] text-muted flex items-center justify-between">
                  <span>{subData?.customerType === 'organization' ? 'Includes owner and all staff' : 'Single user license'}</span>
                  <span className="font-mono">{usageData?.seats?.max === -1 ? 'Unlimited' : `${usageData?.seats?.max || 1} Max`}</span>
                </div>
              </div>
            </div>

            {/* Additional Entitlements Summary */}
            <div className="bg-surface rounded-xl border border-line p-3.5 mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>History: <strong className="text-text">{usageData?.historyDays === -1 ? 'Unlimited' : `${usageData?.historyDays || 7} Days`}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>WebRTC HD Video: <strong className="text-text">Included</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Invoicing & Claims: <strong className="text-text">Included</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Telemetry Analytics: <strong className="text-text">Included</strong></span>
              </div>
            </div>
          </div>

          {/* 3. Payment Transactions Ledger */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.08em] text-muted uppercase">
                PAYMENT TRANSACTIONS & AUDIT LEDGER
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted font-mono">{paymentHistory.length} Settled Record(s)</span>
            </div>

            {(!orgId || canManageBilling) ? (
              paymentHistory.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No payment transactions recorded"
                  description="This account is currently operating under baseline Free entitlements. Paid subscription upgrades through Razorpay will be automatically audited and receipted here."
                />
              ) : (
                <div className="bg-surface rounded-xl border border-line overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-2 border-b border-line text-muted uppercase font-mono text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4 font-bold">Date</th>
                          <th className="py-2.5 px-4 font-bold">Amount</th>
                          <th className="py-2.5 px-4 font-bold">Provider Ref</th>
                          <th className="py-2.5 px-4 font-bold">Order ID</th>
                          <th className="py-2.5 px-4 font-bold">Payer</th>
                          <th className="py-2.5 px-4 font-bold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line font-sans">
                        {paymentHistory.map((p) => (
                          <tr key={p.id} className="hover:bg-surface-2/30 transition-colors">
                            <td className="py-3 px-4 text-text font-medium whitespace-nowrap">
                              {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-text">
                              ₹{(p.amount || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 font-mono text-muted">
                              {p.provider_payment_id || 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono text-muted">
                              {p.provider_order_id || 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono text-muted text-[11px]">
                              {p.payer_user_id ? `User:${p.payer_user_id.slice(0, 8)}...` : 'Authorized Payer'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                                {p.status || 'Verified'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              <div className="bg-surface rounded-xl border border-line p-6 text-center space-y-2">
                <Lock size={20} className="text-amber-500 mx-auto" />
                <div className="text-xs text-muted">
                  Transaction receipts and invoice clearing history are restricted to organization owners and billing administrators.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMPANY PROFILE MODAL ── */}
      {isCompanyModalVisible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface border border-line rounded-xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 className="text-sm font-bold text-text uppercase tracking-wider font-mono flex items-center gap-2">
                <Building2 size={15} className="text-accent" />
                <span>Edit Company Profile</span>
              </h2>
              <button 
                onClick={() => setIsCompanyModalVisible(false)}
                className="text-muted hover:text-text p-1 cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Update details for Billed From configurations. These will be automatically populated on all future invoices.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Company Name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Acme Corporation"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full bg-app border border-line focus:border-accent/50 rounded px-3 py-1.5 text-xs text-text placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  Company Address <span className="text-accent">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Mumbai, Maharashtra, India"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  className="w-full bg-app border border-line focus:border-accent/50 rounded px-3 py-1.5 text-xs text-text placeholder-zinc-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted block mb-1">
                  GSTIN Tax Details
                </label>
                <input
                  type="text"
                  placeholder="27CFFLOW1234A1Z9"
                  value={orgGst}
                  onChange={(e) => setOrgGst(e.target.value)}
                  className="w-full bg-app border border-line focus:border-accent/50 rounded px-3 py-1.5 text-xs text-text placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setIsCompanyModalVisible(false)}
                className="px-3.5 py-1.5 rounded bg-surface hover:bg-surface-2 text-muted hover:text-text border border-line text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOrgDetails}
                className="px-3.5 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}