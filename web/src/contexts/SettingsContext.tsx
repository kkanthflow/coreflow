import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { formatCurrency, SUPPORTED_CURRENCIES } from '../lib/currency';
import { toast } from '../components/ui/Toast';

export type ThemeMode = 'light' | 'dark' | 'system';
export type DensityMode = 'comfortable' | 'compact';

export interface NotificationSettings {
  push: boolean;
  emailDigest: boolean;
  inApp: boolean;
  meetingReminders: boolean;
  meetingReminderMinutes: number;
  taskDue: boolean;
  approvals: boolean;
  invoicePaid: boolean;
  mentions: boolean;
  chat: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface UserSettings {
  theme: ThemeMode;
  density: DensityMode;
  accent: string;
  reduceMotion: boolean;
  hapticAudioFeedback: boolean;
  language: string;
  jobTitle: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  notifications: NotificationSettings;
  audioInputId: string;
  videoInputId: string;
  audioOutputId: string;
  e2eeEnabled: boolean;
}

export interface WorkspaceSettings {
  currency: string;
  locale: string;
  timezone: string;
  dateFormat: string;
  fiscalYear: string;
  workspaceName: string;
  workspaceAddress: string;
  workspaceGst: string;
  workspaceLogoUrl: string;
}

interface SettingsContextType {
  // User settings
  userSettings: UserSettings;
  updateUserSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K], autoSave?: boolean) => Promise<boolean>;
  updateUserPreferences: (partial: Partial<UserSettings>, autoSave?: boolean) => Promise<boolean>;
  
  // Workspace settings (admin editable, read-only for members)
  workspaceSettings: WorkspaceSettings;
  updateWorkspaceSetting: <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K], autoSave?: boolean) => Promise<boolean>;
  updateWorkspaceSettings: (partial: Partial<WorkspaceSettings>, autoSave?: boolean) => Promise<boolean>;
  canEditWorkspace: boolean;
  
  // Currency
  activeCurrency: string;
  formatMoney: (amount: number, includeCode?: boolean) => string;
  
  // Theme
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  
  // Dirty form management for SaveBar
  isDirty: boolean;
  dirtyFields: Set<string>;
  saveDirtyChanges: () => Promise<boolean>;
  discardDirtyChanges: () => void;
  
  // Loading & status
  loading: boolean;
  saving: boolean;
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system',
  density: 'comfortable',
  accent: '#ff5a36',
  reduceMotion: false,
  hapticAudioFeedback: true,
  language: 'en-US',
  jobTitle: '',
  fullName: '',
  email: '',
  avatarUrl: '',
  notifications: {
    push: true,
    emailDigest: true,
    inApp: true,
    meetingReminders: true,
    meetingReminderMinutes: 15,
    taskDue: true,
    approvals: true,
    invoicePaid: true,
    mentions: true,
    chat: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  },
  audioInputId: 'default',
  videoInputId: 'default',
  audioOutputId: 'default',
  e2eeEnabled: true,
};

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  currency: 'INR',
  locale: 'en-IN',
  timezone: 'Asia/Kolkata',
  dateFormat: 'YYYY-MM-DD',
  fiscalYear: 'April – March',
  workspaceName: 'Skavelon Technologies',
  workspaceAddress: 'No. 9, Kamaraj St, Kosapalayam, Puducherry – 13',
  workspaceGst: '',
  workspaceLogoUrl: '',
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, fullName: authFullName } = useAuth();
  const { 
    orgId, 
    orgName: wsOrgName, 
    orgAddress: wsOrgAddress, 
    orgGst: wsOrgGst, 
    defaultCurrency: wsCurrency, 
    canManageBilling, 
    isOwner,
    refreshWorkspace 
  } = useWorkspace();

  const canEditWorkspace = isOwner || canManageBilling;

  // ── Initial Theme Resolution from LocalStorage or Pre-Paint ──
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem('app-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved as ThemeMode;
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('app-theme');
    if (saved === 'light') return 'light';
    if (saved === 'dark') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // ── Settings State ──
  const [userSettings, setUserSettings] = useState<UserSettings>(() => ({
    ...DEFAULT_USER_SETTINGS,
    theme: (typeof window !== 'undefined' ? (localStorage.getItem('app-theme') as ThemeMode) : 'system') || 'system',
    fullName: authFullName || user?.email?.split('@')[0] || '',
    email: user?.email || '',
  }));

  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(() => ({
    ...DEFAULT_WORKSPACE_SETTINGS,
    currency: wsCurrency || 'INR',
    workspaceName: wsOrgName || DEFAULT_WORKSPACE_SETTINGS.workspaceName,
    workspaceAddress: wsOrgAddress || DEFAULT_WORKSPACE_SETTINGS.workspaceAddress,
    workspaceGst: wsOrgGst || '',
  }));

  // Pristine snapshots for dirty checking
  const pristineUserSettingsRef = useRef<UserSettings>(userSettings);
  const pristineWorkspaceSettingsRef = useRef<WorkspaceSettings>(workspaceSettings);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Synchronize Theme with DOM & LocalStorage ──
  const applyThemeToDOM = useCallback((activeTheme: ThemeMode) => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = activeTheme === 'dark' || (activeTheme === 'system' && mediaQuery.matches);
    const resolved = isDark ? 'dark' : 'light';

    setResolvedTheme(resolved);

    const doc = document.documentElement;
    if (isDark) {
      doc.classList.add('dark');
      doc.setAttribute('data-theme', 'dark');
    } else {
      doc.classList.remove('dark');
      doc.setAttribute('data-theme', 'light');
    }

    localStorage.setItem('app-theme', activeTheme);
  }, []);

  useEffect(() => {
    applyThemeToDOM(theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyThemeToDOM('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, applyThemeToDOM]);

  // Set Theme Handler
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    setUserSettings(prev => ({ ...prev, theme: newTheme }));
    applyThemeToDOM(newTheme);

    // Save preference to Supabase asynchronously if authenticated
    if (user?.id) {
      supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const currentPrefs = data?.preferences || {};
          return supabase
            .from('users')
            .update({ preferences: { ...currentPrefs, theme: newTheme } })
            .eq('id', user.id);
        })
        .catch(err => console.warn('[SettingsStore] Failed to sync theme to DB:', err));
    }
  }, [user?.id, applyThemeToDOM]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // ── Load Settings from Database on Auth Mount ──
  useEffect(() => {
    let isMounted = true;

    async function loadRemoteSettings() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1. Fetch user record (preferences, full_name, etc.)
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, email, avatar_url, preferences')
          .eq('id', user.id)
          .maybeSingle();

        if (userData && isMounted) {
          const prefs = userData.preferences || {};
          const loadedTheme = (prefs.theme as ThemeMode) || theme;

          const mergedUser: UserSettings = {
            ...DEFAULT_USER_SETTINGS,
            theme: loadedTheme,
            density: prefs.density || DEFAULT_USER_SETTINGS.density,
            accent: prefs.accent || DEFAULT_USER_SETTINGS.accent,
            reduceMotion: prefs.reduceMotion ?? DEFAULT_USER_SETTINGS.reduceMotion,
            hapticAudioFeedback: prefs.hapticFeedback ?? prefs.hapticAudioFeedback ?? DEFAULT_USER_SETTINGS.hapticAudioFeedback,
            language: prefs.language || DEFAULT_USER_SETTINGS.language,
            jobTitle: prefs.jobTitle || '',
            fullName: userData.full_name || user.email?.split('@')[0] || '',
            email: userData.email || user.email || '',
            avatarUrl: userData.avatar_url || '',
            notifications: {
              ...DEFAULT_USER_SETTINGS.notifications,
              ...(prefs.notifications || {}),
            },
            audioInputId: prefs.audioInputId || 'default',
            videoInputId: prefs.videoInputId || 'default',
            audioOutputId: prefs.audioOutputId || 'default',
            e2eeEnabled: prefs.e2eeEnabled ?? true,
          };

          setUserSettings(mergedUser);
          pristineUserSettingsRef.current = mergedUser;

          // If DB has a stored theme preference, apply it
          if (prefs.theme && prefs.theme !== theme) {
            setThemeState(prefs.theme);
            applyThemeToDOM(prefs.theme);
          }
        }

        // 2. Load Workspace info
        if (wsOrgName || wsCurrency) {
          setWorkspaceSettings(prev => {
            const next: WorkspaceSettings = {
              ...prev,
              workspaceName: wsOrgName || prev.workspaceName,
              workspaceAddress: wsOrgAddress || prev.workspaceAddress,
              workspaceGst: wsOrgGst || prev.workspaceGst,
              currency: wsCurrency || prev.currency,
            };
            pristineWorkspaceSettingsRef.current = next;
            return next;
          });
        }
      } catch (err) {
        console.error('[SettingsStore] Error loading remote settings:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRemoteSettings();

    return () => {
      isMounted = false;
    };
  }, [user?.id, wsOrgName, wsCurrency, wsOrgAddress, wsOrgGst]);

  // Keep workspace settings in sync when useWorkspace updates
  useEffect(() => {
    setWorkspaceSettings(prev => ({
      ...prev,
      workspaceName: wsOrgName || prev.workspaceName,
      workspaceAddress: wsOrgAddress || prev.workspaceAddress,
      workspaceGst: wsOrgGst || prev.workspaceGst,
      currency: wsCurrency || prev.currency,
    }));
  }, [wsOrgName, wsCurrency, wsOrgAddress, wsOrgGst]);

  // ── Currency & Money Formatter ──
  const activeCurrency = workspaceSettings.currency || wsCurrency || 'INR';

  const formatMoney = useCallback((amount: number, includeCode = false): string => {
    return formatCurrency(amount, activeCurrency, includeCode);
  }, [activeCurrency]);

  // ── User Preference Updates ──
  const updateUserPreferences = useCallback(async (
    partial: Partial<UserSettings>, 
    autoSave = true
  ): Promise<boolean> => {
    setUserSettings(prev => ({ ...prev, ...partial }));

    if (!autoSave) {
      // Mark fields as dirty for SaveBar
      setDirtyFields(prev => {
        const next = new Set(prev);
        Object.keys(partial).forEach(k => next.add(k));
        return next;
      });
      return true;
    }

    if (!user?.id) return false;

    setSaving(true);
    try {
      // Fetch latest preferences JSON to avoid overwriting unrelated fields
      const { data: uData } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle();

      const existingPrefs = uData?.preferences || {};
      const newPrefs = {
        ...existingPrefs,
        ...partial,
        notifications: {
          ...(existingPrefs.notifications || {}),
          ...(partial.notifications || {}),
        },
      };

      const updatePayload: Record<string, any> = {
        preferences: newPrefs,
        updated_at: new Date().toISOString(),
      };

      if (partial.fullName !== undefined) updatePayload.full_name = partial.fullName;
      if (partial.avatarUrl !== undefined) updatePayload.avatar_url = partial.avatarUrl;

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', user.id);

      if (error) throw error;

      pristineUserSettingsRef.current = { ...userSettings, ...partial };
      setDirtyFields(prev => {
        const next = new Set(prev);
        Object.keys(partial).forEach(k => next.delete(k));
        return next;
      });

      toast.success('Preferences saved');
      return true;
    } catch (err: any) {
      console.error('[SettingsStore] Failed to update preferences:', err);
      toast.error(err.message || 'Could not save preferences');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.id, userSettings]);

  const updateUserSetting = useCallback(async <K extends keyof UserSettings>(
    key: K, 
    value: UserSettings[K], 
    autoSave = true
  ): Promise<boolean> => {
    return updateUserPreferences({ [key]: value }, autoSave);
  }, [updateUserPreferences]);

  // ── Workspace Setting Updates ──
  const updateWorkspaceSettings = useCallback(async (
    partial: Partial<WorkspaceSettings>, 
    autoSave = true
  ): Promise<boolean> => {
    setWorkspaceSettings(prev => ({ ...prev, ...partial }));

    if (!autoSave) {
      setDirtyFields(prev => {
        const next = new Set(prev);
        Object.keys(partial).forEach(k => next.add(k));
        return next;
      });
      return true;
    }

    if (!orgId) {
      // Fallback for indie / non-org users: save currency to user preferences
      if (partial.currency && user?.id) {
        await updateUserPreferences({} as any, true);
      }
      return true;
    }

    setSaving(true);
    try {
      const dbPayload: Record<string, any> = {};
      if (partial.workspaceName !== undefined) dbPayload.name = partial.workspaceName;
      if (partial.workspaceAddress !== undefined) dbPayload.address = partial.workspaceAddress;
      if (partial.workspaceGst !== undefined) dbPayload.gst_number = partial.workspaceGst;
      if (partial.currency !== undefined) dbPayload.default_currency = partial.currency;

      const { error } = await supabase
        .from('organizations')
        .update(dbPayload)
        .eq('id', orgId);

      if (error) throw error;

      if (refreshWorkspace) {
        await refreshWorkspace();
      }

      pristineWorkspaceSettingsRef.current = { ...workspaceSettings, ...partial };
      setDirtyFields(prev => {
        const next = new Set(prev);
        Object.keys(partial).forEach(k => next.delete(k));
        return next;
      });

      toast.success('Workspace settings updated');
      return true;
    } catch (err: any) {
      console.error('[SettingsStore] Workspace update failed:', err);
      toast.error(err.message || 'Could not save workspace settings');
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId, refreshWorkspace, updateUserPreferences, user?.id, workspaceSettings]);

  const updateWorkspaceSetting = useCallback(async <K extends keyof WorkspaceSettings>(
    key: K, 
    value: WorkspaceSettings[K], 
    autoSave = true
  ): Promise<boolean> => {
    return updateWorkspaceSettings({ [key]: value }, autoSave);
  }, [updateWorkspaceSettings]);

  // ── Dirty State Management (SaveBar) ──
  const isDirty = dirtyFields.size > 0;

  const saveDirtyChanges = useCallback(async (): Promise<boolean> => {
    const userSuccess = await updateUserPreferences(userSettings, true);
    const wsSuccess = await updateWorkspaceSettings(workspaceSettings, true);
    return userSuccess && wsSuccess;
  }, [updateUserPreferences, updateWorkspaceSettings, userSettings, workspaceSettings]);

  const discardDirtyChanges = useCallback(() => {
    setUserSettings(pristineUserSettingsRef.current);
    setWorkspaceSettings(pristineWorkspaceSettingsRef.current);
    setDirtyFields(new Set());
    toast.info('Unsaved changes discarded');
  }, []);

  const value = useMemo<SettingsContextType>(() => ({
    userSettings,
    updateUserSetting,
    updateUserPreferences,
    workspaceSettings,
    updateWorkspaceSetting,
    updateWorkspaceSettings,
    canEditWorkspace,
    activeCurrency,
    formatMoney,
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDirty,
    dirtyFields,
    saveDirtyChanges,
    discardDirtyChanges,
    loading,
    saving,
  }), [
    userSettings,
    updateUserSetting,
    updateUserPreferences,
    workspaceSettings,
    updateWorkspaceSetting,
    updateWorkspaceSettings,
    canEditWorkspace,
    activeCurrency,
    formatMoney,
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDirty,
    dirtyFields,
    saveDirtyChanges,
    discardDirtyChanges,
    loading,
    saving,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
