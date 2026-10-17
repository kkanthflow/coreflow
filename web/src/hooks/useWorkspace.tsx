import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type WorkspaceContextType = {
  orgId: string | null;
  orgName: string | null;
  membershipRole: string | null;
  canManageBilling: boolean;
  isOwner: boolean;
  defaultCurrency: string;
  loading: boolean;
  refreshWorkspace: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextType>({
  orgId: null,
  orgName: null,
  membershipRole: null,
  canManageBilling: false,
  isOwner: false,
  defaultCurrency: 'USD',
  loading: true,
  refreshWorkspace: async () => {},
});

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [canManageBilling, setCanManageBilling] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [defaultCurrency, setDefaultCurrency] = useState<string>('USD');
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    if (!session?.user?.id) {
      setOrgId(null);
      setOrgName(null);
      setMembershipRole(null);
      setCanManageBilling(false);
      setIsOwner(false);
      setDefaultCurrency('USD');
      setLoading(false);
      return;
    }

    try {
      // 1. Try finding organization membership
      const { data: userOrg } = await supabase
        .from('user_organizations')
        .select('org_id, role, organizations(id, name, default_currency)')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (userOrg && userOrg.organizations) {
        const org: any = Array.isArray(userOrg.organizations) ? userOrg.organizations[0] : userOrg.organizations;
        const role = (userOrg.role || '').toLowerCase();
        setOrgId(userOrg.org_id);
        setOrgName(org?.name || null);
        setMembershipRole(userOrg.role || null);
        setIsOwner(role === 'owner');
        setCanManageBilling(['owner', 'billing_admin'].includes(role));
        if (org?.default_currency) {
          setDefaultCurrency(org.default_currency);
        }
        return;
      }

      // 2. Fallback: load user preferences for currency only
      const { data: userData } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', session.user.id)
        .maybeSingle();

      if (userData?.preferences?.currency) {
        setDefaultCurrency(userData.preferences.currency);
      }

      setOrgId(null);
      setOrgName(null);
      setMembershipRole(null);
      setCanManageBilling(false);
      setIsOwner(false);
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setOrgId(null);
      setOrgName(null);
      setMembershipRole(null);
      setCanManageBilling(false);
      setIsOwner(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [session?.user?.id]);

  return (
    <WorkspaceContext.Provider value={{ 
      orgId, 
      orgName, 
      membershipRole,
      canManageBilling,
      isOwner,
      defaultCurrency, 
      loading, 
      refreshWorkspace: fetchWorkspace 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => useContext(WorkspaceContext);
