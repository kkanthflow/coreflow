import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type WorkspaceContextType = {
  orgId: string | null;
  orgName: string | null;
  defaultCurrency: string;
  loading: boolean;
  refreshWorkspace: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextType>({
  orgId: null,
  orgName: null,
  defaultCurrency: 'USD',
  loading: true,
  refreshWorkspace: async () => {},
});

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState<string>('USD');
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    if (!session?.user?.id) {
      setOrgId(null);
      setOrgName(null);
      setDefaultCurrency('USD');
      setLoading(false);
      return;
    }

    try {
      // 1. Try finding organization membership
      const { data: userOrg } = await supabase
        .from('user_organizations')
        .select('org_id, organizations(id, name, default_currency)')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (userOrg && userOrg.organizations) {
        setOrgId(userOrg.org_id);
        // @ts-ignore
        setOrgName(userOrg.organizations?.name || null);
        // @ts-ignore
        if (userOrg.organizations?.default_currency) {
          // @ts-ignore
          setDefaultCurrency(userOrg.organizations.default_currency);
        }
        return;
      }

      // 2. Try checking if user owns an organization directly
      const { data: ownedOrg } = await supabase
        .from('organizations')
        .select('id, name, default_currency')
        .eq('owner_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (ownedOrg) {
        setOrgId(ownedOrg.id);
        setOrgName(ownedOrg.name);
        if (ownedOrg.default_currency) setDefaultCurrency(ownedOrg.default_currency);
        return;
      }

      // 3. Fallback to check users table org_id if present
      const { data: userData } = await supabase
        .from('users')
        .select('org_id, preferences')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userData?.preferences?.currency) {
        setDefaultCurrency(userData.preferences.currency);
      }

      if (userData?.org_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, name, default_currency')
          .eq('id', userData.org_id)
          .maybeSingle();

        if (orgData) {
          setOrgId(orgData.id);
          setOrgName(orgData.name);
          if (orgData.default_currency) setDefaultCurrency(orgData.default_currency);
          return;
        }
      }

      setOrgId(null);
      setOrgName(null);
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setOrgId(null);
      setOrgName(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [session?.user?.id]);

  return (
    <WorkspaceContext.Provider value={{ orgId, orgName, defaultCurrency, loading, refreshWorkspace: fetchWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => useContext(WorkspaceContext);
