import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { toast } from '../components/ui/Toast';
import { SUPPORTED_CURRENCIES } from '../lib/currency';

export default function Settings() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { orgId, refreshWorkspace } = useWorkspace();

  // Active Screen / Sub-Screen View ('main' | 'privacy' | 'notifications' | 'freelancer' | 'media' | 'security')
  const [currentView, setCurrentView] = useState<'main' | 'privacy' | 'notifications' | 'freelancer' | 'media' | 'security'>('main');

  // Role checking
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  // General & Preferences
  const [darkMode, setDarkMode] = useState(true);
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
          setDarkMode(p.theme !== 'light');
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
    <div className="flex-1 w-full max-w-4xl mx-auto space-y-6 pb-16 font-sans select-none text-zinc-300">
      
      {/* ── Top Header Navigation ── */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {currentView !== 'main' && (
            <button 
              onClick={() => setCurrentView('main')}
              className="w-10 h-10 rounded-full bg-[#12141F] border border-white/[0.08] hover:bg-[#181B28] flex items-center justify-center text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {currentView === 'main' && 'App Settings'}
              {currentView === 'privacy' && 'Privacy Controls'}
              {currentView === 'notifications' && 'Notification Preferences'}
              {currentView === 'freelancer' && 'Freelancer Workspace Scope'}
              {currentView === 'media' && 'Audio & Video Routing'}
              {currentView === 'security' && 'Change Password & Security'}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {currentView === 'main' && 'Configure theme display, notification channels, security policies, and organization billing.'}
              {currentView === 'privacy' && 'Manage real-time status visibility, read receipts, blocked members, and muted channels.'}
              {currentView === 'notifications' && 'Customize alert thresholds, meeting reminders, role updates, and weekly digest.'}
              {currentView === 'freelancer' && 'Select your active engagement mode, rate scoping, and client project assignments.'}
              {currentView === 'media' && 'Configure hardware microphones, capture camera devices, and E2EE parameters.'}
              {currentView === 'security' && 'Update master password credentials and inspect active session tokens.'}
            </p>
          </div>
        </div>

        {currentView === 'main' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#10121A] hover:bg-[#151822] text-zinc-400 hover:text-white border border-white/[0.06] text-xs font-semibold transition-colors"
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Display</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center justify-between p-4.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Moon size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Dark Mode</div>
                    <div className="text-xs text-zinc-400">Use dark theme across the app</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !darkMode;
                    setDarkMode(next);
                    handleUpdatePreference({ theme: next ? 'dark' : 'light' });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-[#FF6B4A]' : 'bg-white/10'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${darkMode ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Preferences */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Preferences</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              
              {/* Haptic Feedback */}
              <div className="flex items-center justify-between p-4.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Haptic & Audio Feedback</div>
                    <div className="text-xs text-zinc-400">Feedback sound on interaction toggles and room alerts</div>
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
                className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left border-b border-white/[0.04]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Bell size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Notification Preferences</div>
                    <div className="text-xs text-zinc-400">Push alerts, 15m meeting reminders & email digests</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-500" />
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
                    <div className="text-base font-semibold text-white">Audio & Video Routing</div>
                    <div className="text-xs text-zinc-400">Default microphone, camera capture & WebRTC E2EE</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-500" />
              </button>

            </div>
          </div>

          {/* 3. Freelancer Workspace Portal (for Freelancers) */}
          {(role === 'freelancer' || isFreelancerRole) && (
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Freelancer Workspace</span>
              <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
                <button 
                  onClick={() => setCurrentView('freelancer')}
                  className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                      <Briefcase size={18} />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">Freelancer Engagement & Rates</div>
                      <div className="text-xs text-zinc-400">Contract scopes, independent invoicing & deliverables</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-500" />
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
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Organization Currency</span>
                  <span className="text-xs font-mono font-medium text-[#FF6B4A]">
                    Active: {SUPPORTED_CURRENCIES.find(c => c.code === defaultCurrency)?.name || defaultCurrency}
                  </span>
                </div>
                <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] p-4">
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
                              ? 'bg-[#FF6B4A] border-[#FF6B4A] text-white shadow-lg shadow-[#FF6B4A]/20 scale-[1.02]' 
                              : 'bg-[#07080B] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/20 hover:bg-[#12141F]'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-white/[0.04] text-zinc-300'
                          }`}>
                            {curr.symbol}
                          </span>
                          <span>{curr.name}</span>
                          {isSelected && <Check size={14} className="ml-1 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Company Profile Action */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Organization Settings</span>
                <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
                  <button 
                    onClick={() => setIsCompanyModalVisible(true)}
                    className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-white">Company Profile</div>
                        <div className="text-xs text-zinc-400">Billed-from details, tax GSTIN & registered office</div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-zinc-500" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 5. Security & Privacy */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Security & Privacy</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              
              {/* Privacy Controls Row */}
              <button 
                onClick={() => setCurrentView('privacy')}
                className="w-full flex items-center justify-between p-4.5 hover:bg-white/[0.02] transition-colors text-left border-b border-white/[0.04]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Privacy Controls</div>
                    <div className="text-xs text-zinc-400">Online visibility, read receipts, blocked users & mute list</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-500" />
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
                    <div className="text-base font-semibold text-white">Change Password</div>
                    <div className="text-xs text-zinc-400">Update master authentication credentials</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-500" />
              </button>

            </div>
          </div>

          {/* 6. About */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">About</span>
            <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#0C0D12] space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">App Version</span>
                <span className="font-semibold text-white font-mono">1.0.0 (Production)</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Supabase Environment</span>
                <span className="font-semibold text-emerald-400 font-mono">Connected</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Signed In As</span>
                <span className="font-semibold text-white font-mono">{user?.email}</span>
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Status Visibility</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              
              {/* Show Online */}
              <div className="p-4.5 border-b border-white/[0.04]">
                <div className="text-base font-semibold text-white">Who can see my online status</div>
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
                          ? 'bg-[#FF6B4A] border-[#FF6B4A] text-white shadow-sm' 
                          : 'bg-[#07080B] border-white/[0.06] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Last Seen */}
              <div className="p-4.5">
                <div className="text-base font-semibold text-white">Who can see my last seen status</div>
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
                          ? 'bg-[#FF6B4A] border-[#FF6B4A] text-white shadow-sm' 
                          : 'bg-[#07080B] border-white/[0.06] text-zinc-400 hover:text-white'
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Messaging</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center justify-between p-4.5">
                <div className="mr-4">
                  <div className="text-base font-semibold text-white">Read Receipts</div>
                  <div className="text-xs text-zinc-400">If turned off, you won't send or receive read receipts.</div>
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Blocked Users</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              {blockedUsers.length === 0 ? (
                <div className="p-5 text-center text-sm text-zinc-500">
                  No blocked users
                </div>
              ) : (
                blockedUsers.map((item) => (
                  <div key={item.blocked_id} className="flex items-center justify-between p-4 border-b border-white/[0.04]">
                    <div>
                      <div className="text-base font-semibold text-white">{item.blocked?.full_name || 'User'}</div>
                      <div className="text-xs text-zinc-400">{item.blocked?.email || ''}</div>
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Muted Conversations</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              {mutedChannels.length === 0 ? (
                <div className="p-5 text-center text-sm text-zinc-500">
                  No muted conversations
                </div>
              ) : (
                mutedChannels.map((item) => (
                  <div key={item.channel_id} className="flex items-center justify-between p-4 border-b border-white/[0.04]">
                    <div>
                      <div className="text-base font-semibold text-white">{item.channel?.name || 'Muted Channel'}</div>
                      <div className="text-xs text-zinc-400 capitalize">{item.channel?.type || ''}</div>
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Push Notifications</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              
              <div className="flex items-center justify-between p-4.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Meeting Invitations</div>
                    <div className="text-xs text-zinc-400">Notify me of new meeting invites</div>
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

              <div className="flex items-center justify-between p-4.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <AlarmClock size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Meeting Reminders</div>
                    <div className="text-xs text-zinc-400">Send notifications 15m before meetings</div>
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

              <div className="flex items-center justify-between p-4.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Role Updates</div>
                    <div className="text-xs text-zinc-400">Alert me when my role is updated</div>
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
                    <div className="text-base font-semibold text-white">System Alerts</div>
                    <div className="text-xs text-zinc-400">Notify about downtime & server maintenance</div>
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Email Preferences</span>
            <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="flex items-center justify-between p-4.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-[#FF6B4A]/10 flex items-center justify-center text-[#FF6B4A]">
                    <Mail size={18} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Weekly Digest</div>
                    <div className="text-xs text-zinc-400">Get weekly summary of tasks & meetings</div>
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
              className="w-full py-3.5 rounded-2xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-bold text-base transition-colors shadow-sm"
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
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block ml-1">Engagement Model</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div 
                onClick={() => setFreelancerWorkType('independent')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  freelancerWorkType === 'independent'
                    ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]'
                    : 'bg-[#0C0D12] border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base font-bold text-white">Independent Contractor</span>
                  {freelancerWorkType === 'independent' && <Check size={16} className="text-[#FF6B4A]" />}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">Direct client contracts, personal invoicing, and independent project management.</p>
              </div>

              <div 
                onClick={() => setFreelancerWorkType('organization')}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  freelancerWorkType === 'organization'
                    ? 'bg-[#FF6B4A]/10 border-[#FF6B4A]'
                    : 'bg-[#0C0D12] border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-base font-bold text-white">Agency / Org Assigned</span>
                  {freelancerWorkType === 'organization' && <Check size={16} className="text-[#FF6B4A]" />}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">Assigned into agency workspaces with strict deliverable-based permissions.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="p-4 bg-[#0C0D12] border border-white/[0.06] rounded-2xl">
              <div className="text-xs font-mono uppercase text-zinc-500 font-bold">Active Projects</div>
              <div className="text-2xl font-bold text-white mt-1.5">{freelancerStats.activeProjects}</div>
            </div>
            <div className="p-4 bg-[#0C0D12] border border-white/[0.06] rounded-2xl">
              <div className="text-xs font-mono uppercase text-zinc-500 font-bold">Open Tasks</div>
              <div className="text-2xl font-bold text-white mt-1.5">{freelancerStats.openTasks}</div>
            </div>
            <div className="p-4 bg-[#0C0D12] border border-white/[0.06] rounded-2xl">
              <div className="text-xs font-mono uppercase text-zinc-500 font-bold">Invoices</div>
              <div className="text-2xl font-bold text-white mt-1.5">{freelancerStats.invoicesCount}</div>
            </div>
          </div>

          <button
            onClick={() => {
              supabase.from('users').update({ freelancer_type: freelancerWorkType }).eq('id', user?.id).then();
              toast.success('Freelancer preferences saved');
              setCurrentView('main');
            }}
            className="w-full py-3.5 rounded-2xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-bold text-base transition-colors shadow-sm"
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
          <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Microphone Input Device
              </label>
              <select 
                value={audioInput} 
                onChange={(e) => setAudioInput(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                <option>Default System Microphone</option>
                <option>Studio USB Condenser</option>
                <option>Communications Headset</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Camera Capture Device
              </label>
              <select 
                value={videoInput} 
                onChange={(e) => setVideoInput(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                <option>Integrated HD Webcam (1080p)</option>
                <option>External 4K Capture Device</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#07080B] border border-white/[0.04] rounded-xl">
              <div>
                <div className="font-semibold text-sm text-white">End-to-End Encryption (E2EE)</div>
                <div className="text-xs text-zinc-500">LiveKit SFU and private chat mesh crypto.</div>
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
          <div className="bg-[#0C0D12] rounded-2xl border border-white/[0.06] p-6">
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  New Password
                </label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#07080B] border border-white/[0.08] focus:border-[#FF6B4A]/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Confirm New Password
                </label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#07080B] border border-white/[0.08] focus:border-[#FF6B4A]/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <button 
                type="submit"
                disabled={passwordUpdating}
                className="w-full py-3 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-50 text-white font-bold text-sm transition-colors shadow-sm"
              >
                {passwordUpdating ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── COMPANY PROFILE MODAL (EXACT REPLICA OF MOBILE APP) ── */}
      {/* ────────────────────────────────────────────────────────── */}
      {isCompanyModalVisible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0C0D12] border border-white/[0.08] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h2 className="text-lg font-bold text-white">Edit Company Profile</h2>
              <button 
                onClick={() => setIsCompanyModalVisible(false)}
                className="w-8 h-8 rounded-full bg-[#12141F] hover:bg-[#181B28] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Update details for Billed From configurations. These will be automatically populated on all future invoices.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 ml-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  placeholder="CoreFlow Labs Ltd"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-white/[0.08] bg-[#07080B] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 ml-1">
                  Company Address *
                </label>
                <textarea
                  rows={2}
                  placeholder="Mumbai, Maharashtra, India"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-white/[0.08] bg-[#07080B] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/50 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5 ml-1">
                  GSTIN Tax Details
                </label>
                <input
                  type="text"
                  placeholder="27CFFLOW1234A1Z9"
                  value={orgGst}
                  onChange={(e) => setOrgGst(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-white/[0.08] bg-[#07080B] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/50 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handleSaveOrgDetails}
              className="w-full p-4 rounded-2xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-bold text-base transition-colors shadow-sm mt-2"
            >
              Save Details
            </button>

          </div>
        </div>
      )}

    </div>
  );
}