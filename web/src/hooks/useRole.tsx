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
      owner: 7, administrator: 6, manager: 5, team_lead: 4,
      team_member: 3, employee: 3, guest: 2, client: 1
    };
    return (HIERARCHY[role || ''] ?? 0) >= (HIERARCHY[requiredRole] ?? 0);
  }, [role]);

  return { role, can, hasRole, isAtLeast };
};
