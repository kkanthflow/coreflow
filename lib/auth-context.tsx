import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
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

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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

  const fetchProfile = async (userId: string) => {
    console.log('[AuthContext] fetchProfile starting for user:', userId);
    try {
      // Fetch user profile
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('[AuthContext] fetchProfile result:', { data: !!data, error });

      if (!data || error) {
        console.warn('[AuthContext] fetchProfile returned no data:', error);
        return;
      }

      // Fetch org membership + org name in one query
      const { data: orgMembership } = await supabase
        .from('user_organizations')
        .select(`
          org_id,
          role,
          organizations (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      // Fetch preferences
      const { data: prefData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

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

      const orgData = (orgMembership?.organizations && !Array.isArray(orgMembership.organizations)
        ? orgMembership.organizations
        : Array.isArray(orgMembership?.organizations) && orgMembership.organizations.length > 0
          ? orgMembership.organizations[0]
          : null) as { id: string; name: string } | null;

      setUser({
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        avatarUrl: data.avatar_url,
        // Enterprise fields
        organizationId: orgData?.id,
        organizationName: orgData?.name,
        jobTitle: data.job_title,
        bio: data.bio,
        phone: data.phone,
        location: data.location,
        // Legacy
        department: data.department,
        lastLogin: data.last_login,
        preferences,
      });

      console.log('[AuthContext] User state set:', data.email, '| Org:', orgData?.name);
    } catch (e) {
      console.error('[AuthContext] Error fetching profile:', e);
    }
  };

  const refreshUser = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      await fetchProfile(data.session.user.id);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(() => setIsLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user?.id) {
        setIsLoading(true);
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
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
