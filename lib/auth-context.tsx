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

  const fetchProfile = async (userId: string, attempt = 1): Promise<boolean> => {
    console.log(`[AuthContext] fetchProfile attempt ${attempt} for user:`, userId);
    try {
      // Fire all 3 queries in parallel instead of sequentially
      const [profileResult, orgResult, prefResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase
          .from('user_organizations')
          .select('org_id, role, organizations (id, name)')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const { data, error } = profileResult;
      console.log('[AuthContext] fetchProfile result:', { data: !!data, error });

      if (!data || error) {
        // Retry up to 8 times (over 12 seconds) — the DB trigger may not have created the user row yet
        if (attempt < 8) {
          console.warn(`[AuthContext] Profile not ready, retrying in 1.5s... (attempt ${attempt})`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return fetchProfile(userId, attempt + 1);
        }
        console.warn('[AuthContext] fetchProfile gave up after 8 attempts:', error);
        // Force logout if profile cannot be fetched to prevent a black screen freeze
        await supabase.auth.signOut();
        return false;
      }

      const orgMembership = orgResult.data;

      // Race condition guard: for brand-new accounts (created < 15s ago),
      // if org membership is missing retry — register.tsx may still be writing to DB.
      // This is the key fix for the black/white screen after sign-up.
      // Note: Freelancers do not have organization memberships, so skip retrying for them.
      const isFreelancer = data.role === 'freelancer';
      const isNewAccount = data.created_at &&
        (Date.now() - new Date(data.created_at).getTime()) < 15000;
      if (!orgMembership && !isFreelancer && isNewAccount && attempt < 8) {
        console.warn(`[AuthContext] New account with no org yet, retrying in 1.5s... (attempt ${attempt})`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        return fetchProfile(userId, attempt + 1);
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
        organizationId: orgData?.id,
        organizationName: orgData?.name,
        jobTitle: data.job_title,
        bio: data.bio,
        phone: data.phone,
        location: data.location,
        department: data.department,
        lastLogin: data.last_login,
        preferences,
      });

      console.log('[AuthContext] User state set:', data.email, '| Org:', orgData?.name ?? '(freelancer/pending)');
      return true;
    } catch (e) {
      console.error('[AuthContext] Error fetching profile:', e);
      return false;
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
    let initialSessionHandled = false;

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
