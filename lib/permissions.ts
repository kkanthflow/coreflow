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
export function hasPermission(
  role: string | undefined | null,
  permission: AppPermission
): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

// Check if role can send messages in org channels (not for freelancers)
export function canAccessOrgChat(role: string | undefined | null): boolean {
  if (!role) return false;
  return role !== 'freelancer';
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
