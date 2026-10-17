import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: string | null;
  fullName: string | null;
  onboardingStatus: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  fullName: null,
  onboardingStatus: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDetails = async (userEmail: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, full_name, default_workspace_id')
        .eq('email', userEmail)
        .single();
        
      if (data && !error) {
        setRole(data.role);
        setFullName(data.full_name);
        
        const isExecutive = ['owner', 'administrator'].includes(data.role || '');
        setOnboardingStatus(data.default_workspace_id || isExecutive ? 'completed' : 'workspace_required');
      } else {
        setRole(null);
        setFullName(null);
        setOnboardingStatus(null);
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
      setRole(null);
      setFullName(null);
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

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.email) {
          fetchUserDetails(session.user.email).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('[useAuth] getSession failed or timed out:', err);
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
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
      setOnboardingStatus(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, role, fullName, onboardingStatus, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
