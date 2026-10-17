import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
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
  ExternalLink,
  FileText,
  Sparkles,
  User,
  Info,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from '../components/ui/Toast';
import { SUPPORTED_CURRENCIES } from '../lib/currency';

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role, accountType } = useAuth();
  const { orgId, orgName: wsOrgName, membershipRole, canManageBilling, isOwner, refreshWorkspace } = useWorkspace();

  // Active Screen / Sub-Screen View ('main' | 'privacy' | 'notifications' | 'freelancer' | 'media' | 'security' | 'billing')
  const [currentView, setCurrentView] = useState<'main' | 'privacy' | 'notifications' | 'freelancer' | 'media' | 'security' | 'billing'>(() => {
    return searchParams.get('tab') === 'billing' ? 'billing' : 'main';
  });

  // Watch URL search param for tab changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'billing') {
      setCurrentView('billing');
    }
  }, [searchParams]);

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
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
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

        if (userOrg && (userOrg.role === 'owner' || userOrg.role === 'administrator' || userOrg.role === 'director')) {
          setIsOwnerOrAdmin(true);
        } else if (['owner', 'administrator', 'director', 'ceo', 'managing_director'].includes(role || '')) {
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

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto space-y-6 pb-16 font-sans select-none text-muted">
      
      {/* ── Top Header Navigation ── */}
      <div className="flex items-center justify-between pb-2 border-b border-divider">
        <div className="flex items-center gap-3">
          {currentView !== 'main' && (
            <button 
              onClick={() => setCurrentView('main')}
              className="w-10 h-10 rounded-full bg-hover border border-divider hover:bg-hover flex items-center justify-center text-main transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-main tracking-tight">
              {currentView === 'main' && 'App Settings'}
              {currentView === 'privacy' && 'Privacy Controls'}
              {currentView === 'notifications' && 'Notification Preferences'}
              {currentView === 'freelancer' && 'Freelancer Workspace Scope'}
              {currentView === 'media' && 'Audio & Video Routing'}
              {currentView === 'security' && 'Change Password & Security'}
              {currentView === 'billing' && 'Customer Subscription & Billing Telemetry'}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              {currentView === 'main' && 'Configure theme display, notification channels, security policies, and organization billing.'}
              {currentView === 'privacy' && 'Manage real-time status visibility, read receipts, blocked members, and muted channels.'}
              {currentView === 'notifications' && 'Customize alert thresholds, meeting reminders, role updates, and weekly digest.'}
              {currentView === 'freelancer' && 'Select your active engagement mode, rate scoping, and client project assignments.'}
              {currentView === 'media' && 'Configure hardware microphones, capture camera devices, and E2EE parameters.'}
              {currentView === 'security' && 'Update master password credentials and inspect active session tokens.'}
              {currentView === 'billing' && 'Customer account plan, live quota entitlements, verified payer attribution, and transaction ledger.'}
            </p>
          </div>
        </div>

        {currentView === 'main' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-hover hover:bg-hover text-muted hover:text-main border border-divider text-xs font-semibold transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── VIEW 1: MAIN SETTINGS (EXACT REPLICA OF MOBILE APP) ── */}
      {/* ────────────────────────────────────────────────────────── */}
      {currentView === 'main' && (
        <div className="space-y-6">

          {/* 1. Display */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Display</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              <div className="flex items-center justify-between p-4.5 border-b border-divider">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Moon size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Dark Mode</div>
                    <div className="text-xs text-muted">Use dark theme across the app</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = theme === 'dark' ? 'light' : 'dark';
                    setTheme(next);
                    handleUpdatePreference({ theme: next });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-[#FF6B4A]' : 'bg-black/20'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${theme === 'dark' ? 'right-1' : 'left-1 shadow-sm'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Preferences */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Preferences</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              
              {/* Haptic Feedback */}
              <div className="flex items-center justify-between p-4.5 border-b border-divider">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Haptic & Audio Feedback</div>
                    <div className="text-xs text-muted">Feedback sound on interaction toggles and room alerts</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !hapticsEnabled;
                    setHapticsEnabled(next);
                    handleUpdatePreference({ hapticFeedback: next });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${hapticsEnabled ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${hapticsEnabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              {/* Notification Preferences Row */}
              <button 
                onClick={() => setCurrentView('notifications')}
                className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left border-b border-divider"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Bell size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Notification Preferences</div>
                    <div className="text-xs text-muted">Push alerts, 15m meeting reminders & email digests</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>

              {/* Hardware / Media Routing Row */}
              <button 
                onClick={() => setCurrentView('media')}
                className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Video size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Audio & Video Routing</div>
                    <div className="text-xs text-muted">Default microphone, camera capture & WebRTC E2EE</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>

            </div>
          </div>

          {/* Subscription & Billing Section */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Subscription & Plans</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A] shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="text-base font-semibold text-main flex items-center gap-2">
                    <span>{subData?.planName || 'Free Tier'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30">
                      {subData?.status ? subData.status.toUpperCase() : 'FREE'}
                    </span>
                    {subData?.customerType && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-white/[0.06] text-muted border border-divider">
                        {subData.customerType === 'organization' ? 'Organization' : 'Freelancer'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {subData?.hasActiveSubscription 
                      ? `Active monthly subscription. Payer tracked separately from account owner.`
                      : `Baseline Free plan quota active. Upgrade anytime for higher project & workflow limits.`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentView('billing')}
                  className="flex-1 md:flex-none px-4 py-2 bg-hover hover:bg-hover border border-divider text-main text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <CreditCard size={14} className="text-[#FF6B4A]" />
                  <span>Subscription Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className="flex-1 md:flex-none px-4 py-2 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded-xl transition-all shadow-[0_0_12px_rgba(255,107,74,0.3)] shrink-0"
                >
                  Plans & Pricing →
                </button>
              </div>
            </div>
          </div>

          {/* 3. Freelancer Workspace Portal (for Freelancers) */}
          {(role === 'freelancer' || isFreelancerRole) && (
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Freelancer Workspace</span>
              <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
                <button 
                  onClick={() => setCurrentView('freelancer')}
                  className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                      <Briefcase size={18} />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-main">Freelancer Engagement & Rates</div>
                      <div className="text-xs text-muted">Contract scopes, independent invoicing & deliverables</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted" />
                </button>
              </div>
            </div>
          )}

          {/* 4. Organization Settings for Owners & Admins */}
          {isOwnerOrAdmin && (
            <>
              {/* Organization Currency */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between ml-1">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Organization Currency</span>
                  <span className="text-xs font-mono font-medium text-[#FF6B4A]">
                    Active: {SUPPORTED_CURRENCIES.find(c => c.code === defaultCurrency)?.name || defaultCurrency}
                  </span>
                </div>
                <div className="bg-card-bg rounded-2xl border border-divider p-4">
                  <div className="flex flex-wrap gap-2.5">
                    {SUPPORTED_CURRENCIES.map((curr) => {
                      const isSelected = defaultCurrency === curr.code;
                      return (
                        <button
                          key={curr.code}
                          type="button"
                          disabled={updatingCurrency}
                          onClick={() => handleUpdateCurrency(curr.code)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                            isSelected 
                              ? 'bg-[#FF6B4A] border-[#FF6B4A] text-main shadow-lg shadow-[#FF6B4A]/20 scale-[1.02]' 
                              : 'bg-app border-divider text-muted hover:text-main hover:border-divider hover:bg-hover'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-white/20 text-main' : 'bg-white/[0.04] text-muted'
                          }`}>
                            {curr.symbol}
                          </span>
                          <span>{curr.name}</span>
                          {isSelected && <Check size={14} className="ml-1 text-main" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Company Profile Action */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Organization Settings</span>
                <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
                  <button 
                    onClick={() => setIsCompanyModalVisible(true)}
                    className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-main">Company Profile</div>
                        <div className="text-xs text-muted">Billed-from details, tax GSTIN & registered office</div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-muted" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 5. Security & Privacy */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Security & Privacy</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              
              {/* Privacy Controls Row */}
              <button 
                onClick={() => setCurrentView('privacy')}
                className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left border-b border-divider"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Privacy Controls</div>
                    <div className="text-xs text-muted">Online visibility, read receipts, blocked users & mute list</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>

              {/* Change Password Row */}
              <button 
                onClick={() => setCurrentView('security')}
                className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Lock size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Change Password</div>
                    <div className="text-xs text-muted">Update master authentication credentials</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>

            </div>
          </div>

          {/* 6. About */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">About</span>
            <div className="p-5 rounded-2xl border border-divider bg-card-bg space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted">App Version</span>
                <span className="font-semibold text-main font-mono">1.0.0 (Production)</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted">Supabase Environment</span>
                <span className="font-semibold text-emerald-400 font-mono">Connected</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted">Signed In As</span>
                <span className="font-semibold text-main font-mono">{user?.email}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── VIEW 2: PRIVACY CONTROLS (EXACT REPLICA OF MOBILE APP) ── */}
      {/* ────────────────────────────────────────────────────────── */}
      {currentView === 'privacy' && (
        <div className="space-y-6">

          {/* Status Visibility */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Status Visibility</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              
              {/* Show Online */}
              <div className="p-4.5 border-b border-divider">
                <div className="text-base font-semibold text-main">Who can see my online status</div>
                <div className="grid grid-cols-3 gap-2.5 mt-3">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setShowOnline(opt);
                        handleSavePrivacySetting('show_online', opt);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                        showOnline === opt 
                          ? 'bg-[#FF6B4A] border-[#FF6B4A] text-main shadow-sm' 
                          : 'bg-app border-divider text-muted hover:text-main'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Last Seen */}
              <div className="p-4.5">
                <div className="text-base font-semibold text-main">Who can see my last seen status</div>
                <div className="grid grid-cols-3 gap-2.5 mt-3">
                  {(['everyone', 'contacts', 'nobody'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setShowLastSeen(opt);
                        handleSavePrivacySetting('show_last_seen', opt);
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                        showLastSeen === opt 
                          ? 'bg-[#FF6B4A] border-[#FF6B4A] text-main shadow-sm' 
                          : 'bg-app border-divider text-muted hover:text-main'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Read Receipts */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Messaging</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              <div className="flex items-center justify-between p-4.5">
                <div className="mr-4">
                  <div className="text-base font-semibold text-main">Read Receipts</div>
                  <div className="text-xs text-muted">If turned off, you won't send or receive read receipts.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !readReceipts;
                    setReadReceipts(next);
                    handleSavePrivacySetting('enable_read_receipts', next);
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${readReceipts ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${readReceipts ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Blocked Users */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Blocked Users</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              {blockedUsers.length === 0 ? (
                <div className="p-5 text-center text-sm text-muted">
                  No blocked users
                </div>
              ) : (
                blockedUsers.map((item) => (
                  <div key={item.blocked_id} className="flex items-center justify-between p-4 border-b border-divider">
                    <div>
                      <div className="text-base font-semibold text-main">{item.blocked?.full_name || 'User'}</div>
                      <div className="text-xs text-muted">{item.blocked?.email || ''}</div>
                    </div>
                    <button
                      onClick={() => handleUnblock(item.blocked_id)}
                      className="py-1.5 px-3 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/20 text-xs font-bold text-[#FF6B4A] hover:bg-[#FF6B4A]/20 transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Muted Conversations */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Muted Conversations</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              {mutedChannels.length === 0 ? (
                <div className="p-5 text-center text-sm text-muted">
                  No muted conversations
                </div>
              ) : (
                mutedChannels.map((item) => (
                  <div key={item.channel_id} className="flex items-center justify-between p-4 border-b border-divider">
                    <div>
                      <div className="text-base font-semibold text-main">{item.channel?.name || 'Muted Channel'}</div>
                      <div className="text-xs text-muted capitalize">{item.channel?.type || ''}</div>
                    </div>
                    <button
                      onClick={() => handleUnmute(item.channel_id)}
                      className="py-1.5 px-3 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/20 text-xs font-bold text-[#FF6B4A] hover:bg-[#FF6B4A]/20 transition-colors"
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

      {/* ────────────────────────────────────────────────────────────── */}
      {/* ── VIEW 3: NOTIFICATIONS (EXACT REPLICA OF MOBILE APP) ────── */}
      {/* ────────────────────────────────────────────────────────────── */}
      {currentView === 'notifications' && (
        <div className="space-y-6">

          {/* Push Notifications Section */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Push Notifications</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              
              <div className="flex items-center justify-between p-4.5 border-b border-divider">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Meeting Invitations</div>
                    <div className="text-xs text-muted">Notify me of new meeting invites</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMeetingInvites(!meetingInvites)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${meetingInvites ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${meetingInvites ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4.5 border-b border-divider">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <AlarmClock size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Meeting Reminders</div>
                    <div className="text-xs text-muted">Send notifications 15m before meetings</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMeetingReminders(!meetingReminders)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${meetingReminders ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${meetingReminders ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4.5 border-b border-divider">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Role Updates</div>
                    <div className="text-xs text-muted">Alert me when my role is updated</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleChanges(!roleChanges)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${roleChanges ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${roleChanges ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">System Alerts</div>
                    <div className="text-xs text-muted">Notify about downtime & server maintenance</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSystemAlerts(!systemAlerts)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${systemAlerts ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${systemAlerts ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

            </div>
          </div>

          {/* Email Digest Section */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Email Preferences</span>
            <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
              <div className="flex items-center justify-between p-4.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-main">Weekly Digest</div>
                    <div className="text-xs text-muted">Get weekly summary of tasks & meetings</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailDigest(!emailDigest)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${emailDigest ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${emailDigest ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div>
            <button
              type="button"
              onClick={handleSaveNotificationPreferences}
              className="w-full py-3.5 rounded-2xl bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-bold text-base transition-colors shadow-sm"
            >
              Save Preferences
            </button>
          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── VIEW 4: FREELANCER ENGAGEMENT PORTAL ───────────────── */}
      {/* ────────────────────────────────────────────────────────── */}
      {currentView === 'freelancer' && (
        <div className="space-y-6">
          
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Engagement Model</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div 
                onClick={() => setFreelancerWorkType('independent')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  freelancerWorkType === 'independent'
                    ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]'
                    : 'bg-card-bg border-divider hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base font-bold text-main">Independent Contractor</span>
                  {freelancerWorkType === 'independent' && <Check size={16} className="text-[#FF6B4A]" />}
                </div>
                <p className="text-xs text-muted leading-relaxed">Direct client contracts, personal invoicing, and independent project management.</p>
              </div>

              <div 
                onClick={() => setFreelancerWorkType('organization')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  freelancerWorkType === 'organization'
                    ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]'
                    : 'bg-card-bg border-divider hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base font-bold text-main">Agency / Org Assigned</span>
                  {freelancerWorkType === 'organization' && <Check size={16} className="text-[#FF6B4A]" />}
                </div>
                <p className="text-xs text-muted leading-relaxed">Assigned into agency workspaces with strict deliverable-based permissions.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="p-4 bg-card-bg border border-divider rounded-2xl">
              <div className="text-xs font-mono uppercase text-muted font-bold">Active Projects</div>
              <div className="text-2xl font-bold text-main mt-1.5">{freelancerStats.activeProjects}</div>
            </div>
            <div className="p-4 bg-card-bg border border-divider rounded-2xl">
              <div className="text-xs font-mono uppercase text-muted font-bold">Open Tasks</div>
              <div className="text-2xl font-bold text-main mt-1.5">{freelancerStats.openTasks}</div>
            </div>
            <div className="p-4 bg-card-bg border border-divider rounded-2xl">
              <div className="text-xs font-mono uppercase text-muted font-bold">Invoices</div>
              <div className="text-2xl font-bold text-main mt-1.5">{freelancerStats.invoicesCount}</div>
            </div>
          </div>

          <button
            onClick={() => {
              supabase.from('users').update({ freelancer_type: freelancerWorkType }).eq('id', user?.id).then();
              toast.success('Freelancer preferences saved');
              setCurrentView('main');
            }}
            className="w-full py-3.5 rounded-2xl bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-bold text-base transition-colors shadow-sm"
          >
            Save Scope Settings
          </button>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── VIEW 5: AUDIO & VIDEO ROUTING ──────────────────────── */}
      {/* ────────────────────────────────────────────────────────── */}
      {currentView === 'media' && (
        <div className="space-y-6">
          <div className="bg-card-bg rounded-2xl border border-divider p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                Microphone Input Device
              </label>
              <select 
                value={audioInput} 
                onChange={(e) => setAudioInput(e.target.value)}
                className="w-full bg-app border border-divider rounded-xl px-3.5 py-2.5 text-sm text-main focus:outline-none"
              >
                <option>Default System Microphone</option>
                <option>Studio USB Condenser</option>
                <option>Communications Headset</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                Camera Capture Device
              </label>
              <select 
                value={videoInput} 
                onChange={(e) => setVideoInput(e.target.value)}
                className="w-full bg-app border border-divider rounded-xl px-3.5 py-2.5 text-sm text-main focus:outline-none"
              >
                <option>Integrated HD Webcam (1080p)</option>
                <option>External 4K Capture Device</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-app border border-divider rounded-xl">
              <div>
                <div className="font-semibold text-sm text-main">End-to-End Encryption (E2EE)</div>
                <div className="text-xs text-muted">LiveKit SFU and private chat mesh crypto.</div>
              </div>
              <button
                type="button"
                onClick={() => setE2eeEnabled(!e2eeEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative ${e2eeEnabled ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
              >
                <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${e2eeEnabled ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── VIEW 6: SECURITY / CHANGE PASSWORD ─────────────────── */}
      {/* ────────────────────────────────────────────────────────── */}
      {currentView === 'security' && (
        <div className="space-y-6">
          <div className="bg-card-bg rounded-2xl border border-divider p-6">
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                  New Password
                </label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded-xl px-3.5 py-2.5 text-sm text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Confirm New Password
                </label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-app border border-divider focus:border-[#FF6B4A]/50 rounded-xl px-3.5 py-2.5 text-sm text-main placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <button 
                type="submit"
                disabled={passwordUpdating}
                className="w-full py-3 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-50 text-main font-bold text-sm transition-colors shadow-sm"
              >
                {passwordUpdating ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── VIEW 7: CUSTOMER SUBSCRIPTION & BILLING TELEMETRY ───── */}
      {/* ────────────────────────────────────────────────────────── */}
      {currentView === 'billing' && (
        <div className="space-y-6">
          
          {/* Top Actions & Sync Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">Customer Subscription Details</span>
              {loadingBilling && (
                <div className="flex items-center gap-1.5 text-xs text-[#FF6B4A]">
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Syncing ledger...</span>
                </div>
              )}
            </div>
            <button
              onClick={() => fetchBillingData()}
              disabled={loadingBilling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-hover hover:bg-hover border border-divider text-xs font-medium text-muted hover:text-main transition-colors"
            >
              <RefreshCw size={12} className={loadingBilling ? 'animate-spin' : ''} />
              <span>Refresh Telemetry</span>
            </button>
          </div>

          {/* Member Restricted Billing Alert Banner (Section 7, 8, 10) */}
          {(orgId || subData?.customerType === 'organization') && !canManageBilling && (
            <div className="p-4.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5 text-amber-200">
              <Lock size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-amber-300">
                  Billing & Subscription Management Restricted
                </div>
                <div className="text-xs text-amber-200/80 leading-relaxed">
                  Contact your organization owner or billing administrator to manage your subscription.
                </div>
                <div className="text-[11px] text-amber-300/70 pt-1">
                  You are viewing read-only plan details for this organization workspace. Billing mutations, payments, and checkout actions require elevated billing privileges.
                </div>
              </div>
            </div>
          )}

          {/* 1. Customer Account & Plan Overview Card */}
          <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-divider">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A] shrink-0">
                  {subData?.customerType === 'organization' ? <Building2 size={24} /> : <User size={24} />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-main">
                      {subData?.customerName || wsOrgName || user?.user_metadata?.full_name || 'Customer Account'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FF6B4A]/20 text-[#FF6B4A] border border-[#FF6B4A]/30">
                      {subData?.planName || 'Free Plan'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                      subData?.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : subData?.status === 'free'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                      {subData?.status || 'FREE'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Customer Account: <span className="text-main font-medium capitalize">{subData?.customerType || (orgId ? 'Organization' : 'Freelancer')}</span>
                    {' · '}
                    Billing Interval: <span className="text-main font-medium capitalize">{subData?.interval || 'monthly'}</span>
                  </p>
                </div>
              </div>

              {/* Permitted Plan Upgrades or Downgrades (Section 10) */}
              <div className="flex items-center gap-2.5">
                {(!orgId || canManageBilling) ? (
                  <>
                    <button
                      onClick={() => navigate('/pricing')}
                      className="px-4 py-2.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded-xl transition-all shadow-[0_0_12px_rgba(255,107,74,0.3)] flex items-center gap-1.5"
                    >
                      <Sparkles size={14} />
                      <span>Change Plan / Upgrade</span>
                    </button>
                    {subData?.hasActiveSubscription && subData?.tier && !subData.tier.includes('free') && (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancellingSub}
                        className="px-3 py-2.5 bg-hover hover:bg-red-500/10 border border-divider hover:border-red-500/30 text-muted hover:text-red-400 text-xs font-medium rounded-xl transition-all disabled:opacity-50"
                      >
                        {cancellingSub ? 'Cancelling...' : 'Cancel Subscription'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    disabled
                    title="Only organization owner or billing administrator can modify subscription"
                    className="px-4 py-2.5 bg-zinc-800/80 text-zinc-500 cursor-not-allowed text-xs font-semibold rounded-xl border border-zinc-800 flex items-center gap-1.5"
                  >
                    <Lock size={13} />
                    <span>Manage Plans (Restricted)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Key Subscription Telemetry Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-app border border-divider">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Current Recurring Rate</div>
                <div className="text-xl font-bold text-main mt-1">
                  {subData?.tier === 'freelancer_starter' ? '₹299'
                    : subData?.tier === 'freelancer_pro' ? '₹599'
                    : subData?.tier === 'business_starter' ? '₹999'
                    : subData?.tier === 'business_pro' ? '₹2,499'
                    : '₹0'}
                  <span className="text-xs font-normal text-muted"> / mo</span>
                </div>
                <div className="text-[11px] text-muted mt-1">Authoritative Server Rate</div>
              </div>

              <div className="p-4 rounded-xl bg-app border border-divider">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Account Entitlement Scope</div>
                <div className="text-base font-bold text-main mt-1 capitalize">
                  {subData?.customerType === 'organization' ? 'Organization-wide' : 'Individual Freelancer'}
                </div>
                <div className="text-[11px] text-muted mt-1">Applies to all workspace assets</div>
              </div>

              <div className="p-4 rounded-xl bg-app border border-divider">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Current Period Activated</div>
                <div className="text-sm font-semibold text-main mt-1">
                  {subData?.currentPeriodStart ? new Date(subData.currentPeriodStart).toLocaleDateString() : 'Active Baseline'}
                </div>
                <div className="text-[11px] text-muted mt-1">Validated provider timestamp</div>
              </div>

              <div className="p-4 rounded-xl bg-app border border-divider">
                <div className="text-[10px] font-mono uppercase text-muted font-bold tracking-wider">Next Billing / Expiry Date</div>
                <div className="text-sm font-semibold text-main mt-1">
                  {subData?.currentPeriodEnd ? new Date(subData.currentPeriodEnd).toLocaleDateString() : 'Perpetual Free Tier'}
                </div>
                <div className="text-[11px] text-muted mt-1">
                  {subData?.cancelAtPeriodEnd ? 'Cancels at end of cycle' : 'Auto-renewing cycle'}
                </div>
              </div>
            </div>

            {/* Payer Attribution (Section 9: Distinguishing Customer Account vs. Actual Payer) */}
            <div className="p-4 rounded-xl bg-hover border border-divider flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-main flex items-center gap-1.5">
                  <Shield size={14} className="text-[#FF6B4A]" />
                  <span>Audited Payer Tracking</span>
                </div>
                <div className="text-muted text-[11px]">
                  The customer receiving entitlements is <strong className="text-main">{subData?.customerName || 'This Account'}</strong>.
                  {' '}
                  Payer attribution records the authenticated user executing payment transactions.
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-mono text-muted">Registered Payer:</div>
                <div className="text-xs font-mono font-medium text-main">
                  {subData?.payerUserId ? `User: ${subData.payerUserId}` : (subData?.hasActiveSubscription ? 'Verified Purchaser' : 'System Default Allocation')}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Usage Limits & Live Entitlements Grid (Section 10 & 12) */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Live Entitlements & Resource Quotas</span>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Active Projects Quota */}
              <div className="bg-card-bg rounded-2xl border border-divider p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Projects</span>
                  <span className="text-xs font-mono font-bold text-main">
                    {usageData?.projects?.current ?? 0} / {usageData?.projects?.max === -1 ? '∞' : (usageData?.projects?.max ?? 3)}
                  </span>
                </div>
                <div className="w-full h-2 bg-app rounded-full overflow-hidden border border-divider">
                  <div 
                    className="h-full bg-[#FF6B4A] rounded-full transition-all duration-500"
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
              <div className="bg-card-bg rounded-2xl border border-divider p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Workflows</span>
                  <span className="text-xs font-mono font-bold text-main">
                    {usageData?.workflows?.current ?? 0} / {usageData?.workflows?.max === -1 ? '∞' : (usageData?.workflows?.max ?? 2)}
                  </span>
                </div>
                <div className="w-full h-2 bg-app rounded-full overflow-hidden border border-divider">
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

              {/* Organization Seats Quota (Or User Limit for Freelancer) */}
              <div className="bg-card-bg rounded-2xl border border-divider p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">
                    {subData?.customerType === 'organization' ? 'Team Members / Seats' : 'Licensed Seats'}
                  </span>
                  <span className="text-xs font-mono font-bold text-main">
                    {usageData?.seats?.current ?? 1} / {usageData?.seats?.max === -1 ? '∞' : (usageData?.seats?.max ?? 1)}
                  </span>
                </div>
                <div className="w-full h-2 bg-app rounded-full overflow-hidden border border-divider">
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
            <div className="bg-card-bg rounded-2xl border border-divider p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>History: <strong className="text-main">{usageData?.historyDays === -1 ? 'Unlimited' : `${usageData?.historyDays || 7} Days`}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>WebRTC HD Video: <strong className="text-main">Included</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>Invoicing & Claims: <strong className="text-main">Included</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>Telemetry Analytics: <strong className="text-main">Included</strong></span>
              </div>
            </div>
          </div>

          {/* 3. Payment Transactions Ledger (Section 9 & 10) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted uppercase tracking-wider block ml-1">Payment Transactions & Audit Ledger</span>
              <span className="text-[11px] text-muted font-mono">{paymentHistory.length} Settled Record(s)</span>
            </div>

            {(!orgId || canManageBilling) ? (
              paymentHistory.length === 0 ? (
                <div className="bg-card-bg rounded-2xl border border-divider p-8 text-center space-y-2">
                  <CreditCard size={28} className="text-muted mx-auto" />
                  <div className="text-sm font-semibold text-main">No payment transactions recorded</div>
                  <div className="text-xs text-muted max-w-md mx-auto">
                    This account is currently operating under baseline Free entitlements. Paid subscription upgrades through Razorpay will be automatically audited and receipted here.
                  </div>
                </div>
              ) : (
                <div className="bg-card-bg rounded-2xl border border-divider overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-app border-b border-divider text-muted uppercase font-mono text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Provider Ref (Razorpay)</th>
                          <th className="py-3 px-4">Order ID</th>
                          <th className="py-3 px-4">Payer</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-divider font-sans">
                        {paymentHistory.map((p) => (
                          <tr key={p.id} className="hover:bg-white/[0.015] transition-colors">
                            <td className="py-3 px-4 text-main font-medium whitespace-nowrap">
                              {p.created_at ? new Date(p.created_at).toLocaleString() : 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-main">
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
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
              <div className="bg-card-bg rounded-2xl border border-divider p-6 text-center space-y-2">
                <Lock size={24} className="text-amber-400 mx-auto" />
                <div className="text-xs text-muted">
                  Transaction receipts and invoice clearing history are restricted to organization owners and billing administrators.
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── COMPANY PROFILE MODAL (EXACT REPLICA OF MOBILE APP) ── */}
      {/* ────────────────────────────────────────────────────────── */}
      {isCompanyModalVisible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card-bg border border-divider rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-divider">
              <h2 className="text-lg font-bold text-main">Edit Company Profile</h2>
              <button 
                onClick={() => setIsCompanyModalVisible(false)}
                className="w-8 h-8 rounded-full bg-hover hover:bg-hover flex items-center justify-center text-muted hover:text-main transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Update details for Billed From configurations. These will be automatically populated on all future invoices.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5 ml-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  placeholder="Acme Corporation"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-divider bg-app text-sm text-main placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5 ml-1">
                  Company Address *
                </label>
                <textarea
                  rows={2}
                  placeholder="Mumbai, Maharashtra, India"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-divider bg-app text-sm text-main placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/50 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5 ml-1">
                  GSTIN Tax Details
                </label>
                <input
                  type="text"
                  placeholder="27CFFLOW1234A1Z9"
                  value={orgGst}
                  onChange={(e) => setOrgGst(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-divider bg-app text-sm text-main placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/50 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleSaveOrgDetails}
              className="w-full p-4 rounded-2xl bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-bold text-base transition-colors shadow-sm mt-2"
            >
              Save Details
            </button>

          </div>
        </div>
      )}

    </div>
  );
}