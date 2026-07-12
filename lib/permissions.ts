// ============================================================
// CoreFlow Permission-Based Access Control (PBAC)
// All feature gates MUST use hasPermission() — never role names
// ============================================================

export type AppPermission =
  // Organization Management
  | 'manage_organization'
  | 'manage_departments'
  | 'manage_roles'
  | 'invite_users'
  | 'remove_users'
  // Project Management
  | 'create_projects'
  | 'assign_projects'
  | 'manage_projects'
  | 'view_projects'
  // Task Management
  | 'create_tasks'
  | 'assign_tasks'
  | 'manage_tasks'
  // File Management
  | 'upload_files'
  | 'download_files'
  // Communication
  | 'send_messages'
  | 'manage_chat'
  // Invoicing
  | 'create_invoices'
  | 'approve_invoices'
  // Reporting
  | 'view_reports'
  | 'export_reports'
  | 'view_audit_logs'
  // Legacy (kept for existing invoice/meeting screens)
  | 'schedule_meetings'
  | 'view_team_directory'
  | 'view_invoices'
  | 'edit_invoices'
  | 'delete_invoices'
  | 'record_payments'
  | 'manage_clients'
  | 'manage_bill_references'
  | 'generate_invoice_pdfs'
  | 'manage_test_accounts';

export type UserRole =
  | 'owner'
  | 'administrator'
  | 'director'
  | 'senior_manager'
  | 'manager'
  | 'team_lead'
  | 'senior_employee'
  | 'employee'
  | 'intern'
  | 'freelancer'
  // Legacy roles (kept for backward compat during migration)
  | 'managing_director'
  | 'ceo'
  | 'cto'
  | 'project_manager'
  | 'hr'
  | 'developer'
  | 'general_member';

// ─────────────────────────────────────────────────────────────────────
// PBAC Permission Matrix
// Every feature gate derives from this table — never from role names
// ─────────────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, AppPermission[]> = {

  owner: [
    // Org
    'manage_organization', 'manage_departments', 'manage_roles',
    'invite_users', 'remove_users',
    // Projects
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects',
    // Tasks
    'create_tasks', 'assign_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages', 'manage_chat',
    // Invoicing
    'create_invoices', 'approve_invoices',
    // Reporting
    'view_reports', 'export_reports', 'view_audit_logs',
    // Legacy
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'delete_invoices', 'record_payments',
    'manage_clients', 'manage_bill_references', 'generate_invoice_pdfs',
    'manage_test_accounts', 'manage_roles',
  ],

  administrator: [
    // Org
    'manage_organization', 'manage_departments', 'manage_roles',
    'invite_users', 'remove_users',
    // Projects
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects',
    // Tasks
    'create_tasks', 'assign_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages', 'manage_chat',
    // Invoicing
    'create_invoices', 'approve_invoices',
    // Reporting
    'view_reports', 'export_reports', 'view_audit_logs',
    // Legacy
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'delete_invoices', 'record_payments',
    'manage_clients', 'manage_bill_references', 'generate_invoice_pdfs',
    'manage_roles',
  ],

  director: [
    // Org
    'manage_departments', 'invite_users', 'remove_users',
    // Projects
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects',
    // Tasks
    'create_tasks', 'assign_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages',
    // Invoicing
    'create_invoices', 'approve_invoices',
    // Reporting
    'view_reports', 'export_reports',
    // Legacy
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'delete_invoices', 'record_payments',
    'manage_clients', 'manage_bill_references', 'generate_invoice_pdfs',
  ],

  senior_manager: [
    // Org
    'invite_users',
    // Projects
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects',
    // Tasks
    'create_tasks', 'assign_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages',
    // Invoicing
    'create_invoices',
    // Reporting
    'view_reports',
    // Legacy
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'record_payments', 'manage_clients',
    'manage_bill_references', 'generate_invoice_pdfs',
  ],

  manager: [
    // Org
    'invite_users',
    // Projects
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects',
    // Tasks
    'create_tasks', 'assign_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages',
    // Invoicing
    'create_invoices',
    // Reporting
    'view_reports',
    // Legacy
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'record_payments', 'manage_clients',
    'manage_bill_references', 'generate_invoice_pdfs',
  ],

  team_lead: [
    // Projects
    'manage_projects', 'view_projects',
    // Tasks
    'create_tasks', 'assign_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages',
    // Legacy
    'schedule_meetings', 'view_team_directory',
  ],

  senior_employee: [
    // Projects
    'view_projects',
    // Tasks
    'create_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages',
    // Legacy
    'schedule_meetings', 'view_team_directory',
  ],

  employee: [
    // Projects
    'view_projects',
    // Tasks
    'create_tasks', 'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages',
    // Legacy
    'schedule_meetings', 'view_team_directory',
  ],

  intern: [
    // Projects
    'view_projects',
    // Tasks
    'manage_tasks',
    // Files
    'upload_files', 'download_files',
    // Communication
    'send_messages',
    // Legacy
    'schedule_meetings', 'view_team_directory',
  ],

  // Freelancer — project-scoped only, no org chat
  freelancer: [
    // Projects (assigned only — enforced by DB RLS)
    'view_projects',
    // Tasks (own only)
    'manage_tasks',
    // Files (project-scoped)
    'upload_files', 'download_files',
    // Meetings
    'schedule_meetings',
    // NO send_messages org-wide — project chat only via channel membership
    // Legacy invoice (they may submit invoices)
    'view_invoices', 'create_invoices', 'edit_invoices',
    'record_payments', 'manage_clients', 'manage_bill_references',
    'generate_invoice_pdfs',
  ],

  // ── Legacy role aliases (redirect to new equivalents) ──
  managing_director: [],  // migrated → owner
  ceo: [],               // migrated → owner
  cto: [],               // migrated → owner
  project_manager: [],   // migrated → manager
  hr: [],                // migrated → administrator
  developer: [],         // migrated → employee
  general_member: [],    // migrated → employee
};

// Fill legacy aliases with their new role permissions
ROLE_PERMISSIONS.managing_director = ROLE_PERMISSIONS.owner;
ROLE_PERMISSIONS.ceo               = ROLE_PERMISSIONS.owner;
ROLE_PERMISSIONS.cto               = ROLE_PERMISSIONS.owner;
ROLE_PERMISSIONS.project_manager   = ROLE_PERMISSIONS.manager;
ROLE_PERMISSIONS.hr                = ROLE_PERMISSIONS.administrator;
ROLE_PERMISSIONS.developer         = ROLE_PERMISSIONS.employee;
ROLE_PERMISSIONS.general_member    = ROLE_PERMISSIONS.employee;

// ─────────────────────────────────────────────────────────────────────
// Core permission check — always use this, never compare role strings
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// Strongly-typed Workspace Permissions (Enterprise RBAC)
// ─────────────────────────────────────────────────────────────────────
export type WorkspacePermission =
  | "organization.view"
  | "organization.edit"
  | "department.view"
  | "department.manage"
  | "project.view"
  | "project.create"
  | "project.manage"
  | "invoice.view"
  | "invoice.create"
  | "invoice.manage"
  | "client.view"
  | "client.manage"
  | "chat.view"
  | "chat.send"
  | "audit.view";

const ROLE_WORKSPACE_PERMISSIONS: Record<string, WorkspacePermission[]> = {
  owner: [
    "organization.view", "organization.edit", "department.view", "department.manage",
    "project.view", "project.create", "project.manage", "invoice.view", "invoice.create", "invoice.manage",
    "client.view", "client.manage", "chat.view", "chat.send", "audit.view"
  ],
  administrator: [
    "organization.view", "organization.edit", "department.view", "department.manage",
    "project.view", "project.create", "project.manage", "invoice.view", "invoice.create", "invoice.manage",
    "client.view", "client.manage", "chat.view", "chat.send", "audit.view"
  ],
  manager: [
    "organization.view", "department.view",
    "project.view", "project.create", "project.manage", "invoice.view", "invoice.create", "invoice.manage",
    "client.view", "client.manage", "chat.view", "chat.send"
  ],
  employee: [
    "organization.view", "department.view",
    "project.view", "chat.view", "chat.send"
  ],
  freelancer: [
    "project.view", "chat.view", "chat.send", "invoice.view", "invoice.create"
  ]
};

// Resolve legacy aliases
ROLE_WORKSPACE_PERMISSIONS.managing_director = ROLE_WORKSPACE_PERMISSIONS.owner;
ROLE_WORKSPACE_PERMISSIONS.ceo               = ROLE_WORKSPACE_PERMISSIONS.owner;
ROLE_WORKSPACE_PERMISSIONS.cto               = ROLE_WORKSPACE_PERMISSIONS.owner;
ROLE_WORKSPACE_PERMISSIONS.project_manager   = ROLE_WORKSPACE_PERMISSIONS.manager;
ROLE_WORKSPACE_PERMISSIONS.hr                = ROLE_WORKSPACE_PERMISSIONS.administrator;
ROLE_WORKSPACE_PERMISSIONS.developer         = ROLE_WORKSPACE_PERMISSIONS.employee;
ROLE_WORKSPACE_PERMISSIONS.general_member    = ROLE_WORKSPACE_PERMISSIONS.employee;

export function resolveWorkspacePermissions(
  workspaceType: 'organization' | 'independent' | 'external' | 'guest' | 'archived',
  roles: string[]
): WorkspacePermission[] {
  if (workspaceType === 'archived') return [];
  
  if (workspaceType === 'independent') {
    return [
      "project.view", "project.create", "project.manage",
      "invoice.view", "invoice.create", "invoice.manage",
      "client.view", "client.manage",
      "audit.view"
    ];
  }

  const resolved = new Set<WorkspacePermission>();
  for (const role of roles) {
    const perms = ROLE_WORKSPACE_PERMISSIONS[role.toLowerCase()] || [];
    perms.forEach(p => resolved.add(p));
  }
  return Array.from(resolved);
}

// ─────────────────────────────────────────────────────────────────────
// Core permission check — always use this, never compare role strings
// ─────────────────────────────────────────────────────────────────────
export function hasPermission(
  roleOrUser: string | { role: string; freelancerType?: string } | undefined | null,
  permission: AppPermission | WorkspacePermission,
  freelancerType?: string
): boolean {
  if (!roleOrUser) return false;

  let role = '';
  let fType = freelancerType;

  if (typeof roleOrUser === 'string') {
    role = roleOrUser;
  } else {
    role = roleOrUser.role;
    fType = roleOrUser.freelancerType;
  }

  // Handle new WorkspacePermission strings if passed
  if (typeof permission === 'string' && (permission.includes('.') || ['organization', 'independent'].includes(fType || ''))) {
    const resolvedPerms = resolveWorkspacePermissions(
      (fType === 'organization' ? 'organization' : 'independent') as any,
      [role]
    );
    return resolvedPerms.includes(permission as any);
  }

  if (role === 'freelancer') {
    if (fType === 'independent') {
      const allowedPermissions: AppPermission[] = [
        'view_projects', 'create_projects', 'manage_projects', 'assign_projects',
        'manage_tasks', 'create_tasks', 'assign_tasks',
        'upload_files', 'download_files',
        'view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices', 'record_payments', 'generate_invoice_pdfs',
        'schedule_meetings', 'manage_clients', 'manage_bill_references',
        'view_reports', 'export_reports'
      ];
      return allowedPermissions.includes(permission as AppPermission);
    } else {
      const allowedPermissions: AppPermission[] = [
        'view_projects', 'manage_tasks',
        'upload_files', 'download_files',
        'schedule_meetings',
        'view_invoices', 'create_invoices', 'edit_invoices', 'generate_invoice_pdfs',
        'send_messages'
      ];
      return allowedPermissions.includes(permission as AppPermission);
    }
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission as AppPermission);
}

// Check if role can send messages in org channels (not for independent freelancers)
export function canAccessOrgChat(roleOrUser: string | { role: string; freelancerType?: string } | undefined | null): boolean {
  if (!roleOrUser) return false;
  if (typeof roleOrUser === 'string') {
    return roleOrUser !== 'freelancer';
  }
  if (roleOrUser.role === 'freelancer') {
    return roleOrUser.freelancerType === 'organization';
  }
  return roleOrUser.role !== 'freelancer';
}

// Role hierarchy level — higher = more authority
const ROLE_LEVEL: Record<string, number> = {
  owner: 9,
  administrator: 8,
  director: 7,
  senior_manager: 6,
  manager: 5,
  team_lead: 4,
  senior_employee: 3,
  employee: 2,
  intern: 1,
  freelancer: 0,
  // Legacy aliases
  managing_director: 9,
  ceo: 9,
  cto: 9,
  project_manager: 5,
  hr: 8,
  developer: 2,
  general_member: 2,
};

export function getRoleLevel(role: string | undefined | null): number {
  if (!role) return 0;
  return ROLE_LEVEL[role] ?? 0;
}

export function isHigherRole(
  roleA: string | undefined | null,
  roleB: string | undefined | null
): boolean {
  return getRoleLevel(roleA) > getRoleLevel(roleB);
}
