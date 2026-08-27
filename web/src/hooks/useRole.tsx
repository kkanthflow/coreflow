import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { hasPermission, type AppPermission, type WorkspacePermission } from '../lib/permissions';

export const useRole = () => {
  const { role } = useAuth();

  const can = useCallback((permission: AppPermission | WorkspacePermission) => {
    return hasPermission(role, permission);
  }, [role]);

  const hasRole = useCallback((requiredRole: string) => {
    return role === requiredRole;
  }, [role]);

  const isAtLeast = useCallback((requiredRole: string) => {
    const HIERARCHY: Record<string, number> = {
      owner: 9, administrator: 8, director: 7, senior_manager: 6,
      manager: 5, team_lead: 4, senior_employee: 3, employee: 2,
      intern: 1, freelancer: 0,
      managing_director: 9, ceo: 9, cto: 9,
      project_manager: 5, hr: 8, developer: 2, general_member: 2,
    };
    return (HIERARCHY[role || ''] ?? 0) >= (HIERARCHY[requiredRole] ?? 0);
  }, [role]);

  return { role, can, hasRole, isAtLeast };
};
