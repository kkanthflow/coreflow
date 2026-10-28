// ==============================================================================
// AUVRYN — Unified Professional Job Titles & Access Roles Architecture
// Job titles reflect professional roles; RBAC access roles govern system permissions.
// ==============================================================================

export interface JobTitleCategory {
  category: string;
  titles: string[];
}

export const PROFESSIONAL_JOB_TITLES: JobTitleCategory[] = [
  {
    category: 'Leadership and Business',
    titles: [
      'Founder',
      'Co-founder',
      'Business Partner',
      'Chief Executive Officer (CEO)',
      'Managing Director (MD)',
      'Chief Technology Officer (CTO)',
      'Chief Financial Officer (CFO)',
      'Chief Operating Officer (COO)',
      'Chief Marketing Officer (CMO)',
      'Chief Security Officer (CSO)',
    ],
  },
  {
    category: 'Technology and Product',
    titles: [
      'Software Engineer',
      'Frontend Developer',
      'Backend Developer',
      'Full-Stack Developer',
      'Mobile App Developer',
      'QA Engineer',
      'DevOps Engineer',
      'Cybersecurity Engineer',
      'Security Analyst',
      'UI/UX Designer',
      'Product Manager',
      'Data Analyst',
      'IT Support Specialist',
    ],
  },
  {
    category: 'Business Operations',
    titles: [
      'Finance Executive',
      'HR Executive',
      'Sales Executive',
      'Marketing Executive',
      'Business Development Executive',
      'Customer Support Executive',
      'Project Coordinator',
      'Operations Executive',
      'Intern',
      'Trainee',
      'Custom Job Title',
    ],
  },
];

export const ALL_JOB_TITLES_FLAT = PROFESSIONAL_JOB_TITLES.flatMap(c => c.titles);

export interface AccessRoleOption {
  value: string;
  label: string;
  description: string;
}

export const ACCESS_ROLES: AccessRoleOption[] = [
  { value: 'owner', label: 'Organisation Owner', description: 'Full system ownership and billing governance' },
  { value: 'administrator', label: 'Organisation Administrator', description: 'Comprehensive workforce and workspace administration' },
  { value: 'manager', label: 'Manager', description: 'Project management and team delivery coordination' },
  { value: 'team_member', label: 'Team Member', description: 'Hands-on project execution, tasks, files and chat access' },
  { value: 'guest', label: 'Guest / External Collaborator', description: 'Scoped access to assigned deliverables and discussions' },
  { value: 'client', label: 'Client', description: 'Portal access to view and approve deliverables and invoices' },
  { value: 'custom', label: 'Custom Access Role', description: 'Custom policy-configured permission set' },
];

export const ASSIGNABLE_ACCESS_ROLES: AccessRoleOption[] = [
  { value: 'administrator', label: 'Organisation Administrator', description: 'Comprehensive workforce and workspace administration' },
  { value: 'manager', label: 'Manager', description: 'Project management and team delivery coordination' },
  { value: 'team_member', label: 'Team Member', description: 'Hands-on project execution, tasks, files and chat access' },
  { value: 'guest', label: 'Guest / External Collaborator', description: 'Scoped access to assigned deliverables and discussions' },
  { value: 'client', label: 'Client', description: 'Portal access to view and approve deliverables and invoices' },
];

export function formatAccessRole(role?: string | null): string {
  if (!role) return 'Team Member';
  const match = ACCESS_ROLES.find(r => r.value === role.toLowerCase());
  if (match) return match.label;
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
