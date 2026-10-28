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

  const fetchUserDetails = async (authUserId: string, userEmail?: string) => {
    try {
      // 1. Try fetching by user UUID (primary key)
      let { data } = await supabase
        .from('users')
        .select('id, role, full_name, default_workspace_id, account_type, account_setup_completed')
        .eq('id', authUserId)
        .maybeSingle();

      // Fallback by email if ID lookup did not match
      if (!data && userEmail) {
        const emailRes = await supabase
          .from('users')
          .select('id, role, full_name, default_workspace_id, account_type, account_setup_completed')
          .ilike('email', userEmail.trim())
          .maybeSingle();
        if (emailRes.data) {
          data = emailRes.data;
        }
      }

      // If user profile is missing, auto-create it safely instead of nuking session
      if (!data) {
        const fallbackName = userEmail ? userEmail.split('@')[0] : 'User';
        const { data: createdUser, error: insertErr } = await supabase
          .from('users')
          .insert({
            id: authUserId,
            email: userEmail || null,
            full_name: fallbackName,
            role: 'team_member',
            account_type: null,
            account_setup_completed: false,
          })
          .select('id, role, full_name, default_workspace_id, account_type, account_setup_completed')
          .maybeSingle();

        if (createdUser && !insertErr) {
          data = createdUser;
        }
      }

      if (data) {
        let activeRole = data.role;
        setFullName(data.full_name);
        setAccountType(data.account_type as any);
        setAccountSetupCompleted(data.account_setup_completed === true);

        // Fetch active organization membership role if present
        const { data: uo } = await supabase
          .from('user_organizations')
          .select('org_id, role')
          .eq('user_id', authUserId)
          .limit(1)
          .maybeSingle();

        if (uo?.role) {
          activeRole = uo.role;
        }
        setRole(activeRole);

        // Check if client
        const isClient = activeRole === 'client' || data.account_type === 'client';
        let isSetup = isClient || (data.account_setup_completed === true && !!data.account_type);

        // Auto-heal: If setup marked false, check if user has active org membership
        if (!isSetup && uo?.org_id) {
          isSetup = true;
          setAccountType('organization');
          setAccountSetupCompleted(true);
          // Silently persist auto-healing
          await supabase.from('users').update({
            account_type: 'organization',
            account_setup_completed: true,
            default_workspace_id: uo.org_id,
            role: activeRole || 'employee',
          }).eq('id', authUserId).match(() => {});
        }

        setOnboardingStatus(isSetup ? 'completed' : 'setup_required');
      } else {
        setOnboardingStatus('setup_required');
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
      setOnboardingStatus('setup_required');
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

        if (authUser) {
          await fetchUserDetails(authUser.id, authUser.email);
        } else {
          setOnboardingStatus(null);
        }
        if (mounted) setLoading(false);
      })
      .catch(async (err) => {
        console.warn('[useAuth] User verification failed:', err);
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
      fetchUserDetails(session.user.id, session.user.email).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const refreshUserDetails = async () => {
    if (session?.user?.id) {
      await fetchUserDetails(session.user.id, session.user.email);
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
