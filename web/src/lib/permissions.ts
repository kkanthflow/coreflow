// ============================================================
// AUVRYN Enterprise Job Roles & RBAC (Role-Based Access Control)
// All feature gates MUST use hasPermission() — never raw role names
// ============================================================

export type AppPermission =
  // Organization Management
  | 'manage_organization'
  | 'manage_departments'
  | 'manage_roles'
  | 'invite_users'
  | 'remove_users'
  | 'organization.view'
  | 'organization.update'
  | 'organization.manage_settings'
  | 'organization.delete'
  // Members and Invitations
  | 'members.view'
  | 'members.invite'
  | 'members.update'
  | 'members.remove'
  | 'members.assign_roles'
  // Departments and Teams
  | 'departments.view'
  | 'departments.create'
  | 'departments.update'
  | 'departments.archive'
  | 'teams.manage'
  // Roles and Permissions
  | 'roles.view'
  | 'roles.create'
  | 'roles.update'
  | 'roles.assign'
  | 'roles.delete'
  | 'permissions.manage'
  // Project Management
  | 'create_projects'
  | 'assign_projects'
  | 'manage_projects'
  | 'view_projects'
  | 'view_all_projects'
  | 'manage_all_projects'
  | 'projects.view'
  | 'projects.create'
  | 'projects.update'
  | 'projects.delete'
  // Task Management
  | 'create_tasks'
  | 'assign_tasks'
  | 'manage_tasks'
  | 'tasks.view'
  | 'tasks.create'
  | 'tasks.update'
  | 'tasks.assign'
  | 'tasks.delete'
  // Workflow Automation
  | 'workflows.view'
  | 'workflows.create'
  | 'workflows.update'
  | 'workflows.execute'
  | 'workflows.manage'
  // File Management
  | 'upload_files'
  | 'download_files'
  | 'files.view'
  | 'files.upload'
  | 'files.update'
  | 'files.download'
  | 'files.share'
  | 'files.delete'
  // Client Management
  | 'manage_clients'
  | 'clients.view'
  | 'clients.create'
  | 'clients.update'
  | 'clients.archive'
  // Invoicing & Finance
  | 'view_invoices'
  | 'create_invoices'
  | 'edit_invoices'
  | 'delete_invoices'
  | 'approve_invoices'
  | 'record_payments'
  | 'generate_invoice_pdfs'
  | 'manage_bill_references'
  | 'invoices.view'
  | 'invoices.create'
  | 'invoices.update'
  | 'invoices.approve'
  | 'invoices.download'
  | 'billing.manage'
  // Communication
  | 'send_messages'
  | 'manage_chat'
  | 'chat.view'
  | 'chat.send'
  | 'chat.manage'
  | 'schedule_meetings'
  | 'meetings.view'
  | 'meetings.create'
  | 'meetings.manage'
  | 'meetings.participate'
  // Reporting & Security
  | 'view_reports'
  | 'export_reports'
  | 'view_audit_logs'
  | 'reports.view'
  | 'reports.export'
  | 'audit_logs.view'
  | 'security.manage'
  | 'integrations.manage'
  // Legacy
  | 'view_team_directory'
  | 'manage_test_accounts';

export type UserRole =
  | 'owner'
  | 'administrator'
  | 'manager'
  | 'team_lead'
  | 'team_member'
  | 'guest'
  | 'client'
  // Backward compatibility alias
  | 'employee'
  | string;

export type PermissionScope =
  | 'organization'
  | 'department'
  | 'team'
  | 'project'
  | 'own'
  | 'assigned'
  | 'shared';

export interface PermissionDefinition {
  id: AppPermission;
  name: string;
  description: string;
  allowedScopes: PermissionScope[];
}

export interface PermissionModule {
  category: string;
  description: string;
  permissions: PermissionDefinition[];
}

// ─────────────────────────────────────────────────────────────────────
// 16 Enterprise Departments Catalogue
// ─────────────────────────────────────────────────────────────────────
export const ENTERPRISE_DEPARTMENTS = [
  { id: 'exec', name: 'Executive Leadership', color: '#8B5CF6', description: 'Executive strategy, governance and company-wide direction.' },
  { id: 'eng', name: 'Software Engineering & Development', color: '#3B82F6', description: 'Core applications, services, APIs and system engineering.' },
  { id: 'sec', name: 'Cybersecurity & Information Security', color: '#EF4444', description: 'Security monitoring, compliance audits, threat detection and data integrity.' },
  { id: 'devops', name: 'DevOps, Cloud & Infrastructure', color: '#06B6D4', description: 'Cloud architecture, site reliability, CI/CD and infrastructure.' },
  { id: 'qa', name: 'Quality Assurance & Testing', color: '#10B981', description: 'Test automation, quality benchmarks and release verification.' },
  { id: 'prod', name: 'Product Management & Design', color: '#F59E0B', description: 'Product roadmaps, UX/UI design systems, and discovery.' },
  { id: 'data', name: 'Data, Analytics & Artificial Intelligence', color: '#EC4899', description: 'Data pipelines, analytics telemetry, machine learning and AI.' },
  { id: 'pm', name: 'Project & Program Management', color: '#6366F1', description: 'Agile sprints, milestone delivery and cross-team execution.' },
  { id: 'fin', name: 'Finance & Accounting', color: '#14B8A6', description: 'Financial reporting, ledger accounting, invoicing and tax.' },
  { id: 'hr', name: 'Human Resources & People Operations', color: '#F97316', description: 'Talent recruitment, employee relations and workforce culture.' },
  { id: 'sales', name: 'Sales & Business Development', color: '#84CC16', description: 'Enterprise customer acquisition, client partnerships and sales quotas.' },
  { id: 'mktg', name: 'Marketing & Communications', color: '#D946EF', description: 'Brand strategy, content marketing, public relations and growth.' },
  { id: 'support', name: 'Customer Support & Professional Services', color: '#0284C7', description: 'Customer tickets, client onboarding and SLA satisfaction.' },
  { id: 'legal', name: 'Legal, Compliance & Risk', color: '#64748B', description: 'Commercial contracts, corporate regulations, data privacy and risk.' },
  { id: 'it', name: 'Administration & Internal IT', color: '#78716C', description: 'Internal IT systems, developer hardware and office operations.' },
  { id: 'rnd', name: 'Research & Development', color: '#A855F7', description: 'Exploratory technology prototyping and forward-looking research.' },
];

// ─────────────────────────────────────────────────────────────────────
// 10 Career Levels Definition
// ─────────────────────────────────────────────────────────────────────
export const CAREER_LEVELS = [
  { level: 'L1', name: 'Intern / Trainee', tier: 'Intern', description: 'Entry learning tier assisting team members with guided tasks.' },
  { level: 'L2', name: 'Entry-Level / Associate', tier: 'Associate', description: 'Foundational professional building core features under supervision.' },
  { level: 'L3', name: 'Professional', tier: 'Professional', description: 'Independent contributor delivering key objectives autonomously.' },
  { level: 'L4', name: 'Senior Professional', tier: 'Senior', description: 'Advanced specialist solving complex problems and mentoring team members.' },
  { level: 'L5', name: 'Lead / Staff / Principal', tier: 'Lead / Staff', description: 'Technical authority guiding architecture, standards and squads.' },
  { level: 'L6', name: 'Manager', tier: 'Management', description: 'People and project manager overseeing execution and team health.' },
  { level: 'L7', name: 'Senior Manager', tier: 'Senior Management', description: 'Multi-team leader managing strategic projects and operations.' },
  { level: 'L8', name: 'Director', tier: 'Director', description: 'Department leader establishing operational goals and resource allocation.' },
  { level: 'L9', name: 'Vice President', tier: 'VP / Executive', description: 'Division executive directing cross-departmental roadmaps.' },
  { level: 'L10', name: 'Executive', tier: 'C-Suite', description: 'Chief executive officer steering overall enterprise governance.' },
];

// ─────────────────────────────────────────────────────────────────────
// Granular Permission Matrix Modules (by Resource & Action)
// ─────────────────────────────────────────────────────────────────────
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    category: 'Organisation Management',
    description: 'Control organisation profile, legal details, and workspace lifecycle.',
    permissions: [
      { id: 'organization.view', name: 'View Organisation', description: 'Access organization profile and workspace metadata.', allowedScopes: ['organization'] },
      { id: 'organization.update', name: 'Update Organisation', description: 'Modify organization name, currency, and company profile.', allowedScopes: ['organization'] },
      { id: 'organization.manage_settings', name: 'Manage Settings', description: 'Configure workspace-wide security, privacy and domain options.', allowedScopes: ['organization'] },
      { id: 'organization.delete', name: 'Delete Organisation', description: 'Permanently archive or delete the organization workspace.', allowedScopes: ['organization'] },
    ],
  },
  {
    category: 'Members & Invitations',
    description: 'Manage workforce directory, invitations, join requests and role assignments.',
    permissions: [
      { id: 'members.view', name: 'View Members', description: 'View list of team members, profiles, and directory.', allowedScopes: ['organization', 'department'] },
      { id: 'members.invite', name: 'Invite Members', description: 'Invite new employees and send invitation links.', allowedScopes: ['organization', 'department'] },
      { id: 'members.update', name: 'Update Member Profiles', description: 'Edit member departments, job titles, and details.', allowedScopes: ['organization', 'department'] },
      { id: 'members.remove', name: 'Remove Members', description: 'Remove members or revoke workspace memberships.', allowedScopes: ['organization', 'department'] },
      { id: 'members.assign_roles', name: 'Assign Roles', description: 'Change application roles, custom roles, and security tiers.', allowedScopes: ['organization'] },
    ],
  },
  {
    category: 'Departments & Teams',
    description: 'Organise workforce into business units, functional squads and departments.',
    permissions: [
      { id: 'departments.view', name: 'View Departments', description: 'View department structure and member counts.', allowedScopes: ['organization', 'department'] },
      { id: 'departments.create', name: 'Create Department', description: 'Add new business departments and functional units.', allowedScopes: ['organization'] },
      { id: 'departments.update', name: 'Update Department', description: 'Modify department name, color, and department head.', allowedScopes: ['organization', 'department'] },
      { id: 'departments.archive', name: 'Archive Department', description: 'Archive or deactivate existing departments.', allowedScopes: ['organization'] },
      { id: 'teams.manage', name: 'Manage Teams', description: 'Organise project squads and team lead assignments.', allowedScopes: ['organization', 'department'] },
    ],
  },
  {
    category: 'Roles & Permissions',
    description: 'Custom role authoring, granular privilege assignment and RBAC policies.',
    permissions: [
      { id: 'roles.view', name: 'View Roles', description: 'Inspect built-in and custom organization roles.', allowedScopes: ['organization'] },
      { id: 'roles.create', name: 'Create Custom Roles', description: 'Create new custom roles with selected permissions.', allowedScopes: ['organization'] },
      { id: 'roles.update', name: 'Update Roles', description: 'Modify permission matrix and scopes of custom roles.', allowedScopes: ['organization'] },
      { id: 'roles.assign', name: 'Assign Roles', description: 'Grant custom or built-in roles to organization members.', allowedScopes: ['organization'] },
      { id: 'roles.delete', name: 'Delete Custom Roles', description: 'Delete custom roles with automatic member fallback.', allowedScopes: ['organization'] },
      { id: 'permissions.manage', name: 'Manage Privileges', description: 'Configure granular policy overrides and PBAC rules.', allowedScopes: ['organization'] },
    ],
  },
  {
    category: 'Projects & Tasks',
    description: 'Delivery management, milestones, task assignments and issue tracking.',
    permissions: [
      { id: 'projects.view', name: 'View Projects', description: 'View projects within authorised scope.', allowedScopes: ['organization', 'department', 'team', 'assigned', 'shared'] },
      { id: 'projects.create', name: 'Create Projects', description: 'Initiate new projects, rooms and milestones.', allowedScopes: ['organization', 'department'] },
      { id: 'projects.update', name: 'Update Projects', description: 'Edit project scope, status, dates, and settings.', allowedScopes: ['organization', 'department', 'assigned'] },
      { id: 'projects.delete', name: 'Delete Projects', description: 'Archive or permanently remove project workspaces.', allowedScopes: ['organization'] },
      { id: 'tasks.view', name: 'View Tasks', description: 'View task lists, Kanban boards, and backlogs.', allowedScopes: ['organization', 'department', 'team', 'assigned', 'own'] },
      { id: 'tasks.create', name: 'Create Tasks', description: 'Create new actionable tasks and subtasks.', allowedScopes: ['organization', 'department', 'team', 'assigned'] },
      { id: 'tasks.update', name: 'Update Tasks', description: 'Update task progress, status, priority, and descriptions.', allowedScopes: ['organization', 'department', 'team', 'assigned', 'own'] },
      { id: 'tasks.assign', name: 'Assign Tasks', description: 'Assign tasks to other team members and squads.', allowedScopes: ['organization', 'department', 'team'] },
      { id: 'tasks.delete', name: 'Delete Tasks', description: 'Delete completed or cancelled tasks.', allowedScopes: ['organization', 'department', 'team'] },
    ],
  },
  {
    category: 'Workflow Automation',
    description: 'Rule-based automations, triggers, actions, and approval gates.',
    permissions: [
      { id: 'workflows.view', name: 'View Workflows', description: 'Inspect automated pipelines and execution history.', allowedScopes: ['organization', 'department'] },
      { id: 'workflows.create', name: 'Create Workflows', description: 'Construct new event triggers and automation rules.', allowedScopes: ['organization', 'department'] },
      { id: 'workflows.update', name: 'Update Workflows', description: 'Modify conditions, actions, and pipeline steps.', allowedScopes: ['organization', 'department'] },
      { id: 'workflows.execute', name: 'Execute Workflows', description: 'Trigger manual or scheduled automation runs.', allowedScopes: ['organization', 'department', 'assigned'] },
      { id: 'workflows.manage', name: 'Manage Approvals', description: 'Approve or reject pending human-in-the-loop steps.', allowedScopes: ['organization', 'department'] },
    ],
  },
  {
    category: 'Clients & CRM',
    description: 'Client directory, customer portal provisioning, and engagement records.',
    permissions: [
      { id: 'clients.view', name: 'View Clients', description: 'View customer accounts, company contacts and details.', allowedScopes: ['organization', 'assigned'] },
      { id: 'clients.create', name: 'Create Client', description: 'Register new clients and configure portal access.', allowedScopes: ['organization'] },
      { id: 'clients.update', name: 'Update Client', description: 'Edit client details, GSTIN, contacts and address.', allowedScopes: ['organization', 'assigned'] },
      { id: 'clients.archive', name: 'Archive Client', description: 'Deactivate client portal or archive client records.', allowedScopes: ['organization'] },
    ],
  },
  {
    category: 'Invoices & Finance',
    description: 'Billing lifecycle, GST invoices, payment proofs, and ledger reconciliation.',
    permissions: [
      { id: 'invoices.view', name: 'View Invoices', description: 'View financial invoices, balances and payment status.', allowedScopes: ['organization', 'department', 'own', 'shared'] },
      { id: 'invoices.create', name: 'Create Invoice', description: 'Draft and generate new GST / commercial invoices.', allowedScopes: ['organization', 'department', 'own'] },
      { id: 'invoices.update', name: 'Update Invoice', description: 'Modify invoice items, discounts, and issued dates.', allowedScopes: ['organization', 'department', 'own'] },
      { id: 'invoices.approve', name: 'Approve Invoice', description: 'Approve draft invoices before issuing to clients.', allowedScopes: ['organization'] },
      { id: 'invoices.download', name: 'Download Invoice', description: 'Export and download official PDF invoice documents.', allowedScopes: ['organization', 'department', 'own', 'shared'] },
      { id: 'billing.manage', name: 'Manage Subscription & Plans', description: 'Manage platform subscription plan, payments, and seats.', allowedScopes: ['organization'] },
    ],
  },
  {
    category: 'Files & Documents',
    description: 'Storage assets, project attachments, and client document sharing.',
    permissions: [
      { id: 'files.view', name: 'View Files', description: 'Browse uploaded documents and project assets.', allowedScopes: ['organization', 'department', 'project', 'shared'] },
      { id: 'files.upload', name: 'Upload Files', description: 'Upload attachments, project assets and deliverables.', allowedScopes: ['organization', 'department', 'project'] },
      { id: 'files.update', name: 'Update Files', description: 'Rename, replace, or modify file metadata.', allowedScopes: ['organization', 'project', 'own'] },
      { id: 'files.download', name: 'Download Files', description: 'Download documents and project deliverables.', allowedScopes: ['organization', 'department', 'project', 'shared'] },
      { id: 'files.share', name: 'Share Files', description: 'Generate secure download links or share with clients.', allowedScopes: ['organization', 'project'] },
      { id: 'files.delete', name: 'Delete Files', description: 'Permanently remove files from organization storage.', allowedScopes: ['organization', 'project', 'own'] },
    ],
  },
  {
    category: 'Chat & Meetings',
    description: 'Real-time messaging, group channels, direct messages, and HD video conferences.',
    permissions: [
      { id: 'chat.view', name: 'View Chat', description: 'Access organization channels and direct conversations.', allowedScopes: ['organization', 'department', 'shared'] },
      { id: 'chat.send', name: 'Send Messages', description: 'Send encrypted text messages, code snippets and media.', allowedScopes: ['organization', 'department', 'shared'] },
      { id: 'chat.manage', name: 'Manage Channels', description: 'Create, archive, and manage organization channels.', allowedScopes: ['organization'] },
      { id: 'meetings.view', name: 'View Meetings', description: 'See scheduled video conferences and calendars.', allowedScopes: ['organization', 'department', 'shared'] },
      { id: 'meetings.create', name: 'Schedule Meetings', description: 'Host new meetings, invite participants and generate links.', allowedScopes: ['organization', 'department'] },
      { id: 'meetings.manage', name: 'Manage Meetings', description: 'Admit participants from waiting room, record sessions.', allowedScopes: ['organization', 'department'] },
    ],
  },
  {
    category: 'Reports & Security',
    description: 'Executive dashboards, audit logs, compliance events, and security logs.',
    permissions: [
      { id: 'reports.view', name: 'View Reports', description: 'Access analytics dashboards and telemetry summaries.', allowedScopes: ['organization', 'department'] },
      { id: 'reports.export', name: 'Export Reports', description: 'Export analytical and financial summaries to CSV.', allowedScopes: ['organization', 'department'] },
      { id: 'audit_logs.view', name: 'View Audit Logs', description: 'Inspect timestamped records of all sensitive operations.', allowedScopes: ['organization'] },
      { id: 'security.manage', name: 'Security Governance', description: 'Configure active session policy, single-tab locks and 2FA.', allowedScopes: ['organization'] },
      { id: 'integrations.manage', name: 'Manage Integrations', description: 'Configure Resend, Razorpay, Webhooks and Slack keys.', allowedScopes: ['organization'] },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// PBAC Permission Matrix
// ─────────────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, AppPermission[]> = {
  owner: [
    'manage_organization', 'manage_departments', 'manage_roles',
    'invite_users', 'remove_users',
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects', 'view_all_projects', 'manage_all_projects',
    'create_tasks', 'assign_tasks', 'manage_tasks',
    'upload_files', 'download_files',
    'send_messages', 'manage_chat',
    'create_invoices', 'approve_invoices',
    'view_reports', 'export_reports', 'view_audit_logs',
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'delete_invoices', 'record_payments',
    'manage_clients', 'manage_bill_references', 'generate_invoice_pdfs',
    'manage_test_accounts',
    'organization.view', 'organization.update', 'organization.manage_settings', 'organization.delete',
    'members.view', 'members.invite', 'members.update', 'members.remove', 'members.assign_roles',
    'departments.view', 'departments.create', 'departments.update', 'departments.archive', 'teams.manage',
    'roles.view', 'roles.create', 'roles.update', 'roles.assign', 'roles.delete', 'permissions.manage',
    'projects.view', 'projects.create', 'projects.update', 'projects.delete',
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.delete',
    'workflows.view', 'workflows.create', 'workflows.update', 'workflows.execute', 'workflows.manage',
    'clients.view', 'clients.create', 'clients.update', 'clients.archive',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.approve', 'invoices.download', 'billing.manage',
    'files.view', 'files.upload', 'files.update', 'files.download', 'files.share', 'files.delete',
    'chat.view', 'chat.send', 'chat.manage',
    'meetings.view', 'meetings.create', 'meetings.manage',
    'reports.view', 'reports.export',
    'audit_logs.view', 'security.manage', 'integrations.manage'
  ],

  administrator: [
    'manage_organization', 'manage_departments', 'manage_roles',
    'invite_users', 'remove_users',
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects', 'view_all_projects', 'manage_all_projects',
    'create_tasks', 'assign_tasks', 'manage_tasks',
    'upload_files', 'download_files',
    'send_messages', 'manage_chat',
    'create_invoices', 'approve_invoices',
    'view_reports', 'export_reports', 'view_audit_logs',
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'delete_invoices', 'record_payments',
    'manage_clients', 'manage_bill_references', 'generate_invoice_pdfs',
    'organization.view', 'organization.update', 'organization.manage_settings',
    'members.view', 'members.invite', 'members.update', 'members.remove', 'members.assign_roles',
    'departments.view', 'departments.create', 'departments.update', 'departments.archive', 'teams.manage',
    'roles.view', 'roles.create', 'roles.update', 'roles.assign',
    'projects.view', 'projects.create', 'projects.update', 'projects.delete',
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.delete',
    'workflows.view', 'workflows.create', 'workflows.update', 'workflows.execute', 'workflows.manage',
    'clients.view', 'clients.create', 'clients.update',
    'invoices.view', 'invoices.create', 'invoices.update', 'invoices.approve', 'invoices.download',
    'files.view', 'files.upload', 'files.update', 'files.download', 'files.share', 'files.delete',
    'chat.view', 'chat.send', 'chat.manage',
    'meetings.view', 'meetings.create', 'meetings.manage',
    'reports.view', 'reports.export',
    'audit_logs.view', 'security.manage'
  ],



  manager: [
    'invite_users',
    'create_projects', 'assign_projects', 'manage_projects', 'view_projects',
    'create_tasks', 'assign_tasks', 'manage_tasks',
    'upload_files', 'download_files',
    'send_messages',
    'create_invoices',
    'view_reports',
    'schedule_meetings', 'view_team_directory', 'view_invoices',
    'edit_invoices', 'record_payments', 'manage_clients',
    'manage_bill_references', 'generate_invoice_pdfs',
    'organization.view', 'members.view', 'members.invite', 'departments.view',
    'projects.view', 'projects.create', 'projects.update',
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign',
    'invoices.view', 'invoices.create', 'invoices.download',
    'files.view', 'files.upload', 'files.download',
    'chat.view', 'chat.send', 'meetings.view', 'meetings.create', 'reports.view'
  ],

  team_lead: [
    'manage_projects', 'view_projects',
    'create_tasks', 'assign_tasks', 'manage_tasks',
    'upload_files', 'download_files',
    'send_messages',
    'schedule_meetings', 'view_team_directory',
    'organization.view', 'members.view', 'departments.view',
    'projects.view', 'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign',
    'workflows.view', 'workflows.execute',
    'files.view', 'files.upload', 'files.download',
    'chat.view', 'chat.send', 'meetings.view', 'meetings.create'
  ],



  team_member: [
    'view_projects',
    'create_tasks', 'manage_tasks',
    'upload_files', 'download_files',
    'send_messages',
    'schedule_meetings', 'view_team_directory',
    'organization.view', 'members.view',
    'projects.view', 'projects.create',
    'tasks.view', 'tasks.create', 'tasks.update',
    'workflows.view', 'workflows.execute',
    'files.view', 'files.upload', 'files.download',
    'chat.view', 'chat.send', 'meetings.view', 'meetings.create', 'meetings.participate'
  ],

  employee: [
    'view_projects',
    'create_tasks', 'manage_tasks',
    'upload_files', 'download_files',
    'send_messages',
    'schedule_meetings', 'view_team_directory',
    'organization.view', 'members.view',
    'projects.view', 'projects.create',
    'tasks.view', 'tasks.create', 'tasks.update',
    'workflows.view', 'workflows.execute',
    'files.view', 'files.upload', 'files.download',
    'chat.view', 'chat.send', 'meetings.view', 'meetings.create', 'meetings.participate'
  ],

  guest: [
    'projects.view', 'tasks.view', 'files.view', 'files.download',
    'chat.view', 'chat.send', 'meetings.participate',
    'view_projects', 'download_files', 'send_messages'
  ],

  client: [
    'view_projects',
    'view_invoices',
    'download_files',
    'send_messages',
    'projects.view', 'invoices.view', 'invoices.download',
    'files.view', 'files.download', 'chat.view', 'chat.send',
    'meetings.participate'
  ],
};

// ─────────────────────────────────────────────────────────────────────
// Canonical alias resolver
// ─────────────────────────────────────────────────────────────────────
const PERMISSION_ALIASES: Record<string, string> = {
  'manage_organization': 'organization.update',
  'organization.update': 'manage_organization',
  'view_projects': 'projects.view',
  'projects.view': 'view_projects',
  'create_projects': 'projects.create',
  'projects.create': 'create_projects',
  'manage_projects': 'projects.update',
  'projects.update': 'manage_projects',
  'manage_all_projects': 'projects.delete',
  'projects.delete': 'manage_all_projects',
  'create_tasks': 'tasks.create',
  'tasks.create': 'create_tasks',
  'manage_tasks': 'tasks.update',
  'tasks.update': 'manage_tasks',
  'assign_tasks': 'tasks.assign',
  'tasks.assign': 'assign_tasks',
  'upload_files': 'files.upload',
  'files.upload': 'upload_files',
  'download_files': 'files.download',
  'files.download': 'download_files',
  'view_invoices': 'invoices.view',
  'invoices.view': 'view_invoices',
  'create_invoices': 'invoices.create',
  'invoices.create': 'create_invoices',
  'edit_invoices': 'invoices.update',
  'invoices.update': 'edit_invoices',
  'approve_invoices': 'invoices.approve',
  'invoices.approve': 'approve_invoices',
  'delete_invoices': 'invoices.delete',
  'send_messages': 'chat.send',
  'chat.send': 'send_messages',
  'manage_chat': 'chat.manage',
  'chat.manage': 'manage_chat',
  'schedule_meetings': 'meetings.create',
  'meetings.create': 'schedule_meetings',
  'view_team_directory': 'members.view',
  'members.view': 'view_team_directory',
  'invite_users': 'members.invite',
  'members.invite': 'invite_users',
  'remove_users': 'members.remove',
  'members.remove': 'remove_users',
  'manage_roles': 'roles.create',
  'roles.create': 'manage_roles',
  'manage_departments': 'departments.update',
  'departments.update': 'manage_departments',
  'view_reports': 'reports.view',
  'reports.view': 'view_reports',
  'export_reports': 'reports.export',
  'reports.export': 'export_reports',
  'view_audit_logs': 'audit_logs.view',
  'audit_logs.view': 'view_audit_logs',
  'manage_clients': 'clients.update',
  'clients.update': 'manage_clients',
};

export function hasPermission(
  roleOrUser: string | { role: string; freelancerType?: string; customPermissions?: string[] } | undefined | null,
  permission: AppPermission | string,
  freelancerType?: string
): boolean {
  if (!roleOrUser) return false;

  let role = '';
  let fType = freelancerType;
  let customPerms: string[] | undefined = undefined;

  if (typeof roleOrUser === 'string') {
    role = roleOrUser.toLowerCase();
  } else {
    role = (roleOrUser.role || '').toLowerCase();
    fType = roleOrUser.freelancerType;
    customPerms = roleOrUser.customPermissions;
  }

  // Organization owner always has all permissions
  if (role === 'owner') return true;

  const alias = PERMISSION_ALIASES[permission];

  // 1. Check custom permissions if provided
  if (customPerms && Array.isArray(customPerms)) {
    if (customPerms.includes(permission) || (alias && customPerms.includes(alias))) {
      return true;
    }
  }

  // 2. Freelancer specific checks
  if (role === 'freelancer') {
    if (fType === 'independent') {
      const allowed: string[] = [
        'view_projects', 'create_projects', 'manage_projects', 'assign_projects',
        'projects.view', 'projects.create', 'projects.update',
        'manage_tasks', 'create_tasks', 'assign_tasks', 'tasks.view', 'tasks.create', 'tasks.update',
        'upload_files', 'download_files', 'files.view', 'files.upload', 'files.download',
        'view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices', 'record_payments', 'generate_invoice_pdfs',
        'invoices.view', 'invoices.create', 'invoices.update', 'invoices.download',
        'schedule_meetings', 'meetings.view', 'meetings.create',
        'manage_clients', 'clients.view', 'clients.create', 'clients.update',
        'manage_bill_references',
        'view_reports', 'export_reports', 'reports.view', 'reports.export'
      ];
      return allowed.includes(permission) || (alias ? allowed.includes(alias) : false);
    } else {
      const allowed: string[] = [
        'view_projects', 'projects.view', 'manage_tasks', 'tasks.view', 'tasks.update',
        'upload_files', 'download_files', 'files.upload', 'files.download',
        'schedule_meetings', 'meetings.view', 'meetings.create',
        'view_invoices', 'create_invoices', 'edit_invoices', 'generate_invoice_pdfs',
        'invoices.view', 'invoices.create', 'invoices.update',
        'send_messages', 'chat.view', 'chat.send'
      ];
      return allowed.includes(permission) || (alias ? allowed.includes(alias) : false);
    }
  }

  // 3. Built-in role permissions lookup
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  return (
    permissions.includes(permission as AppPermission) ||
    (alias ? permissions.includes(alias as AppPermission) : false)
  );
}

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

const ROLE_LEVEL: Record<string, number> = {
  owner: 7,
  administrator: 6,
  manager: 5,
  team_lead: 4,
  team_member: 3,
  employee: 3,
  guest: 2,
  client: 1,
};

export function getRoleLevel(role: string | undefined | null): number {
  if (!role) return 0;
  return ROLE_LEVEL[role.toLowerCase()] ?? 0;
}

export function isHigherRole(
  roleA: string | undefined | null,
  roleB: string | undefined | null
): boolean {
  return getRoleLevel(roleA) > getRoleLevel(roleB);
}

export type ProjectAccessScopeType = 'all' | 'department' | 'assigned' | 'own';

export interface ProjectScopeContext {
  userId: string;
  role: string | null;
  departmentId?: string | null;
  isOwner?: boolean;
}

export function resolveProjectScope(ctx: ProjectScopeContext): ProjectAccessScopeType {
  const { role, isOwner } = ctx;
  const cleanRole = (role || '').toLowerCase();
  if (isOwner || cleanRole === 'owner' || cleanRole === 'administrator') {
    return 'all';
  }
  if (cleanRole === 'manager') {
    return ctx.departmentId ? 'department' : 'all';
  }
  return 'assigned';
}

// Keep legacy export for backward compatibility
export type WorkspacePermission = AppPermission;
