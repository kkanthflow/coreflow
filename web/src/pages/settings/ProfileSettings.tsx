import React, { useState, useEffect } from 'react';
import { User, Mail, Briefcase, Globe, Shield, Camera, Upload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRole } from '../../hooks/useRole';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../lib/supabase';
import { toast } from '../../components/ui/Toast';
import {
  SettingsSection,
  SettingsRow,
  Select,
} from '../../components/settings';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'ja-JP', label: '日本語 (Japanese)' },
  { value: 'hi-IN', label: 'हिन्दी (Hindi)' },
];

export default function ProfileSettings() {
  const { user, fullName: authFullName } = useAuth();
  const { role } = useRole();
  const { userSettings, updateUserPreferences } = useSettings();

  // Local state for dirty tracking
  const [fullName, setFullName] = useState(userSettings.fullName || authFullName || '');
  const [jobTitle, setJobTitle] = useState(userSettings.jobTitle || '');
  const [language, setLanguage] = useState(userSettings.language || 'en-US');
  const [avatarUrl, setAvatarUrl] = useState(userSettings.avatarUrl || '');
  const [freelancerType, setFreelancerType] = useState<'independent' | 'organization'>('independent');
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (userSettings.fullName) setFullName(userSettings.fullName);
    if (userSettings.jobTitle) setJobTitle(userSettings.jobTitle);
    if (userSettings.language) setLanguage(userSettings.language);
    if (userSettings.avatarUrl) setAvatarUrl(userSettings.avatarUrl);
  }, [userSettings]);

  // Load existing freelancer type if role is freelancer
  useEffect(() => {
    async function loadFreelancerData() {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('users')
          .select('freelancer_type')
          .eq('id', user.id)
          .single();
        if (data?.freelancer_type) {
          setFreelancerType(data.freelancer_type as any);
        }
      } catch (e) {
        // Ignore table check errors
      }
    }
    if (role === 'freelancer') {
      loadFreelancerData();
    }
  }, [user?.id, role]);

  const handleFieldChange = (field: string, value: string) => {
    setIsDirtyLocal(true);
    // Mark dirty in SettingsContext so global SaveBar knows
    updateUserPreferences({ [field]: value } as any, false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar file size must be less than 2MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // If storage bucket isn't configured, use a data URL as fallback preview
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          setAvatarUrl(base64Url);
          handleFieldChange('avatarUrl', base64Url);
          toast.success('Avatar preview updated');
        };
        reader.readAsDataURL(file);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath);

        setAvatarUrl(publicUrlData.publicUrl);
        handleFieldChange('avatarUrl', publicUrlData.publicUrl);
        toast.success('Avatar uploaded successfully');
      }
    } catch (err: any) {
      toast.error('Failed to upload avatar: ' + (err.message || 'Storage error'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      // 1. Update Supabase users table
      const { error: dbError } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim(),
          ...(role === 'freelancer' ? { freelancer_type: freelancerType } : {}),
        })
        .eq('id', user.id);

      if (dbError) {
        console.warn('DB update note:', dbError.message);
      }

      // 2. Persist in preferences JSON via SettingsContext
      await updateUserPreferences({
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim(),
        language,
        avatarUrl: avatarUrl.trim(),
      }, true);

      setIsDirtyLocal(false);
      toast.success('Profile preferences updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setFullName(userSettings.fullName || authFullName || '');
    setJobTitle(userSettings.jobTitle || '');
    setLanguage(userSettings.language || 'en-US');
    setAvatarUrl(userSettings.avatarUrl || '');
    setIsDirtyLocal(false);
    toast.info('Changes discarded');
  };

  const userInitial = (fullName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* ── Personal Identity Card ── */}
      <SettingsSection
        label="Personal Identity"
        description="Your identity information across workspace channels, projects, and meetings."
      >
        {/* Avatar Row */}
        <SettingsRow
          icon={Camera}
          title="Profile Avatar"
          description="Supports JPG, PNG or WebP under 2MB."
        >
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-line flex items-center justify-center font-bold text-text overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-mono">{userInitial}</span>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <label className="px-3 py-1.5 rounded bg-surface hover:bg-surface-2 text-muted hover:text-text text-[11px] font-mono border border-line flex items-center gap-1.5 transition-colors cursor-pointer">
              <Upload size={12} />
              <span>{uploadingAvatar ? 'Uploading...' : 'Upload'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </div>
        </SettingsRow>

        {/* Full Name Row */}
        <SettingsRow
          icon={User}
          title="Full Name"
          description="Your display name shown on comments, tasks, and audit logs."
        >
          <input
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              handleFieldChange('fullName', e.target.value);
            }}
            placeholder="Jane Doe"
            className="w-full sm:w-64 px-3.5 py-1.5 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent/60 font-sans"
          />
        </SettingsRow>

        {/* Email Row (Read-only Auth Managed) */}
        <SettingsRow
          icon={Mail}
          title="Account Email"
          description="Primary email used for sign-in and delivery notifications."
          badge="Verified"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted bg-surface-2 px-3 py-1.5 rounded-xl border border-line">
              {user?.email || 'user@example.com'}
            </span>
            <span
              title="Managed by Supabase Auth credentials"
              className="px-2 py-0.5 text-[10px] font-mono text-muted bg-surface-2 border border-line rounded"
            >
              Auth
            </span>
          </div>
        </SettingsRow>

        {/* Job Title */}
        <SettingsRow
          icon={Briefcase}
          title="Job Title / Position"
          description="Your functional role within the team directory."
        >
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => {
              setJobTitle(e.target.value);
              handleFieldChange('jobTitle', e.target.value);
            }}
            placeholder="e.g. Senior Product Designer"
            className="w-full sm:w-64 px-3.5 py-1.5 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent/60 font-sans"
          />
        </SettingsRow>

        {/* Role Badge */}
        <SettingsRow
          icon={Shield}
          title="Workspace Role"
          description="Governs permissions, workflow approvals, and financial views."
        >
          <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-accent-soft text-accent border border-accent/20">
            {role || 'Member'}
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* ── Regional & Language Card ── */}
      <SettingsSection
        label="Regional Preferences"
        description="Localize date formatting, numbers, and interface language."
      >
        <SettingsRow
          icon={Globe}
          title="Display Language"
          description="Preferred language for workspace navigation and automated emails."
        >
          <Select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              handleFieldChange('language', e.target.value);
            }}
            options={LANGUAGE_OPTIONS}
            size="sm"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Freelancer Model (if applicable) ── */}
      {role === 'freelancer' && (
        <SettingsSection
          label="Freelancer Engagement Scope"
          description="Select whether you operate independently or under client agency scopes."
        >
          <div className="p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => {
                  setFreelancerType('independent');
                  setIsDirtyLocal(true);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  freelancerType === 'independent'
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-surface hover:bg-surface-2/60'
                }`}
              >
                <div className="font-semibold text-xs text-text mb-1">Independent Contractor</div>
                <div className="text-[11px] text-muted">Direct client contracts, personal invoicing, independent management.</div>
              </div>

              <div
                onClick={() => {
                  setFreelancerType('organization');
                  setIsDirtyLocal(true);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  freelancerType === 'organization'
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-surface hover:bg-surface-2/60'
                }`}
              >
                <div className="font-semibold text-xs text-text mb-1">Agency / Org Assigned</div>
                <div className="text-[11px] text-muted">Assigned into agency workspaces with deliverable-based permissions.</div>
              </div>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* Local Save & Discard buttons if modified */}
      {isDirtyLocal && (
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface hover:bg-surface-2 text-muted hover:text-text text-[11px] font-mono border border-line transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-white text-[11px] font-semibold transition-colors cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
