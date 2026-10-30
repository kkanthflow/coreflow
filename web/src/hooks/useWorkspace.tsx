import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface AssignedDepartment {
  id: string;
  name: string;
  purpose: string | null;
  description: string | null;
  color: string | null;
  responsibilities?: string[];
  enabled_modules?: any[];
  module_configurations?: Record<string, any>;
  head_user_id?: string | null;
}

type WorkspaceContextType = {
  orgId: string | null;
  orgName: string | null;
  orgAddress: string | null;
  orgGst: string | null;
  membershipRole: string | null;
  canManageBilling: boolean;
  isOwner: boolean;
  isLeadership: boolean;
  hasOrgOversight: boolean;
  assignedDepartmentId: string | null;
  assignedDepartment: AssignedDepartment | null;
  userDepartmentRole: string | null;
  leadershipDesignation: string | null;
  leadershipVisibility: string | null;
  canManageLeadership: boolean;
  canManageDepartments: boolean;
  defaultCurrency: string;
  loading: boolean;
  refreshWorkspace: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextType>({
  orgId: null,
  orgName: null,
  orgAddress: null,
  orgGst: null,
  membershipRole: null,
  canManageBilling: false,
  isOwner: false,
  isLeadership: false,
  hasOrgOversight: false,
  assignedDepartmentId: null,
  assignedDepartment: null,
  userDepartmentRole: null,
  leadershipDesignation: null,
  leadershipVisibility: null,
  canManageLeadership: false,
  canManageDepartments: false,
  defaultCurrency: 'USD',
  loading: true,
  refreshWorkspace: async () => {},
});

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgAddress, setOrgAddress] = useState<string | null>(null);
  const [orgGst, setOrgGst] = useState<string | null>(null);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [canManageBilling, setCanManageBilling] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isLeadership, setIsLeadership] = useState<boolean>(false);
  const [hasOrgOversight, setHasOrgOversight] = useState<boolean>(false);
  const [assignedDepartmentId, setAssignedDepartmentId] = useState<string | null>(null);
  const [assignedDepartment, setAssignedDepartment] = useState<AssignedDepartment | null>(null);
  const [userDepartmentRole, setUserDepartmentRole] = useState<string | null>(null);
  const [leadershipDesignation, setLeadershipDesignation] = useState<string | null>(null);
  const [leadershipVisibility, setLeadershipVisibility] = useState<string | null>(null);
  const [canManageLeadership, setCanManageLeadership] = useState<boolean>(false);
  const [canManageDepartments, setCanManageDepartments] = useState<boolean>(false);
  const [defaultCurrency, setDefaultCurrency] = useState<string>('USD');
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    if (!session?.user?.id) {
      setOrgId(null);
      setOrgName(null);
      setOrgAddress(null);
      setOrgGst(null);
      setMembershipRole(null);
      setCanManageBilling(false);
      setIsOwner(false);
      setIsLeadership(false);
      setHasOrgOversight(false);
      setAssignedDepartmentId(null);
      setAssignedDepartment(null);
      setUserDepartmentRole(null);
      setLeadershipDesignation(null);
      setLeadershipVisibility(null);
      setCanManageLeadership(false);
      setCanManageDepartments(false);
      setDefaultCurrency('USD');
      setLoading(false);
      return;
    }

    try {
      let resolvedOrgId: string | null = null;
      let resolvedOrgName: string | null = null;
      let resolvedOrgAddress: string | null = null;
      let resolvedOrgGst: string | null = null;
      let resolvedRole: string | null = null;
      let resolvedCurrency = 'USD';
      let resolvedIsOwner = false;

      // 1. Try finding organization membership
      const { data: userOrg } = await supabase
        .from('user_organizations')
        .select('org_id, role, department_id, organizations(id, name, default_currency, address, gst_number)')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (userOrg && userOrg.organizations) {
        const org: any = Array.isArray(userOrg.organizations) ? userOrg.organizations[0] : userOrg.organizations;
        resolvedOrgId = userOrg.org_id;
        resolvedOrgName = org?.name || null;
        resolvedOrgAddress = org?.address || null;
        resolvedOrgGst = org?.gst_number || null;
        resolvedRole = userOrg.role || null;
        if (org?.default_currency) {
          resolvedCurrency = org.default_currency;
        }
      } else {
        // 2. Try finding organization where user is direct owner
        const { data: ownedOrg } = await supabase
          .from('organizations')
          .select('id, name, default_currency, address, gst_number')
          .eq('owner_id', session.user.id)
          .limit(1)
          .maybeSingle();

        if (ownedOrg) {
          resolvedOrgId = ownedOrg.id;
          resolvedOrgName = ownedOrg.name || null;
          resolvedOrgAddress = ownedOrg.address || null;
          resolvedOrgGst = ownedOrg.gst_number || null;
          resolvedRole = 'owner';
          resolvedIsOwner = true;
          if (ownedOrg.default_currency) {
            resolvedCurrency = ownedOrg.default_currency;
          }
        }
      }

      if (resolvedOrgId) {
        // Check active multi-owner status in organization_owners
        const { data: ownerRecord } = await supabase
          .from('organization_owners')
          .select('id')
          .eq('org_id', resolvedOrgId)
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (ownerRecord || resolvedRole === 'owner') {
          resolvedIsOwner = true;
        }

        // Check leadership member appointment
        const { data: leadershipData } = await supabase
          .from('leadership_members')
          .select('designation, visibility_level, can_manage_departments, can_manage_leadership')
          .eq('org_id', resolvedOrgId)
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle();

        // Check primary department assignment for employee immersion
        const { data: deptMembership } = await supabase
          .from('department_members')
          .select(`
            department_id,
            department_role,
            is_primary,
            departments:department_id (
              id,
              name,
              purpose,
              description,
              color,
              responsibilities,
              enabled_modules,
              module_configurations,
              head_user_id
            )
          `)
          .eq('org_id', resolvedOrgId)
          .eq('user_id', session.user.id)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();

        let resolvedDeptId: string | null = deptMembership?.department_id || null;
        let resolvedDept: AssignedDepartment | null = (deptMembership?.departments as any) || null;
        let resolvedDeptRole: string | null = deptMembership?.department_role || null;

        // If not in department_members, check user_organizations.department_id
        const fallbackDeptId = (userOrg as any)?.department_id;
        if (!resolvedDeptId && fallbackDeptId) {
          resolvedDeptId = fallbackDeptId;
          const { data: directDept } = await supabase
            .from('departments')
            .select('id, name, purpose, description, color, responsibilities, enabled_modules, module_configurations, head_user_id')
            .eq('id', resolvedDeptId)
            .maybeSingle();
          resolvedDept = directDept as any;
        }

        const isLeadUser = resolvedIsOwner || 
          ['founder', 'co-founder', 'administrator'].includes((resolvedRole || '').toLowerCase()) ||
          ['full_organization', 'all_departments'].includes(leadershipData?.visibility_level || '');

        const hasOversight = resolvedIsOwner || 
          leadershipData?.visibility_level === 'full_organization' || 
          leadershipData?.visibility_level === 'all_departments' || 
          resolvedRole === 'administrator';

        setOrgId(resolvedOrgId);
        setOrgName(resolvedOrgName);
        setOrgAddress(resolvedOrgAddress);
        setOrgGst(resolvedOrgGst);
        setMembershipRole(resolvedRole);
        setIsOwner(resolvedIsOwner);
        setIsLeadership(isLeadUser);
        setHasOrgOversight(hasOversight);
        setAssignedDepartmentId(resolvedDeptId);
        setAssignedDepartment(resolvedDept);
        setUserDepartmentRole(resolvedDeptRole);
        setCanManageBilling(resolvedIsOwner || ['administrator', 'billing_admin'].includes((resolvedRole || '').toLowerCase()));
        setDefaultCurrency(resolvedCurrency);

        setLeadershipDesignation(leadershipData?.designation || (resolvedIsOwner ? 'Owner' : null));
        setLeadershipVisibility(leadershipData?.visibility_level || (resolvedIsOwner ? 'full_organization' : null));
        setCanManageLeadership(resolvedIsOwner || leadershipData?.can_manage_leadership === true);
        setCanManageDepartments(resolvedIsOwner || leadershipData?.can_manage_departments === true || resolvedRole === 'administrator');
        return;
      }

      // 3. Fallback: Solo / Indie workspace - load user preferences for currency
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
      setOrgAddress(null);
      setOrgGst(null);
      setMembershipRole(null);
      setCanManageBilling(false);
      setIsOwner(false);
      setIsLeadership(false);
      setHasOrgOversight(false);
      setAssignedDepartmentId(null);
      setAssignedDepartment(null);
      setUserDepartmentRole(null);
      setLeadershipDesignation(null);
      setLeadershipVisibility(null);
      setCanManageLeadership(false);
      setCanManageDepartments(false);
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setOrgId(null);
      setOrgName(null);
      setMembershipRole(null);
      setCanManageBilling(false);
      setIsOwner(false);
      setIsLeadership(false);
      setHasOrgOversight(false);
      setAssignedDepartmentId(null);
      setAssignedDepartment(null);
      setUserDepartmentRole(null);
      setLeadershipDesignation(null);
      setLeadershipVisibility(null);
      setCanManageLeadership(false);
      setCanManageDepartments(false);
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
      orgAddress,
      orgGst,
      membershipRole,
      canManageBilling,
      isOwner,
      isLeadership,
      hasOrgOversight,
      assignedDepartmentId,
      assignedDepartment,
      userDepartmentRole,
      leadershipDesignation,
      leadershipVisibility,
      canManageLeadership,
      canManageDepartments,
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
