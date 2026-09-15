import { supabaseAdmin as supabase } from '../_core/supabase';

export type ProjectAction =
  | 'project.view'
  | 'project.manage'
  | 'project.delete'
  | 'task.view'
  | 'task.create'
  | 'task.update'
  | 'task.delete'
  | 'milestone.view'
  | 'milestone.manage'
  | 'deliverable.view'
  | 'deliverable.submit'
  | 'deliverable.approve'
  | 'change_request.create'
  | 'change_request.decide'
  | 'client_access.manage';

export interface AuthorizeProjectActionParams {
  userId: string;
  projectId: string;
  action: ProjectAction;
  resourceType?: 'project' | 'task' | 'milestone' | 'deliverable' | 'change_request';
  resourceId?: string;
  previewMode?: boolean; // If true, caller is an internal user previewing the client view
}

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
  scope?: 'owner' | 'admin' | 'department' | 'member' | 'client' | 'denied';
  userRole?: string;
  clientRole?: string;
}

export class ProjectAuthService {
  /**
   * Central authoritative project authorization engine.
   * Evaluates:
   * 1. Authentication & Existence
   * 2. Tenant & Organization Ownership
   * 3. RBAC Permissions (What can the user do)
   * 4. Project Membership (Where can they do it)
   * 5. Resource Assignment (Which specific task/item they can modify)
   * 6. Client Project Access & Granular Capabilities
   * 7. Internal Preview Mode Guard (Denies client mutations from preview)
   */
  static async authorizeProjectAction(
    params: AuthorizeProjectActionParams
  ): Promise<AuthorizationResult> {
    const { userId, projectId, action, resourceType, resourceId, previewMode } = params;

    if (!userId || !projectId) {
      return { authorized: false, reason: 'Missing user or project identity', scope: 'denied' };
    }

    // 1. Fetch project record
    const { data: project, error: pErr } = await supabase
      .from('projects')
      .select('id, org_id, department_id, owner_id, created_by, status, deleted_at')
      .eq('id', projectId)
      .single();

    if (pErr || !project || project.deleted_at) {
      return { authorized: false, reason: 'Project not found or archived', scope: 'denied' };
    }

    // 2. Check for Client Project Access
    const { data: clientAccess } = await supabase
      .from('project_client_access')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (clientAccess) {
      // PREVIEW MODE GUARD: Internal preview cannot execute client actions
      if (previewMode) {
        return {
          authorized: false,
          reason: 'Client actions cannot be executed in Preview mode',
          scope: 'denied',
        };
      }

      // Check specific client capabilities
      if (action === 'project.view' || action === 'deliverable.view' || action === 'milestone.view') {
        if (clientAccess.can_view) {
          return { authorized: true, scope: 'client', clientRole: clientAccess.access_role };
        }
      }

      if (action === 'deliverable.approve') {
        if (clientAccess.can_approve) {
          return { authorized: true, scope: 'client', clientRole: clientAccess.access_role };
        }
        return { authorized: false, reason: 'Client contact does not hold approve permission', scope: 'client' };
      }

      if (action === 'change_request.decide') {
        if (clientAccess.can_approve || clientAccess.can_request_changes) {
          return { authorized: true, scope: 'client', clientRole: clientAccess.access_role };
        }
        return { authorized: false, reason: 'Client contact not authorized to decide change requests', scope: 'client' };
      }

      if (action === 'change_request.create') {
        if (clientAccess.can_request_changes) {
          return { authorized: true, scope: 'client', clientRole: clientAccess.access_role };
        }
        return { authorized: false, reason: 'Client contact cannot request change orders', scope: 'client' };
      }

      // Default client read check
      if (clientAccess.can_view) {
        return { authorized: true, scope: 'client', clientRole: clientAccess.access_role };
      }

      return { authorized: false, reason: 'Client permission denied', scope: 'client' };
    }

    // 3. Independent Project (org_id IS NULL)
    if (!project.org_id) {
      if (project.owner_id === userId || project.created_by === userId) {
        return { authorized: true, scope: 'owner' };
      }

      // Check project members for independent project
      const { data: member } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (member) {
        return { authorized: true, scope: 'member', userRole: member.role };
      }

      return { authorized: false, reason: 'Unauthorized access to independent project', scope: 'denied' };
    }

    // 4. Organization Project: Check User Organization Role
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('role, department_id')
      .eq('org_id', project.org_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!userOrg) {
      return { authorized: false, reason: 'User does not belong to organization', scope: 'denied' };
    }

    const orgRole = userOrg.role;

    // OWNER: Unrestricted authority across all organization projects
    if (orgRole === 'owner') {
      return { authorized: true, scope: 'owner', userRole: 'owner' };
    }

    // ADMINISTRATOR / HIGH PRIVILEGE: Unrestricted authority across org projects
    if (['administrator', 'managing_director', 'ceo', 'cto'].includes(orgRole)) {
      return { authorized: true, scope: 'admin', userRole: orgRole };
    }

    // DEPARTMENT HEAD / MANAGER: Department-scoped authority
    if (
      ['director', 'senior_manager', 'manager'].includes(orgRole) &&
      project.department_id &&
      userOrg.department_id &&
      project.department_id === userOrg.department_id
    ) {
      return { authorized: true, scope: 'department', userRole: orgRole };
    }

    // 5. PROJECT MEMBER: Check project_members table
    const { data: projectMember } = await supabase
      .from('project_members')
      .select('role, is_active')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!projectMember) {
      return {
        authorized: false,
        reason: 'User is not assigned to this project and lacks manage-all permissions',
        scope: 'denied',
      };
    }

    // Project Managers / Leads have project-level management
    if (['owner', 'manager', 'lead'].includes(projectMember.role)) {
      return { authorized: true, scope: 'member', userRole: projectMember.role };
    }

    // 6. RESOURCE-LEVEL ASSIGNMENT CHECK (e.g. Employee updating assigned task)
    if (resourceType === 'task' && resourceId && action === 'task.update') {
      const { data: task } = await supabase
        .from('tasks')
        .select('assignee_id, created_by')
        .eq('id', resourceId)
        .maybeSingle();

      if (task) {
        if (task.assignee_id === userId || task.created_by === userId) {
          return { authorized: true, scope: 'member', userRole: projectMember.role };
        }
        return {
          authorized: false,
          reason: 'Employee is assigned to project but not assigned to this specific task',
          scope: 'denied',
        };
      }
    }

    // Member read access allowed
    if (
      action === 'project.view' ||
      action === 'task.view' ||
      action === 'milestone.view' ||
      action === 'deliverable.view'
    ) {
      return { authorized: true, scope: 'member', userRole: projectMember.role };
    }

    return { authorized: true, scope: 'member', userRole: projectMember.role };
  }
}
