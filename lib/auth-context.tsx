import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { Alert, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { WorkspacePermission, resolveWorkspacePermissions } from './permissions';
import { Session } from '@supabase/supabase-js';

export interface UserPreferences {
  theme: 'light' | 'dark';
  hapticFeedback: boolean;
  biometricLogin: boolean;
  meetingInvites: boolean;
  meetingReminders: boolean;
  roleUpdates: boolean;
  systemAlerts: boolean;
  weeklyDigest: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  freelancerType?: 'organization' | 'independent';
  avatarUrl?: string;
  // Enterprise fields
  organizationId?: string;
  organizationName?: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
  bio?: string;
  phone?: string;
  location?: string;
  // Legacy
  department?: string;
  lastLogin?: string;
  preferences?: UserPreferences;
}

export type WorkspaceType = 
  | 'organization'
  | 'independent'
  | 'external'
  | 'guest'
  | 'archived';

export interface Workspace {
  id: string; // orgId or 'independent'
  name: string;
  type: WorkspaceType;
  roles: string[];
  permissions: WorkspacePermission[];
  departmentId?: string;
  departmentName?: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeWorkspace: Workspace | null;
  availableWorkspaces: Workspace[];
  switchWorkspace: (workspaceId: string) => Promise<void>;
  hasWorkspacePermission: (permission: WorkspacePermission) => boolean;
  isFeatureEnabled: (featureKey: string) => boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  updateProfile: (updates: Partial<Pick<AppUser, 'fullName' | 'bio' | 'phone' | 'location' | 'jobTitle'>>) => Promise<void>;
  updateAvatar: (url: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  hapticFeedback: true,
  biometricLogin: false,
  meetingInvites: true,
  meetingReminders: true,
  roleUpdates: true,
  systemAlerts: false,
  weeklyDigest: true,
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);

  const activeFetchRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string, attempt = 1, force = false): Promise<boolean> => {
    if (!force && attempt === 1 && activeFetchRef.current === userId && user?.id === userId) {
      console.log('[AuthContext] Profile already loaded or loading for user:', userId);
      return true;
    }
    activeFetchRef.current = userId;
    console.log(`[AuthContext] fetchProfile attempt ${attempt} for user:`, userId);
    try {
      // Fire all 3 queries in parallel instead of sequentially
      const [profileResult, orgResult, prefResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase
          .from('user_organizations')
          .select('org_id, role, organizations (id, name)')
          .eq('user_id', userId),
        supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const { data, error } = profileResult;
      console.log('[AuthContext] fetchProfile result:', { data: !!data, error });

      if (!data || error) {
        // Retry up to 15 times with a 100ms delay (1.5 seconds total)
        // This makes retries extremely fast (under 1s) while still resolving temporary DB trigger delay
        if (attempt < 15) {
          console.warn(`[AuthContext] Profile not ready, retrying in 100ms... (attempt ${attempt})`);
          await new Promise(resolve => setTimeout(resolve, 100));
          return fetchProfile(userId, attempt + 1, force);
        }
        console.warn('[AuthContext] fetchProfile gave up after 15 attempts:', error);
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Profile Load Error',
            `Could not load user profile. Error: ${error?.message || 'User row not found in users table.'}`
          );
        }
        // Force logout if profile cannot be fetched to prevent a black screen freeze
        await supabase.auth.signOut();
        activeFetchRef.current = null;
        return false;
      }

      const orgMemberships = (orgResult.data || []) as any[];
      const hasOrg = orgMemberships.length > 0;

      // Race condition guard: for brand-new accounts (created < 15s ago),
      // if org membership is missing retry — register.tsx may still be writing to DB.
      // This is the key fix for the black/white screen after sign-up.
      // Note: Freelancers do not have organization memberships, so skip retrying for them.
      const isFreelancer = data.role === 'freelancer';
      const diff = Date.now() - new Date(data.created_at).getTime();
      const isNewAccount = data.created_at && diff > -10000 && diff < 15000;
      
      if (!hasOrg && !isFreelancer && isNewAccount && attempt < 20) {
        console.warn(`[AuthContext] New account with no org yet, retrying in 100ms... (attempt ${attempt})`);
        await new Promise(resolve => setTimeout(resolve, 100));
        return fetchProfile(userId, attempt + 1, force);
      }

      const prefData = prefResult.data;

      const preferences: UserPreferences = prefData ? {
        theme: prefData.theme as 'light' | 'dark',
        hapticFeedback: prefData.haptic_feedback,
        biometricLogin: prefData.biometric_login,
        meetingInvites: prefData.meeting_invites,
        meetingReminders: prefData.meeting_reminders,
        roleUpdates: prefData.role_updates,
        systemAlerts: prefData.system_alerts,
        weeklyDigest: prefData.weekly_digest,
      } : DEFAULT_PREFERENCES;

      // Primary org fallback for legacy dashboard support
      const primaryOrg = orgMemberships[0];
      const orgData = (primaryOrg?.organizations && !Array.isArray(primaryOrg.organizations)
        ? primaryOrg.organizations
        : Array.isArray(primaryOrg?.organizations) && primaryOrg.organizations.length > 0
          ? primaryOrg.organizations[0]
          : null) as { id: string; name: string } | null;

      const newUser = {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        freelancerType: data.freelancer_type,
        avatarUrl: data.avatar_url,
        organizationId: orgData?.id,
        organizationName: orgData?.name,
        jobTitle: data.job_title,
        bio: data.bio,
        phone: data.phone,
        location: data.location,
        department: data.department,
        lastLogin: data.last_login,
        preferences,
      };

      setUser(newUser);
      AsyncStorage.setItem('cached_user_profile', JSON.stringify(newUser)).catch(() => {});

      // Build available workspaces
      const independentWS: Workspace = {
        id: 'independent',
        name: `${data.full_name || 'My'} Freelancing`,
        type: 'independent',
        roles: ['freelancer'],
        permissions: resolveWorkspacePermissions('independent', ['freelancer']),
      };

      const orgWorkspaces: Workspace[] = orgMemberships
        .map((mem) => {
          const org = mem.organizations;
          if (!org) return null;
          const isExternal = data.is_external || false;
          const type: WorkspaceType = isExternal ? 'external' : 'organization';
          const roles = [mem.role];
          const permissions = resolveWorkspacePermissions(type, roles);
          return {
            id: org.id,
            name: `${org.name} Organization`,
            type,
            roles,
            permissions,
          };
        })
        .filter(Boolean) as Workspace[];

      const workspacesList: Workspace[] = [independentWS, ...orgWorkspaces];
      setAvailableWorkspaces(workspacesList);

      // Restore active workspace
      const savedActiveId = await AsyncStorage.getItem('active_workspace_id');
      const matched = workspacesList.find(w => w.id === savedActiveId) || 
                      workspacesList.find(w => w.id === data.default_workspace_id) || 
                      workspacesList[0];
      setActiveWorkspace(matched);

      console.log('[AuthContext] User and workspaces loaded. Active:', matched?.name);
      return true;
    } catch (e: any) {
      console.error('[AuthContext] Error fetching profile:', e);
      if (Platform.OS !== 'web') {
        Alert.alert('Profile Fetch Exception', e?.message || String(e));
      }
      activeFetchRef.current = null;
      return false;
    }
  };


  const refreshUser = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      await fetchProfile(data.session.user.id, 1, true);
    }
  };

  const updateProfile = async (
    updates: Partial<Pick<AppUser, 'fullName' | 'bio' | 'phone' | 'location' | 'jobTitle'>>
  ) => {
    if (!user) return;
    const dbUpdates: Record<string, any> = {};
    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.jobTitle !== undefined) dbUpdates.job_title = updates.jobTitle;

    const { error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', user.id);

    if (!error) {
      setUser(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const updateAvatar = (url: string) => {
    setUser(prev => prev ? { ...prev, avatarUrl: url } : null);
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return;
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
      if (updates.hapticFeedback !== undefined) dbUpdates.haptic_feedback = updates.hapticFeedback;
      if (updates.biometricLogin !== undefined) dbUpdates.biometric_login = updates.biometricLogin;
      if (updates.meetingInvites !== undefined) dbUpdates.meeting_invites = updates.meetingInvites;
      if (updates.meetingReminders !== undefined) dbUpdates.meeting_reminders = updates.meetingReminders;
      if (updates.roleUpdates !== undefined) dbUpdates.role_updates = updates.roleUpdates;
      if (updates.systemAlerts !== undefined) dbUpdates.system_alerts = updates.systemAlerts;
      if (updates.weeklyDigest !== undefined) dbUpdates.weekly_digest = updates.weeklyDigest;

      const { error } = await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, ...dbUpdates });

      if (error) {
        console.error('[AuthContext] Error saving preferences:', error);
      } else {
        setUser(prev => prev ? {
          ...prev,
          preferences: { ...(prev.preferences || DEFAULT_PREFERENCES), ...updates }
        } : null);
      }
    } catch (e) {
      console.error('[AuthContext] Exception saving preferences:', e);
    }
  };

  useEffect(() => {
    let initialSessionHandled = false;

    // Load cached profile instantly to make startup 0ms
    AsyncStorage.getItem('cached_user_profile')
      .then((cached) => {
        if (cached) {
          const parsed = JSON.parse(cached);
          setUser(parsed);
          setIsLoading(false);
        }
      })
      .catch(() => {});

    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionHandled = true;
      setSession(session);
      if (session?.user?.id) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      initialSessionHandled = true;
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION fires immediately — skip it if getSession() already handled it.
      // This prevents the double-fetch that causes startup lag.
      if (event === 'INITIAL_SESSION') {
        if (!initialSessionHandled) {
          // getSession() hasn't resolved yet — let this one handle it
          initialSessionHandled = true;
          setSession(session);
          if (session?.user?.id) {
            fetchProfile(session.user.id).finally(() => setIsLoading(false));
          } else {
            setIsLoading(false);
          }
        }
        return;
      }

      setSession(session);
      if (session?.user?.id) {
        // Only show loading spinner on actual sign-in (not token refresh)
        if (event === 'SIGNED_IN') setIsLoading(true);
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateOnlineStatus = async (userId: string, isOnline: boolean) => {
    try {
      await supabase
        .from('users')
        .update({
          is_online: isOnline,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (err) {
      console.warn('[AuthContext] Failed to update presence status:', err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    // Set online on load
    updateOnlineStatus(user.id, true);

    // Listen for app state changes to background/foreground
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      const isForeground = nextAppState === 'active';
      updateOnlineStatus(user.id, isForeground);
    });

    return () => {
      appStateSub.remove();
      // Set offline on unmount/logout
      updateOnlineStatus(user.id, false);
    };
  }, [user?.id]);

  const switchWorkspace = async (workspaceId: string) => {
    const matched = availableWorkspaces.find(w => w.id === workspaceId);
    if (matched) {
      setActiveWorkspace(matched);
      await AsyncStorage.setItem('active_workspace_id', workspaceId);

      try {
        await supabase.from('audit_logs').insert({
          workspace_id: matched.id === 'independent' ? null : matched.id,
          actor_id: user?.id,
          action: 'Workspace Switched',
          resource_type: 'workspace',
          resource_id: matched.id === 'independent' ? null : matched.id,
          new_values: { workspace_name: matched.name, workspace_type: matched.type },
        });
      } catch (e) {
        console.warn('[AuthContext] Workspace switch audit log insertion failed:', e);
      }
    }
  };

  const hasWorkspacePermission = useCallback((permission: WorkspacePermission): boolean => {
    if (!activeWorkspace) return false;
    return activeWorkspace.permissions.includes(permission);
  }, [activeWorkspace]);

  const isFeatureEnabled = useCallback((featureKey: string): boolean => {
    if (activeWorkspace?.type === 'independent') {
      return ['Finance', 'Invoices', 'Contracts', 'Portfolio'].includes(featureKey);
    }
    return ['CRM', 'Finance', 'HR', 'Chat', 'Analytics'].includes(featureKey);
  }, [activeWorkspace]);

  const logout = async () => {
    if (user?.id) {
      await updateOnlineStatus(user.id, false);
    }
    await Promise.all([
      AsyncStorage.removeItem('cached_user_profile'),
      AsyncStorage.removeItem('cached_home_stats'),
      AsyncStorage.removeItem('cached_home_projects'),
      AsyncStorage.removeItem('cached_home_tasks'),
      AsyncStorage.removeItem('active_workspace_id'),
    ]).catch(() => {});
    await supabase.auth.signOut();
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    activeWorkspace,
    availableWorkspaces,
    switchWorkspace,
    hasWorkspacePermission,
    isFeatureEnabled,
    logout,
    refreshUser,
    requestPasswordReset,
    updatePreferences,
    updateProfile,
    updateAvatar,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
