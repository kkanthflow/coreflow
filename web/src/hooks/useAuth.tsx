import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: string | null;
  fullName: string | null;
  accountType: 'freelancer' | 'organization' | 'client' | null;
  accountSetupCompleted: boolean;
  onboardingStatus: 'completed' | 'setup_required' | null;
  loading: boolean;
  refreshUserDetails: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  fullName: null,
  accountType: null,
  accountSetupCompleted: false,
  onboardingStatus: null,
  loading: true,
  refreshUserDetails: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'freelancer' | 'organization' | 'client' | null>(null);
  const [accountSetupCompleted, setAccountSetupCompleted] = useState<boolean>(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'completed' | 'setup_required' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDetails = async (userEmail: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, full_name, default_workspace_id, account_type, account_setup_completed')
        .eq('email', userEmail)
        .maybeSingle();
        
      if (data && !error) {
        setRole(data.role);
        setFullName(data.full_name);
        setAccountType(data.account_type as any);
        setAccountSetupCompleted(data.account_setup_completed === true);
        
        // Strict Onboarding Resolution:
        // Must explicitly have account_setup_completed = true AND valid account_type
        // Or if role/account_type is 'client', onboarding is complete
        const isClient = data.role === 'client' || data.account_type === 'client';
        const isSetup = isClient || (data.account_setup_completed === true && !!data.account_type);
        setOnboardingStatus(isSetup ? 'completed' : 'setup_required');

      } else {
        // User profile missing in public.users - this account was purged/deleted!
        console.warn('[useAuth] User profile missing from database. Purging stale session...');
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
        setUser(null);
        setRole(null);
        setFullName(null);
        setAccountType(null);
        setAccountSetupCompleted(false);
        setOnboardingStatus(null);
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
      await supabase.auth.signOut().catch(() => {});
      setSession(null);
      setUser(null);
      setRole(null);
      setFullName(null);
      setAccountType(null);
      setAccountSetupCompleted(false);
      setOnboardingStatus(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout: never allow session resolution to hang for > 3.5 seconds
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 3500);

    // Verify session with Supabase server to detect deleted/invalid users immediately
    supabase.auth
      .getUser()
      .then(async ({ data: { user: authUser }, error: authErr }) => {
        if (!mounted) return;
        if (authErr || !authUser) {
          // If a stale token exists in localStorage for a deleted user, wipe it immediately
          if (authErr && authErr.message && !authErr.message.includes('Auth session missing')) {
            console.warn('[useAuth] Stale token detected for deleted user. Clearing session...');
            await supabase.auth.signOut().catch(() => {});
          }
          if (mounted) {
            setSession(null);
            setUser(null);
            setRole(null);
            setFullName(null);
            setAccountType(null);
            setAccountSetupCompleted(false);
            setOnboardingStatus(null);
            setLoading(false);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(authUser);

        if (authUser.email) {
          await fetchUserDetails(authUser.email);
        } else {
          setOnboardingStatus(null);
        }
        if (mounted) setLoading(false);
      })
      .catch(async (err) => {
        console.warn('[useAuth] User verification failed:', err);
        await supabase.auth.signOut().catch(() => {});
        if (mounted) {
          setSession(null);
          setUser(null);
          setOnboardingStatus(null);
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user?.id) {
        setSession(null);
        setUser(null);
        setRole(null);
        setFullName(null);
        setAccountType(null);
        setAccountSetupCompleted(false);
        setOnboardingStatus(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session.user);
      if (session.user.email) {
        fetchUserDetails(session.user.email).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setRole(null);
        setFullName(null);
        setOnboardingStatus(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserDetails = async () => {
    if (session?.user?.email) {
      await fetchUserDetails(session.user.email);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setSession(null);
      setUser(null);
      setRole(null);
      setFullName(null);
      setAccountType(null);
      setAccountSetupCompleted(false);
      setOnboardingStatus(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      role, 
      fullName, 
      accountType, 
      accountSetupCompleted, 
      onboardingStatus, 
      loading, 
      refreshUserDetails, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
