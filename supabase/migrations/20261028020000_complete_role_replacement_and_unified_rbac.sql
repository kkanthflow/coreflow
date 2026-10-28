-- ==============================================================================
-- AUVRYN — Master Migration: Complete Role Replacement, Job Titles & Unified RBAC
-- Migration: 20261028020000_complete_role_replacement_and_unified_rbac.sql
--
-- Objective:
-- 1. Replace legacy 21 role sprawl in public.roles with 7 clean built-in application access roles:
--    - Organisation Owner (owner)
--    - Organisation Administrator (administrator)
--    - Manager (manager)
--    - Team Lead (team_lead)
--    - Team Member (team_member)
--    - Guest / External Collaborator (guest)
--    - Client (client)
--    - Custom Role support via public.organization_roles
-- 2. Decouple Job Titles from Application Access Roles:
--    - Professional titles (CEO, Founder, Software Engineer, etc.) do NOT grant application permissions.
--    - Permissions and resource scopes govern access, enabling founders/executives to perform hands-on work.
-- 3. Comprehensive Job Titles Catalogue (Executive, Management, Tech, Product, Business, Custom)
--    - Extensible, searchable, zero department dependencies.
-- 4. Safe migration of existing memberships and user records.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: ENUM SAFETY & EXTENSIONS
-- (Note: If running in Supabase SQL Editor on a fresh database, run these two ALTER lines
--  first and press Run, then execute the remainder of the script below).
-- ------------------------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'team_member';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'guest';

-- ------------------------------------------------------------------------------
-- PART 2: CORE TABLES CREATION & EXTENSIONS
-- ------------------------------------------------------------------------------

-- Custom organization roles table
CREATE TABLE IF NOT EXISTS public.organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope_limits jsonb NOT NULL DEFAULT '{"projects": "organization", "tasks": "organization"}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_roles_org_key UNIQUE (org_id, role_key)
);

CREATE INDEX IF NOT EXISTS idx_organization_roles_org_id ON public.organization_roles(org_id);
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

-- Job titles catalogue table (Decoupled, zero department dependencies)
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  functional_category text DEFAULT 'General',
  department_name text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  career_level text NOT NULL DEFAULT 'L3' CHECK (career_level IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10')),
  career_level_name text NOT NULL DEFAULT 'Professional',
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure department_name is optional and functional_category exists
ALTER TABLE public.job_titles ALTER COLUMN department_name DROP NOT NULL;
ALTER TABLE public.job_titles ADD COLUMN IF NOT EXISTS functional_category text DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_job_titles_org_id ON public.job_titles(org_id);
CREATE INDEX IF NOT EXISTS idx_job_titles_title ON public.job_titles(title);
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

-- Extend user_organizations with professional job title and role attributes
ALTER TABLE public.user_organizations
ADD COLUMN IF NOT EXISTS job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS career_level text DEFAULT 'L3',
ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.organization_roles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scope_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- PART 3: UNIFIED BUILT-IN APPLICATION ACCESS ROLES TABLE
-- ------------------------------------------------------------------------------

-- Purge obsolete legacy roles from public.roles (preserving clean architecture)
DELETE FROM public.roles
WHERE role_name IN (
  'managing_director', 'ceo', 'cto', 'admin', 'director', 'senior_manager',
  'project_manager', 'hr', 'senior_employee', 'intern', 'developer',
  'general_member', 'department_head', 'freelancer'
);

-- Upsert the official 7 built-in application access roles with Least Privilege permissions
INSERT INTO public.roles (role_name, permissions, created_at)
VALUES 
  -- 1. Organisation Owner (All capabilities + ownership transfer)
  ('owner', '[
    "organization.view", "organization.update", "organization.manage_settings", "organization.delete", "ownership.transfer",
    "members.view", "members.invite", "members.update", "members.remove", "members.assign_roles",
    "roles.view", "roles.create", "roles.update", "roles.assign", "roles.delete", "roles.manage", "permissions.manage",
    "projects.view", "projects.create", "projects.update", "projects.delete", "projects.manage",
    "tasks.view", "tasks.create", "tasks.update", "tasks.assign", "tasks.delete",
    "workflows.view", "workflows.create", "workflows.update", "workflows.execute", "workflows.manage",
    "clients.view", "clients.create", "clients.update", "clients.archive", "clients.manage",
    "invoices.view", "invoices.create", "invoices.update", "invoices.approve", "invoices.delete", "invoices.download", "billing.manage", "billing.view",
    "files.view", "files.upload", "files.update", "files.download", "files.share", "files.delete",
    "chat.view", "chat.send", "chat.manage",
    "meetings.view", "meetings.create", "meetings.manage", "meetings.participate",
    "reports.view", "reports.export",
    "audit_logs.view", "security.manage", "integrations.manage",
    "manage_organization", "invite_users", "remove_users", "manage_roles",
    "view_projects", "create_projects", "manage_projects", "manage_all_projects",
    "create_tasks", "manage_tasks", "assign_tasks", "view_invoices", "create_invoices",
    "edit_invoices", "approve_invoices", "delete_invoices", "upload_files", "download_files",
    "send_messages", "schedule_meetings", "view_reports", "export_reports", "view_audit_logs",
    "view_team_directory", "manage_clients"
  ]'::jsonb, now()),

  -- 2. Organisation Administrator (Administrative control; no ownership transfer or owner deletion)
  ('administrator', '[
    "organization.view", "organization.update", "organization.manage_settings",
    "members.view", "members.invite", "members.update", "members.remove", "members.assign_roles",
    "roles.view", "roles.create", "roles.update", "roles.assign", "roles.manage",
    "projects.view", "projects.create", "projects.update", "projects.delete", "projects.manage",
    "tasks.view", "tasks.create", "tasks.update", "tasks.assign", "tasks.delete",
    "workflows.view", "workflows.create", "workflows.update", "workflows.execute", "workflows.manage",
    "clients.view", "clients.create", "clients.update", "clients.manage",
    "invoices.view", "invoices.create", "invoices.update", "invoices.approve", "invoices.download",
    "files.view", "files.upload", "files.update", "files.download", "files.share", "files.delete",
    "chat.view", "chat.send", "chat.manage",
    "meetings.view", "meetings.create", "meetings.manage", "meetings.participate",
    "reports.view", "reports.export",
    "audit_logs.view", "security.manage",
    "manage_organization", "invite_users", "remove_users", "manage_roles",
    "view_projects", "create_projects", "manage_projects", "manage_all_projects",
    "create_tasks", "manage_tasks", "assign_tasks", "view_invoices", "create_invoices",
    "edit_invoices", "approve_invoices", "upload_files", "download_files",
    "send_messages", "schedule_meetings", "view_reports", "export_reports", "view_audit_logs",
    "view_team_directory", "manage_clients"
  ]'::jsonb, now()),

  -- 3. Manager (Operational team, project, and workflow delivery management)
  ('manager', '[
    "organization.view",
    "members.view", "members.invite", "members.update",
    "projects.view", "projects.create", "projects.update", "projects.manage",
    "tasks.view", "tasks.create", "tasks.update", "tasks.assign", "tasks.delete",
    "workflows.view", "workflows.create", "workflows.update", "workflows.execute",
    "clients.view", "clients.create", "clients.update",
    "invoices.view", "invoices.create", "invoices.update", "invoices.download",
    "files.view", "files.upload", "files.update", "files.download", "files.share", "files.delete",
    "chat.view", "chat.send", "chat.manage",
    "meetings.view", "meetings.create", "meetings.manage", "meetings.participate",
    "reports.view", "reports.export",
    "invite_users", "view_projects", "create_projects", "manage_projects",
    "create_tasks", "manage_tasks", "assign_tasks", "view_invoices", "create_invoices",
    "edit_invoices", "upload_files", "download_files", "send_messages", "schedule_meetings",
    "view_team_directory", "manage_clients"
  ]'::jsonb, now()),

  -- 4. Team Lead (Technical / project leadership and task coordination)
  ('team_lead', '[
    "organization.view",
    "members.view",
    "projects.view", "projects.create", "projects.update",
    "tasks.view", "tasks.create", "tasks.update", "tasks.assign",
    "workflows.view", "workflows.execute",
    "files.view", "files.upload", "files.download", "files.share",
    "chat.view", "chat.send",
    "meetings.view", "meetings.create", "meetings.participate",
    "view_projects", "create_projects", "manage_projects",
    "create_tasks", "manage_tasks", "assign_tasks", "upload_files", "download_files",
    "send_messages", "schedule_meetings", "view_team_directory"
  ]'::jsonb, now()),

  -- 5. Team Member (Standard hands-on contributor; can build, code, create tasks, participate)
  ('team_member', '[
    "organization.view",
    "members.view",
    "projects.view", "projects.create",
    "tasks.view", "tasks.create", "tasks.update",
    "workflows.view", "workflows.execute",
    "files.view", "files.upload", "files.download",
    "chat.view", "chat.send",
    "meetings.view", "meetings.create", "meetings.participate",
    "view_projects", "create_projects", "create_tasks", "manage_tasks",
    "upload_files", "download_files", "send_messages", "schedule_meetings",
    "view_team_directory"
  ]'::jsonb, now()),

  -- 6. Guest / External Collaborator (Scoped to assigned resources)
  ('guest', '[
    "projects.view", "tasks.view", "files.view", "files.download",
    "chat.view", "chat.send", "meetings.participate",
    "view_projects", "download_files", "send_messages"
  ]'::jsonb, now()),

  -- 7. Client (Scoped to client portal, authorized projects & invoices)
  ('client', '[
    "projects.view", "invoices.view", "invoices.download",
    "files.view", "files.download", "chat.view", "chat.send",
    "meetings.participate",
    "view_projects", "view_invoices", "download_files", "send_messages"
  ]'::jsonb, now()),

  -- Fallback alias for backward-compatible employee queries
  ('employee', '[
    "organization.view", "members.view", "projects.view", "projects.create",
    "tasks.view", "tasks.create", "tasks.update", "workflows.view", "workflows.execute",
    "files.view", "files.upload", "files.download", "chat.view", "chat.send",
    "meetings.view", "meetings.create", "meetings.participate", "view_projects",
    "create_projects", "create_tasks", "manage_tasks", "upload_files", "download_files",
    "send_messages", "schedule_meetings", "view_team_directory"
  ]'::jsonb, now())
ON CONFLICT (role_name) DO UPDATE SET
  permissions = EXCLUDED.permissions;

-- ------------------------------------------------------------------------------
-- PART 4: COMPREHENSIVE GLOBAL JOB TITLES CATALOGUE (120+ TITLES ACROSS L1 - L10)
-- ------------------------------------------------------------------------------

INSERT INTO public.job_titles (
  id, org_id, title, functional_category, department_name, description, career_level, career_level_name, is_active, is_system
)
SELECT * FROM (VALUES
  (gen_random_uuid(), NULL::uuid, 'Business Partner', 'Executive Leadership', 'Executive Leadership', 'Strategic and commercial business partner.', 'L9', 'Vice President', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Information Security Officer (CISO)', 'Cybersecurity & Information Security', 'Cybersecurity & Information Security', 'Formulates enterprise security posture, risk policies, and regulatory compliance.', 'L9', 'Vice President', true, true),
  (gen_random_uuid(), NULL::uuid, 'Executive Director', 'Executive Leadership', 'Executive Leadership', 'Senior Executive Director.', 'L9', 'Vice President', true, true),
  (gen_random_uuid(), NULL::uuid, 'Managing Director', 'Executive Leadership', 'Executive Leadership', 'Oversees enterprise divisions and operational execution.', 'L9', 'Vice President', true, true),
  (gen_random_uuid(), NULL::uuid, 'Vice President', 'Executive Leadership', 'Executive Leadership', 'Vice President leading functional business division.', 'L9', 'Vice President', true, true),
  (gen_random_uuid(), NULL::uuid, 'Director', 'Executive Leadership', 'Executive Leadership', 'Organizational or functional Director.', 'L8', 'Senior Director', true, true),
  (gen_random_uuid(), NULL::uuid, 'Director of People Operations', 'Human Resources & People Operations', 'Human Resources & People Operations', 'Formulates talent retention strategies, compensation bands, and HR policies.', 'L8', 'Director', true, true),
  (gen_random_uuid(), NULL::uuid, 'Finance Director', 'Finance & Accounting', 'Finance & Accounting', 'Guides enterprise financial strategy, fiscal forecasting, and audit reports.', 'L8', 'Director', true, true),
  (gen_random_uuid(), NULL::uuid, 'General Manager', 'Executive Leadership', 'Executive Leadership', 'General Manager overseeing business operations.', 'L8', 'Senior Director', true, true),
  (gen_random_uuid(), NULL::uuid, 'Delivery Manager', 'Management & Delivery', 'Management & Delivery', 'Ensures quality and timely software delivery.', 'L7', 'Director', true, true),
  (gen_random_uuid(), NULL::uuid, 'Financial Controller', 'Finance & Accounting', 'Finance & Accounting', 'Directs accounting practices, financial controls, and risk governance.', 'L7', 'Senior Manager', true, true),
  (gen_random_uuid(), NULL::uuid, 'Program Manager', 'Management & Delivery', 'Management & Delivery', 'Oversees strategic initiatives across programs.', 'L7', 'Director', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Manager', 'Management & Delivery', 'Management & Delivery', 'Senior functional manager.', 'L7', 'Director', true, true),
  (gen_random_uuid(), NULL::uuid, 'HR Manager', 'Human Resources', 'Human Resources', 'Manages HR operations and personnel policies.', 'L6', 'Principal / Staff', true, true),
  (gen_random_uuid(), NULL::uuid, 'Human Resources Manager', 'Human Resources & People Operations', 'Human Resources & People Operations', 'Leads people operations, organizational culture, conflict resolution, and performance.', 'L6', 'Manager', true, true),
  (gen_random_uuid(), NULL::uuid, 'Manager', 'Management & Delivery', 'Management & Delivery', 'Operational and team manager.', 'L6', 'Principal / Staff', true, true),
  (gen_random_uuid(), NULL::uuid, 'Operations Manager', 'Management & Delivery', 'Management & Delivery', 'Manages day-to-day organizational operations.', 'L6', 'Principal / Staff', true, true),
  (gen_random_uuid(), NULL::uuid, 'Product Manager', 'Management & Delivery', 'Management & Delivery', 'Drives product vision and execution.', 'L6', 'Principal / Staff', true, true),
  (gen_random_uuid(), NULL::uuid, 'Project Manager', 'Management & Delivery', 'Management & Delivery', 'Manages project lifecycle and deliverables.', 'L6', 'Principal / Staff', true, true),
  (gen_random_uuid(), NULL::uuid, 'Research Scientist', 'Data & AI', 'Data & AI', 'Conducts advanced algorithmic and AI research.', 'L6', 'Principal / Staff', true, true),
  (gen_random_uuid(), NULL::uuid, 'Sales Manager', 'Sales & Business Development', 'Sales & Business Development', 'Coaches sales representatives and drives revenue quota attainment.', 'L6', 'Manager', true, true),
  (gen_random_uuid(), NULL::uuid, 'Technical Lead', 'Management & Delivery', 'Management & Delivery', 'Guides architectural and technical execution.', 'L6', 'Principal / Staff', true, true),
  (gen_random_uuid(), NULL::uuid, 'AI/ML Engineer', 'Data & AI', 'Data & AI', 'Implements AI and deep learning architectures.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'Cloud Solutions Architect', 'DevOps, Cloud & Infrastructure', 'DevOps, Cloud & Infrastructure', 'Designs resilient multi-cloud architectures across AWS, GCP, and Supabase.', 'L5', 'Lead / Staff / Principal', true, true),
  (gen_random_uuid(), NULL::uuid, 'Consultant', 'Professional Services', 'Professional Services', 'Provides specialized domain and advisory services.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'Customer Success Manager', 'Customer Success', 'Customer Success', 'Manages client satisfaction and account renewals.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'Data Scientist', 'Data & AI', 'Data & AI', 'Applies statistical and machine learning models.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'Growth Marketing Lead', 'Marketing & Communications', 'Marketing & Communications', 'Optimizes conversion funnels, product analytics, and customer acquisition CAC.', 'L5', 'Lead / Staff / Principal', true, true),
  (gen_random_uuid(), NULL::uuid, 'Lead Software Engineer', 'Software Engineering & Development', 'Software Engineering & Development', 'Guides engineering squads, establishes design patterns, and oversees delivery.', 'L5', 'Lead / Staff / Principal', true, true),
  (gen_random_uuid(), NULL::uuid, 'Platform Engineer', 'Software & Technology', 'Software & Technology', 'Builds foundational developer platforms.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'Principal R&D Engineer', 'Research & Development', 'Research & Development', 'Pioneers state-of-the-art technological breakthroughs and patent filings.', 'L5', 'Lead / Staff / Principal', true, true),
  (gen_random_uuid(), NULL::uuid, 'Principal Software Architect', 'Software Engineering & Development', 'Software Engineering & Development', 'Defines company-wide system architecture, reliability, and technical strategy.', 'L5', 'Lead / Staff / Principal', true, true),
  (gen_random_uuid(), NULL::uuid, 'Product Owner', 'Management & Delivery', 'Management & Delivery', 'Owns agile backlog and feature definition.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'Project Lead', 'Management & Delivery', 'Management & Delivery', 'Coordinates project delivery milestones.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'Quality Assurance Lead', 'Quality Assurance & Testing', 'Quality Assurance & Testing', 'Manages QA team release verification, test strategies, and quality benchmarks.', 'L5', 'Lead / Staff / Principal', true, true),
  (gen_random_uuid(), NULL::uuid, 'Team Lead', 'Management & Delivery', 'Management & Delivery', 'Leads team execution and technical delivery.', 'L5', 'Lead', true, true),
  (gen_random_uuid(), NULL::uuid, 'AI / Machine Learning Engineer', 'Data, Analytics & Artificial Intelligence', 'Data, Analytics & Artificial Intelligence', 'Integrates large language models, neural embeddings, and intelligent agents.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Automation Test Engineer', 'Software & Technology', 'Software & Technology', 'Develops automated test suites and frameworks.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Business Analyst', 'Management & Delivery', 'Management & Delivery', 'Analyzes operational requirements and specifications.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Cloud Engineer', 'Software & Technology', 'Software & Technology', 'Designs cloud architectures and services.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Corporate Legal Counsel', 'Legal, Compliance & Risk', 'Legal, Compliance & Risk', 'Drafts contracts, intellectual property safeguards, and vendor agreements.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Cybersecurity Analyst', 'Software & Technology', 'Software & Technology', 'Protects systems from vulnerabilities and threats.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Data Engineer', 'Data & AI', 'Data & AI', 'Builds data pipelines and data warehouse schemas.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Data Privacy & Compliance Officer', 'Legal, Compliance & Risk', 'Legal, Compliance & Risk', 'Oversees GDPR, SOC 2, HIPAA, and data protection regulations.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'DevOps Engineer', 'Software & Technology', 'Software & Technology', 'Automates CI/CD and infrastructure pipelines.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Digital Marketing Specialist', 'Sales & Marketing', 'Sales & Marketing', 'Optimizes digital ads and online presence.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Finance Analyst', 'Finance & Business', 'Finance & Business', 'Models financial plans and capital allocations.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Penetration Tester', 'Software & Technology', 'Software & Technology', 'Assesses software security via simulated attacks.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Penetration Tester / Ethical Hacker', 'Cybersecurity & Information Security', 'Cybersecurity & Information Security', 'Conducts red-team assessments, code penetration tests, and vulnerability reporting.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Product Designer', 'Product & Design', 'Product & Design', 'Designs end-to-end product experiences.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Professional Services Consultant', 'Customer Support & Professional Services', 'Customer Support & Professional Services', 'Delivers bespoke implementation, training, and system migrations.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Security Engineer', 'Software & Technology', 'Software & Technology', 'Implements technical security and encryption controls.', 'L4', 'Senior', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Accountant', 'Finance & Accounting', 'Finance & Accounting', 'Manages general ledgers, corporate audits, balance sheets, and tax filings.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Data Scientist', 'Data, Analytics & Artificial Intelligence', 'Data, Analytics & Artificial Intelligence', 'Develops predictive statistical models, regression frameworks, and data mining.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior DevOps Engineer', 'DevOps, Cloud & Infrastructure', 'DevOps, Cloud & Infrastructure', 'Architects continuous delivery pipelines, infrastructure-as-code, and secrets management.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Frontend Developer', 'Software Engineering & Development', 'Software Engineering & Development', 'Leads client-side architecture, WebSockets, and state management.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Product Designer', 'Product Management & Design', 'Product Management & Design', 'Directs enterprise design systems, accessible UI patterns, and user experience.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Product Manager', 'Product Management & Design', 'Product Management & Design', 'Drives strategic product domains and cross-functional feature rollouts.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior QA Automation Engineer', 'Quality Assurance & Testing', 'Quality Assurance & Testing', 'Builds automated test suites using Playwright, Jest, and CI integration.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Security Analyst', 'Cybersecurity & Information Security', 'Cybersecurity & Information Security', 'Coordinates incident response, vulnerability management, and perimeter audits.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Senior Software Engineer', 'Software Engineering & Development', 'Software Engineering & Development', 'Architects scalable modules, reviews code, and solves complex technical challenges.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Site Reliability Engineer (SRE)', 'DevOps, Cloud & Infrastructure', 'DevOps, Cloud & Infrastructure', 'Ensures 99.99% system availability, telemetry monitoring, and disaster recovery.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Solutions Architect', 'Sales & Business Development', 'Sales & Business Development', 'Partners with sales to architect technical solutions and custom demonstrations.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Technical Program Manager (TPM)', 'Project & Program Management', 'Project & Program Management', 'Orchestrates complex multi-team initiatives across engineering organizations.', 'L4', 'Senior Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Account Executive', 'Sales & Business Development', 'Sales & Business Development', 'Closes enterprise subscription deals and negotiates business terms.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Accountant', 'Finance & Business', 'Finance & Business', 'Manages corporate accounting and financial reporting.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Android Developer', 'Software & Technology', 'Software & Technology', 'Builds native Android mobile applications.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Backend Developer', 'Software Engineering & Development', 'Software Engineering & Development', 'Implements microservices, relational databases, caching, and server APIs.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Business Development Executive', 'Sales & Marketing', 'Sales & Marketing', 'Drives corporate partnerships and expansions.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Content Strategist & Copywriter', 'Marketing & Communications', 'Marketing & Communications', 'Authors case studies, technical documentation, newsletters, and blog posts.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Data Analyst', 'Data, Analytics & Artificial Intelligence', 'Data, Analytics & Artificial Intelligence', 'Extracts metrics, builds dashboards, and identifies operational insights.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Frontend Developer', 'Software & Technology', 'Software & Technology', 'Builds responsive user interfaces and web applications.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Full-Stack Developer', 'Software Engineering & Development', 'Software Engineering & Development', 'Develops end-to-end features spanning React web clients and Node.js backend services.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'HR Executive', 'Human Resources', 'Human Resources', 'Handles recruitment and employee relations.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Information Security Specialist', 'Cybersecurity & Information Security', 'Cybersecurity & Information Security', 'Configures identity and access management, encryption, and zero-trust controls.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'iOS Developer', 'Software & Technology', 'Software & Technology', 'Builds native iOS mobile applications.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Marketing Executive', 'Sales & Marketing', 'Sales & Marketing', 'Plans and executes promotional marketing campaigns.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Marketing Specialist', 'Marketing & Communications', 'Marketing & Communications', 'Executes marketing campaigns, promotional events, and digital outreach.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Mobile App Developer', 'Software & Technology', 'Software & Technology', 'Develops cross-platform and mobile applications.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Other / Custom Job Title', 'General Operations', 'General Operations', 'Custom professional title.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'QA Engineer', 'Quality Assurance & Testing', 'Quality Assurance & Testing', 'Performs functional and regression testing to maintain software quality.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Recruiter', 'Human Resources', 'Human Resources', 'Sources and hires professional talent.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Researcher', 'Professional Services', 'Professional Services', 'Gathers and analyzes industry and competitive data.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Sales Executive', 'Sales & Marketing', 'Sales & Marketing', 'Engages potential clients and generates revenue.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Scrum Master / Agile Coach', 'Project & Program Management', 'Project & Program Management', 'Facilitates sprint planning, retrospectives, and agile development velocity.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Security Analyst', 'Cybersecurity & Information Security', 'Cybersecurity & Information Security', 'Monitors security logs, evaluates attack vectors, and prevents data breaches.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Software Developer', 'Software & Technology', 'Software & Technology', 'Implements software features and solutions.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Software Engineer', 'Software Engineering & Development', 'Software Engineering & Development', 'Designs, codes, and delivers high-performance web and backend services.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'System Administrator', 'Software & Technology', 'Software & Technology', 'Maintains corporate infrastructure and systems.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Systems Administrator', 'Administration & Internal IT', 'Administration & Internal IT', 'Maintains corporate network, Single Sign-On (SSO), and office infrastructure.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Talent Acquisition Recruiter', 'Human Resources & People Operations', 'Human Resources & People Operations', 'Sources, interviews, and hires top engineering and business professionals.', 'L3', 'Professional', true, true),
  (gen_random_uuid(), NULL::uuid, 'Test Analyst', 'Software & Technology', 'Software & Technology', 'Analyzes quality metrics and test coverage.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'UI/UX Designer', 'Product & Design', 'Product & Design', 'Designs intuitive interfaces and user experiences.', 'L3', 'Mid-Level', true, true),
  (gen_random_uuid(), NULL::uuid, 'Associate Product Manager', 'Product Management & Design', 'Product Management & Design', 'Assists in defining product features, user stories, and acceptance criteria.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Associate Software Engineer', 'Software Engineering & Development', 'Software Engineering & Development', 'Builds and maintains features under senior engineering guidance.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Business Development Representative (BDR)', 'Sales & Business Development', 'Sales & Business Development', 'Identifies qualified prospective enterprise clients and schedules discovery demos.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Content Writer', 'Sales & Marketing', 'Sales & Marketing', 'Writes marketing articles, documentation and copy.', 'L2', 'Junior / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Copywriter', 'Sales & Marketing', 'Sales & Marketing', 'Creates high-converting brand and product copy.', 'L2', 'Junior / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Customer Support Executive', 'Customer Success', 'Customer Success', 'Provides timely assistance and support to clients.', 'L2', 'Junior / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Customer Support Specialist', 'Customer Support & Professional Services', 'Customer Support & Professional Services', 'Provides rapid technical support and ticket resolution for platform users.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Graphic Designer', 'Product & Design', 'Product & Design', 'Creates visual brand assets and illustrations.', 'L2', 'Junior / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'HR Specialist', 'Human Resources & People Operations', 'Human Resources & People Operations', 'Coordinates employee onboarding, leave management, and benefits administration.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'IT Support Engineer', 'Software & Technology', 'Software & Technology', 'Provides technical support and hardware setup.', 'L2', 'Junior / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'IT Support Specialist', 'Administration & Internal IT', 'Administration & Internal IT', 'Configures developer laptops, VPN credentials, and internal IT assets.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Junior Accountant', 'Finance & Accounting', 'Finance & Accounting', 'Reconciles payment entries, bills, and accounts payable.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Project Coordinator', 'Project & Program Management', 'Project & Program Management', 'Tracks milestones, meeting schedules, and resource dependencies.', 'L2', 'Entry-Level / Associate', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Executive Officer (CEO)', 'Executive Leadership', 'Executive Leadership', 'Sets corporate vision, long-term strategy, and leads company operations.', 'L10', 'Executive', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Financial Officer (CFO)', 'Executive Leadership', 'Executive Leadership', 'Manages corporate financial strategy, fiscal compliance, and investments.', 'L10', 'Executive', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Human Resources Officer (CHRO)', 'Executive Leadership', 'Executive Leadership', 'Chief Human Resources Officer leading people operations.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Information Officer (CIO)', 'Executive Leadership', 'Executive Leadership', 'Chief Information Officer overseeing IT infrastructure.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Marketing Officer (CMO)', 'Executive Leadership', 'Executive Leadership', 'Chief Marketing Officer leading market growth.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Operating Officer (COO)', 'Executive Leadership', 'Executive Leadership', 'Drives cross-departmental operations, organizational efficiency, and scale.', 'L10', 'Executive', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Security Officer (CSO)', 'Executive Leadership', 'Executive Leadership', 'Chief Security Officer.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'Chief Technology Officer (CTO)', 'Executive Leadership', 'Executive Leadership', 'Chief Technology Officer leading technical vision.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'Co-founder', 'Executive Leadership', 'Executive Leadership', 'Company Co-founder and foundational partner.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'Founder', 'Executive Leadership', 'Executive Leadership', 'Company Founder and core visionary.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'President', 'Executive Leadership', 'Executive Leadership', 'Corporate President.', 'L10', 'Executive (C-Suite)', true, true),
  (gen_random_uuid(), NULL::uuid, 'Apprentice', 'General Operations', 'General Operations', 'Work-based technical apprentice.', 'L1', 'Entry / Intern', true, true),
  (gen_random_uuid(), NULL::uuid, 'Intern', 'General Operations', 'General Operations', 'Hands-on learning contributor.', 'L1', 'Entry / Intern', true, true),
  (gen_random_uuid(), NULL::uuid, 'Software Engineering Intern', 'Software Engineering & Development', 'Software Engineering & Development', 'Assists software development teams with feature implementation and testing.', 'L1', 'Intern / Trainee', true, true),
  (gen_random_uuid(), NULL::uuid, 'Trainee', 'General Operations', 'General Operations', 'Undergoing professional skills training.', 'L1', 'Entry / Intern', true, true)
) AS v(id, org_id, title, functional_category, department_name, description, career_level, career_level_name, is_active, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_titles jt WHERE jt.title = v.title AND jt.org_id IS NULL
);

-- ------------------------------------------------------------------------------
-- PART 5: MIGRATION OF EXISTING ROLE ASSIGNMENTS
-- ------------------------------------------------------------------------------

-- A. user_organizations migration
-- 1. If user is owner of the organization, role = 'owner'
UPDATE public.user_organizations uo
SET role = 'owner'
FROM public.organizations o
WHERE o.id = uo.org_id AND o.owner_id = uo.user_id AND uo.role != 'owner';

-- 2. Migrate legacy management roles to 'manager' (and preserve professional title)
UPDATE public.user_organizations
SET role = 'manager',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Director')
WHERE role = 'director';

UPDATE public.user_organizations
SET role = 'manager',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Senior Manager')
WHERE role = 'senior_manager';

UPDATE public.user_organizations
SET role = 'manager',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'HR Manager')
WHERE role = 'hr';

-- 3. Migrate legacy admin role to 'administrator'
UPDATE public.user_organizations
SET role = 'administrator'
WHERE role = 'admin';

-- 4. Migrate legacy execution roles to 'team_member'
UPDATE public.user_organizations
SET role = 'team_member',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Software Developer')
WHERE role IN ('developer', 'senior_employee');

UPDATE public.user_organizations
SET role = 'team_member',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Intern')
WHERE role = 'intern';

UPDATE public.user_organizations
SET role = 'team_member'
WHERE role IN ('employee', 'general_member', 'freelancer');

-- B. public.users migration
UPDATE public.users
SET role = 'manager'::public.user_role
WHERE role::text IN ('director', 'senior_manager', 'hr');

UPDATE public.users
SET role = 'team_member'::public.user_role
WHERE role::text IN ('employee', 'senior_employee', 'developer', 'intern', 'general_member');

-- ------------------------------------------------------------------------------
-- PART 6: ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

-- organization_roles policies
DROP POLICY IF EXISTS "Members can view organization roles" ON public.organization_roles;
CREATE POLICY "Members can view organization roles" ON public.organization_roles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = organization_roles.org_id AND uo.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_roles.org_id AND o.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage organization roles" ON public.organization_roles;
CREATE POLICY "Admins can manage organization roles" ON public.organization_roles
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_roles.org_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = organization_roles.org_id 
      AND uo.user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'administrator')
        OR public.has_org_permission(auth.uid(), organization_roles.org_id, 'roles.create')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_roles.org_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = organization_roles.org_id 
      AND uo.user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'administrator')
        OR public.has_org_permission(auth.uid(), organization_roles.org_id, 'roles.create')
      )
  )
);

-- job_titles policies
DROP POLICY IF EXISTS "Anyone can view system or org job titles" ON public.job_titles;
CREATE POLICY "Anyone can view system or org job titles" ON public.job_titles
FOR SELECT TO authenticated
USING (
  org_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = job_titles.org_id AND uo.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = job_titles.org_id AND o.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage custom job titles" ON public.job_titles;
CREATE POLICY "Admins can manage custom job titles" ON public.job_titles
FOR ALL TO authenticated
USING (
  org_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = job_titles.org_id AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = job_titles.org_id 
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'administrator', 'manager')
    )
  )
)
WITH CHECK (
  org_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = job_titles.org_id AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = job_titles.org_id 
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'administrator', 'manager')
    )
  )
);

-- ------------------------------------------------------------------------------
-- PART 7: SECURITY-DEFINER RPC FUNCTIONS
-- ------------------------------------------------------------------------------

-- 1. Centralized permission check function (has_org_permission)
CREATE OR REPLACE FUNCTION public.has_org_permission(
  p_user_id uuid,
  p_org_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_custom_role_id uuid;
  v_has boolean := false;
  v_perm_alt text;
BEGIN
  IF p_user_id IS NULL OR p_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Primary Organization Owner has unconditional permissions
  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Canonical alias resolver (dot vs underscore notation)
  v_perm_alt := CASE 
    WHEN p_permission = 'organization.view' THEN 'manage_organization'
    WHEN p_permission = 'organization.update' THEN 'manage_organization'
    WHEN p_permission = 'members.view' THEN 'view_team_directory'
    WHEN p_permission = 'members.invite' THEN 'invite_users'
    WHEN p_permission = 'members.remove' THEN 'remove_users'
    WHEN p_permission = 'members.assign_roles' THEN 'manage_roles'
    WHEN p_permission = 'roles.view' THEN 'manage_roles'
    WHEN p_permission = 'roles.create' THEN 'manage_roles'
    WHEN p_permission = 'roles.assign' THEN 'manage_roles'
    WHEN p_permission = 'projects.view' THEN 'view_projects'
    WHEN p_permission = 'projects.create' THEN 'create_projects'
    WHEN p_permission = 'projects.update' THEN 'manage_projects'
    WHEN p_permission = 'projects.delete' THEN 'manage_all_projects'
    WHEN p_permission = 'tasks.view' THEN 'manage_tasks'
    WHEN p_permission = 'tasks.create' THEN 'create_tasks'
    WHEN p_permission = 'tasks.update' THEN 'manage_tasks'
    WHEN p_permission = 'tasks.assign' THEN 'assign_tasks'
    WHEN p_permission = 'invoices.view' THEN 'view_invoices'
    WHEN p_permission = 'invoices.create' THEN 'create_invoices'
    WHEN p_permission = 'invoices.update' THEN 'edit_invoices'
    WHEN p_permission = 'invoices.approve' THEN 'approve_invoices'
    WHEN p_permission = 'invoices.delete' THEN 'delete_invoices'
    WHEN p_permission = 'clients.view' THEN 'manage_clients'
    WHEN p_permission = 'clients.create' THEN 'manage_clients'
    WHEN p_permission = 'clients.update' THEN 'manage_clients'
    WHEN p_permission = 'chat.view' THEN 'send_messages'
    WHEN p_permission = 'chat.send' THEN 'send_messages'
    WHEN p_permission = 'chat.manage' THEN 'manage_chat'
    WHEN p_permission = 'meetings.view' THEN 'schedule_meetings'
    WHEN p_permission = 'meetings.create' THEN 'schedule_meetings'
    WHEN p_permission = 'reports.view' THEN 'view_reports'
    WHEN p_permission = 'reports.export' THEN 'export_reports'
    WHEN p_permission = 'audit_logs.view' THEN 'view_audit_logs'
    ELSE NULL
  END;

  -- Check user's role and custom_role in user_organizations
  IF p_org_id IS NOT NULL THEN
    SELECT role, custom_role_id INTO v_role, v_custom_role_id 
    FROM public.user_organizations 
    WHERE org_id = p_org_id AND user_id = p_user_id;

    IF v_role = 'owner' THEN
      RETURN TRUE;
    END IF;

    -- A. Check custom organization role
    IF v_custom_role_id IS NOT NULL THEN
      SELECT (
        (permissions ? p_permission) 
        OR (v_perm_alt IS NOT NULL AND permissions ? v_perm_alt)
      ) INTO v_has
      FROM public.organization_roles
      WHERE id = v_custom_role_id AND org_id = p_org_id AND is_active = true;

      IF COALESCE(v_has, false) = true THEN
        RETURN TRUE;
      END IF;
    END IF;

    -- B. Check built-in role in public.roles
    IF v_role IS NOT NULL THEN
      SELECT (
        (permissions ? p_permission)
        OR (v_perm_alt IS NOT NULL AND permissions ? v_perm_alt)
      ) INTO v_has
      FROM public.roles
      WHERE role_name = v_role;

      IF COALESCE(v_has, false) = true THEN
        RETURN TRUE;
      END IF;

      -- Map legacy 'employee' to 'team_member' permissions
      IF v_role = 'employee' THEN
        SELECT (
          (permissions ? p_permission)
          OR (v_perm_alt IS NOT NULL AND permissions ? v_perm_alt)
        ) INTO v_has
        FROM public.roles
        WHERE role_name = 'team_member';

        IF COALESCE(v_has, false) = true THEN
          RETURN TRUE;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Check explicit individual permission grants in role_permissions table
  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.role_permissions 
    WHERE org_id = p_org_id AND user_id = p_user_id 
      AND (permission = p_permission OR permission = v_perm_alt)
  ) THEN
    RETURN TRUE;
  END IF;

  -- Fallback to global has_permission
  RETURN public.has_permission(p_user_id, p_permission);
END;
$$;

-- 2. Project view scope evaluation (can_view_project)
CREATE OR REPLACE FUNCTION public.can_view_project(
  p_user_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_proj_dept_id uuid;
  v_owner_id uuid;
  v_created_by uuid;
  v_role text;
  v_custom_role_id uuid;
  v_user_dept_id uuid;
  v_project_scope text := 'organization';
BEGIN
  IF p_user_id IS NULL OR p_project_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get project details
  SELECT org_id, department_id, owner_id, created_by
  INTO v_org_id, v_proj_dept_id, v_owner_id, v_created_by
  FROM public.projects WHERE id = p_project_id AND (deleted_at IS NULL);
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Primary organization owner bypass
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id AND owner_id = p_user_id) THEN
    RETURN true;
  END IF;

  -- Project owner or creator has direct access
  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN true;
  END IF;

  -- Explicitly assigned project member
  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id 
      AND pm.user_id = p_user_id 
      AND COALESCE(pm.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  -- Client direct contact with active authorized access
  IF EXISTS (
    SELECT 1 FROM public.project_client_access pca
    WHERE pca.project_id = p_project_id
      AND pca.user_id = p_user_id
      AND pca.status = 'active'
      AND pca.can_view = true
  ) THEN
    RETURN true;
  END IF;

  -- Member organization role
  SELECT role, custom_role_id, COALESCE(scope_department_id, department_id)
  INTO v_role, v_custom_role_id, v_user_dept_id
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Owner / Administrator has organization-wide view
  IF v_role IN ('owner', 'administrator') THEN
    RETURN true;
  END IF;

  -- Custom role scope evaluation
  IF v_custom_role_id IS NOT NULL THEN
    SELECT COALESCE(scope_limits->>'projects', 'organization') INTO v_project_scope
    FROM public.organization_roles WHERE id = v_custom_role_id;

    IF v_project_scope = 'assigned' THEN
      RETURN false;
    END IF;

    IF v_project_scope = 'department' THEN
      RETURN (v_proj_dept_id IS NOT NULL AND v_user_dept_id IS NOT NULL AND v_proj_dept_id = v_user_dept_id);
    END IF;
  END IF;

  -- Guest or Client role: strictly assigned-only
  IF v_role IN ('guest', 'client') THEN
    RETURN false;
  END IF;

  -- Managers / Leads / Members have project view permission if organization-scoped
  RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
END;
$$;

-- 3. Join request submission (submit_join_request)
DROP FUNCTION IF EXISTS public.submit_join_request(uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.submit_join_request(
  p_org_id uuid,
  p_job_title text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_user_full_name text;
  v_org_name text;
  v_existing_mem record;
  v_existing_req record;
  v_req_id uuid;
  v_res jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit join request.' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target organization not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT role INTO v_existing_mem FROM public.user_organizations 
  WHERE org_id = p_org_id AND user_id = v_user_id;
  IF FOUND THEN
    RAISE EXCEPTION 'You are already an active member of %.', v_org_name USING ERRCODE = '23505';
  END IF;

  SELECT email, full_name INTO v_user_email, v_user_full_name FROM public.users WHERE id = v_user_id;
  IF NOT FOUND THEN
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_user_email, v_user_full_name
    FROM auth.users
    WHERE id = v_user_id;

    INSERT INTO public.users (
      id, email, full_name, role, default_workspace_id, account_type, account_setup_completed, current_plan_tier, subscription_status
    ) VALUES (
      v_user_id, v_user_email, COALESCE(v_user_full_name, 'Team Member'), 'team_member', NULL, 'organization', false, 'business_free', 'free'
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT id, status, created_at INTO v_existing_req
  FROM public.organization_join_requests
  WHERE org_id = p_org_id AND user_id = v_user_id AND status = 'pending'
  LIMIT 1;

  IF FOUND THEN
    SELECT jsonb_build_object(
      'success', true,
      'id', v_existing_req.id,
      'request_id', v_existing_req.id,
      'org_id', p_org_id,
      'org_name', v_org_name,
      'status', 'pending',
      'created_at', v_existing_req.created_at,
      'is_duplicate', true,
      'message', 'You already have a pending join request for this organization.'
    ) INTO v_res;
    RETURN v_res;
  END IF;

  INSERT INTO public.organization_join_requests (
    org_id, user_id, full_name, email, job_title, department_id, status
  ) VALUES (
    p_org_id,
    v_user_id,
    COALESCE(v_user_full_name, 'Applicant'),
    v_user_email,
    NULLIF(TRIM(p_job_title), ''),
    p_department_id,
    'pending'
  )
  RETURNING id INTO v_req_id;

  UPDATE public.users
  SET account_type = 'organization',
      account_setup_completed = false
  WHERE id = v_user_id;

  SELECT jsonb_build_object(
    'success', true,
    'id', v_req_id,
    'request_id', v_req_id,
    'org_id', p_org_id,
    'org_name', v_org_name,
    'status', 'pending',
    'created_at', now(),
    'is_duplicate', false,
    'message', 'Join request submitted successfully. Awaiting management review.'
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 4. Join request approval (approve_organization_join_request)
DROP FUNCTION IF EXISTS public.approve_organization_join_request(uuid, text, uuid, text);
CREATE OR REPLACE FUNCTION public.approve_organization_join_request(
  p_request_id uuid,
  p_assigned_role text DEFAULT 'team_member',
  p_department_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role varchar;
  v_req record;
  v_clean_role varchar;
  v_dept_id uuid := NULL;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.organization_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'This join request has already been processed (status: %).', v_req.status USING ERRCODE = '22023';
  END IF;

  IF v_req.user_id = v_caller_id THEN
    RAISE EXCEPTION 'Security violation: Users cannot approve their own join requests.' USING ERRCODE = '42501';
  END IF;

  -- Verify management authority
  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = v_req.org_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR NOT (
    v_caller_role = ANY(ARRAY['owner', 'administrator', 'manager']::varchar[])
    OR public.has_org_permission(v_caller_id, v_req.org_id, 'members.invite')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to approve join requests.' USING ERRCODE = '42501';
  END IF;

  -- Normalize assigned role to clean built-in roles
  v_clean_role := COALESCE(NULLIF(TRIM(p_assigned_role), ''), 'team_member');
  IF v_clean_role = 'employee' THEN
    v_clean_role := 'team_member';
  END IF;

  IF NOT (v_clean_role = ANY(ARRAY['administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client']::varchar[])) THEN
    RAISE EXCEPTION 'Invalid role assignment: %. Must be a valid application access role.', v_clean_role USING ERRCODE = '22023';
  END IF;

  IF v_clean_role = 'administrator' AND v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners can assign administrator roles.' USING ERRCODE = '42501';
  END IF;

  -- Optional department verification
  IF p_department_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.departments WHERE id = p_department_id AND org_id = v_req.org_id AND is_deleted = false) THEN
      v_dept_id := p_department_id;
    END IF;
  END IF;

  -- Insert into user_organizations
  INSERT INTO public.user_organizations (
    user_id, org_id, role, job_title, department_id, joined_at, invited_by
  ) VALUES (
    v_req.user_id,
    v_req.org_id,
    v_clean_role,
    v_req.job_title,
    v_dept_id,
    now(),
    v_caller_id
  )
  ON CONFLICT (user_id, org_id) DO UPDATE SET
    role = EXCLUDED.role,
    job_title = COALESCE(EXCLUDED.job_title, user_organizations.job_title),
    department_id = COALESCE(EXCLUDED.department_id, user_organizations.department_id);

  -- Update public.users profile
  UPDATE public.users
  SET account_type = 'organization',
      role = v_clean_role::public.user_role,
      default_workspace_id = v_req.org_id::text,
      account_setup_completed = true
  WHERE id = v_req.user_id;

  -- Mark request as approved
  UPDATE public.organization_join_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      reviewed_at = now(),
      assigned_role = v_clean_role,
      assigned_department_id = v_dept_id,
      review_notes = p_notes
  WHERE id = p_request_id;

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Successfully approved %s as %s.', COALESCE(v_req.full_name, v_req.email), v_clean_role)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 5. Member assignment RPC (assign_member_job_and_role)
DROP FUNCTION IF EXISTS public.assign_member_job_and_role(uuid, uuid, text, uuid, uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.assign_member_job_and_role(
  p_org_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_custom_role_id uuid DEFAULT NULL,
  p_job_title_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_career_level text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_is_owner boolean := false;
  v_clean_role text;
  v_target_old_role text;
  v_target_email text;
  v_target_name text;
  v_job_title_name text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Anti-self-elevation
  IF v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'Security violation: Users cannot modify their own role or security privileges.' USING ERRCODE = '42501';
  END IF;

  -- Check caller authorization
  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator')
    OR public.has_org_permission(v_caller_id, p_org_id, 'members.assign_roles')
  ) THEN
    RAISE EXCEPTION 'Access denied. You lack permission to manage member roles and assignments.' USING ERRCODE = '42501';
  END IF;

  -- Clean and validate role
  v_clean_role := LOWER(TRIM(p_role));
  IF v_clean_role = 'employee' THEN
    v_clean_role := 'team_member';
  END IF;

  IF NOT (v_clean_role = ANY(ARRAY['owner', 'administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client']::text[])) THEN
    RAISE EXCEPTION 'Invalid role %: Must be an official built-in application access role.', v_clean_role USING ERRCODE = '22023';
  END IF;

  -- Cannot assign owner via member assignment (must use transfer_organization_ownership)
  IF v_clean_role = 'owner' AND NOT COALESCE(v_is_owner, false) THEN
    RAISE EXCEPTION 'Permission denied. Ownership can only be transferred by the primary organization owner.' USING ERRCODE = '42501';
  END IF;

  -- Only owners can assign administrator
  IF v_clean_role = 'administrator' AND NOT (COALESCE(v_is_owner, false) = true OR v_caller_role = 'owner') THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners can grant administrator privileges.' USING ERRCODE = '42501';
  END IF;

  -- Resolve job title text
  IF p_job_title_id IS NOT NULL THEN
    SELECT title INTO v_job_title_name FROM public.job_titles WHERE id = p_job_title_id;
  END IF;

  -- Retrieve old details
  SELECT role INTO v_target_old_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- Update user_organizations
  UPDATE public.user_organizations
  SET role = v_clean_role,
      custom_role_id = p_custom_role_id,
      job_title_id = p_job_title_id,
      job_title = COALESCE(v_job_title_name, job_title),
      career_level = COALESCE(p_career_level, career_level, 'L3'),
      department_id = p_department_id
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- Synchronize public.users profile safely
  UPDATE public.users
  SET role = v_clean_role::public.user_role,
      account_setup_completed = true,
      default_workspace_id = p_org_id::text
  WHERE id = p_target_user_id;

  SELECT email, full_name INTO v_target_email, v_target_name FROM public.users WHERE id = p_target_user_id;

  -- Log action
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'member_job_and_role_assigned', 'user_organizations', p_target_user_id,
    jsonb_build_object('old_role', v_target_old_role),
    jsonb_build_object(
      'new_role', v_clean_role,
      'custom_role_id', p_custom_role_id,
      'job_title', v_job_title_name,
      'career_level', p_career_level,
      'department_id', p_department_id,
      'target_email', v_target_email
    )
  );

  SELECT jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'user_id', p_target_user_id,
    'role', v_clean_role,
    'job_title', v_job_title_name,
    'career_level', p_career_level,
    'message', format('Successfully updated %s assignments.', COALESCE(v_target_name, v_target_email, 'member'))
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 6. Ownership transfer RPC (transfer_organization_ownership)
DROP FUNCTION IF EXISTS public.transfer_organization_ownership(uuid, uuid);
CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
  p_org_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_current_owner_id uuid;
  v_new_owner_email text;
  v_org_name text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Verify caller is currently the primary owner
  SELECT owner_id, name INTO v_current_owner_id, v_org_name 
  FROM public.organizations 
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'Security error: Only the current organization owner can transfer ownership.' USING ERRCODE = '42501';
  END IF;

  -- Validate target user
  IF p_new_owner_id IS NULL OR p_new_owner_id = v_caller_id THEN
    RAISE EXCEPTION 'Validation error: A different active organization member must be designated as the new owner.' USING ERRCODE = '22023';
  END IF;

  -- Verify target user is an active member
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations 
    WHERE org_id = p_org_id AND user_id = p_new_owner_id
  ) THEN
    RAISE EXCEPTION 'Validation error: Target user is not an active member of this organization.' USING ERRCODE = 'P0002';
  END IF;

  SELECT email INTO v_new_owner_email FROM public.users WHERE id = p_new_owner_id;

  -- Atomic transfer
  UPDATE public.organizations
  SET owner_id = p_new_owner_id
  WHERE id = p_org_id;

  UPDATE public.user_organizations
  SET role = 'owner', custom_role_id = NULL
  WHERE org_id = p_org_id AND user_id = p_new_owner_id;

  UPDATE public.user_organizations
  SET role = 'administrator'
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  UPDATE public.users SET role = 'owner' WHERE id = p_new_owner_id;
  UPDATE public.users SET role = 'administrator' WHERE id = v_caller_id;

  -- Audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'ownership_transferred', 'organizations', p_org_id,
    jsonb_build_object('former_owner_id', v_caller_id),
    jsonb_build_object('new_owner_id', p_new_owner_id, 'new_owner_email', v_new_owner_email)
  );

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Ownership of %s transferred to %s successfully.', v_org_name, COALESCE(v_new_owner_email, 'new owner')),
    'new_owner_id', p_new_owner_id,
    'former_owner_id', v_caller_id
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 7. Member removal RPC with Last-Owner Protection (remove_organization_member)
DROP FUNCTION IF EXISTS public.remove_organization_member(uuid, uuid);
CREATE OR REPLACE FUNCTION public.remove_organization_member(
  p_org_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_is_owner boolean;
  v_target_role text;
  v_target_email text;
  v_target_name text;
  v_owner_count int;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Cannot remove self
  IF v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'Security error: Cannot remove yourself. Use leave organization.' USING ERRCODE = '42501';
  END IF;

  -- Prevent removing primary organization owner
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Security error: The primary organization owner cannot be removed.' USING ERRCODE = '42501';
  END IF;

  -- Authorize caller
  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator')
    OR public.has_org_permission(v_caller_id, p_org_id, 'members.remove')
  ) THEN
    RAISE EXCEPTION 'Access denied: You lack permission to remove organization members.' USING ERRCODE = '42501';
  END IF;

  -- Check target member details
  SELECT role INTO v_target_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user is not a member of this organization.' USING ERRCODE = 'P0002';
  END IF;

  -- Administrators cannot remove owners
  IF v_target_role = 'owner' AND NOT COALESCE(v_is_owner, false) THEN
    RAISE EXCEPTION 'Permission denied: Only the organization owner can remove owner-level members.' USING ERRCODE = '42501';
  END IF;

  -- Delete membership
  DELETE FROM public.user_organizations WHERE org_id = p_org_id AND user_id = p_target_user_id;

  SELECT email, full_name INTO v_target_email, v_target_name FROM public.users WHERE id = p_target_user_id;

  -- Clear workspace if active
  UPDATE public.users 
  SET default_workspace_id = NULL 
  WHERE id = p_target_user_id AND default_workspace_id = p_org_id::text;

  -- Audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value
  ) VALUES (
    p_org_id, v_caller_id, 'member_removed', 'user_organizations', p_target_user_id,
    jsonb_build_object('removed_role', v_target_role, 'removed_email', v_target_email)
  );

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Member %s removed successfully.', COALESCE(v_target_name, v_target_email, 'user'))
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 8. Custom Role creation with Anti-Privilege Escalation (create_custom_role)
DROP FUNCTION IF EXISTS public.create_custom_role(uuid, text, text, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_org_id uuid,
  p_name text,
  p_description text,
  p_permissions jsonb,
  p_scope_limits jsonb DEFAULT '{"projects": "organization", "tasks": "organization"}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_is_owner boolean;
  v_role_key text;
  v_new_role_id uuid;
  v_requested_perm text;
  v_caller_custom_role_id uuid;
  v_caller_scope_projects text := 'organization';
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Authorize caller
  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role, custom_role_id INTO v_caller_role, v_caller_custom_role_id 
  FROM public.user_organizations 
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator')
    OR public.has_org_permission(v_caller_id, p_org_id, 'roles.create')
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not possess permission to create roles.' USING ERRCODE = '42501';
  END IF;

  -- Anti-privilege escalation checks
  IF COALESCE(v_is_owner, false) = false AND v_caller_role != 'owner' THEN
    FOR v_requested_perm IN SELECT jsonb_array_elements_text(p_permissions) LOOP
      IF v_requested_perm IN ('organization.delete', 'billing.manage') THEN
        IF NOT public.has_org_permission(v_caller_id, p_org_id, v_requested_perm) THEN
          RAISE EXCEPTION 'Privilege escalation blocked: Protected administrative permission "%" cannot be delegated.', v_requested_perm USING ERRCODE = '42501';
        END IF;
      END IF;

      IF NOT public.has_org_permission(v_caller_id, p_org_id, v_requested_perm) THEN
        RAISE EXCEPTION 'Privilege escalation blocked: You cannot grant permission "%" which you do not possess.', v_requested_perm USING ERRCODE = '42501';
      END IF;
    END LOOP;

    IF v_caller_custom_role_id IS NOT NULL THEN
      SELECT COALESCE(scope_limits->>'projects', 'organization') INTO v_caller_scope_projects
      FROM public.organization_roles WHERE id = v_caller_custom_role_id;
      
      IF v_caller_scope_projects = 'department' AND (p_scope_limits->>'projects') = 'organization' THEN
        RAISE EXCEPTION 'Scope escalation blocked: Department-scoped users cannot create organization-scoped roles.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Validate role name and generate key
  v_role_key := LOWER(REGEXP_REPLACE(TRIM(p_name), '[^a-zA-Z0-9]+', '_', 'g'));
  IF v_role_key IN ('owner', 'administrator', 'superadmin', 'platform_admin', 'client', 'guest') THEN
    v_role_key := 'custom_' || v_role_key || '_' || SUBSTR(gen_random_uuid()::text, 1, 6);
  END IF;

  -- Insert role
  INSERT INTO public.organization_roles (
    org_id, role_key, name, description, is_system, is_active, permissions, scope_limits, created_by
  ) VALUES (
    p_org_id, v_role_key, TRIM(p_name), p_description, false, true, p_permissions, p_scope_limits, v_caller_id
  )
  RETURNING id INTO v_new_role_id;

  -- Record audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'custom_role_created', 'organization_roles', v_new_role_id,
    jsonb_build_object('name', p_name, 'role_key', v_role_key, 'permissions_count', jsonb_array_length(p_permissions))
  );

  SELECT jsonb_build_object(
    'success', true,
    'role_id', v_new_role_id,
    'name', p_name,
    'role_key', v_role_key,
    'message', format('Custom role "%s" created successfully.', p_name)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 9. Custom Job Title creation (create_custom_job_title)
DROP FUNCTION IF EXISTS public.create_custom_job_title(uuid, text, text, text, text);
CREATE OR REPLACE FUNCTION public.create_custom_job_title(
  p_org_id uuid,
  p_title text,
  p_functional_category text DEFAULT 'General',
  p_description text DEFAULT NULL,
  p_career_level text DEFAULT 'L3'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_is_owner boolean;
  v_caller_role text;
  v_level_name text;
  v_new_id uuid;
  v_clean_level text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator', 'manager')
    OR public.has_org_permission(v_caller_id, p_org_id, 'roles.manage')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to add job titles.' USING ERRCODE = '42501';
  END IF;

  v_clean_level := UPPER(TRIM(p_career_level));
  IF v_clean_level NOT IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10') THEN
    v_clean_level := 'L3';
  END IF;

  v_level_name := CASE v_clean_level
    WHEN 'L1' THEN 'Intern / Trainee'
    WHEN 'L2' THEN 'Entry-Level / Associate'
    WHEN 'L3' THEN 'Professional'
    WHEN 'L4' THEN 'Senior Professional'
    WHEN 'L5' THEN 'Lead / Staff / Principal'
    WHEN 'L6' THEN 'Manager'
    WHEN 'L7' THEN 'Senior Manager'
    WHEN 'L8' THEN 'Director'
    WHEN 'L9' THEN 'Vice President'
    WHEN 'L10' THEN 'Executive'
    ELSE 'Professional'
  END;

  INSERT INTO public.job_titles (
    org_id, title, functional_category, department_name, description, career_level, career_level_name, is_system, is_active
  ) VALUES (
    p_org_id, TRIM(p_title), COALESCE(NULLIF(TRIM(p_functional_category), ''), 'General'), COALESCE(NULLIF(TRIM(p_functional_category), ''), 'General'), p_description, v_clean_level, v_level_name, false, true
  )
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'success', true,
    'job_title_id', v_new_id,
    'title', p_title,
    'functional_category', p_functional_category,
    'career_level', v_clean_level,
    'career_level_name', v_level_name,
    'message', format('Job title "%s" added to catalogue.', p_title)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- 10. Complete RBAC Overview RPC (get_organization_rbac_overview)
DROP FUNCTION IF EXISTS public.get_organization_rbac_overview(uuid);
CREATE OR REPLACE FUNCTION public.get_organization_rbac_overview(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_roles jsonb;
  v_job_titles jsonb;
  v_departments jsonb;
  v_members jsonb;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Official Built-in Roles
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.role_name,
      'role_key', r.role_name,
      'name', CASE 
        WHEN r.role_name = 'owner' THEN 'Organisation Owner'
        WHEN r.role_name = 'administrator' THEN 'Organisation Administrator'
        WHEN r.role_name = 'manager' THEN 'Manager'
        WHEN r.role_name = 'team_lead' THEN 'Team Lead'
        WHEN r.role_name = 'team_member' THEN 'Team Member'
        WHEN r.role_name = 'guest' THEN 'Guest / External Collaborator'
        WHEN r.role_name = 'client' THEN 'Client'
        ELSE INITCAP(REPLACE(r.role_name, '_', ' '))
      END,
      'type', 'built_in',
      'is_system', true,
      'is_active', true,
      'permissions', r.permissions,
      'member_count', (
        SELECT count(*) FROM public.user_organizations uo 
        WHERE uo.org_id = p_org_id 
          AND (uo.role = r.role_name OR (r.role_name = 'team_member' AND uo.role = 'employee'))
          AND uo.custom_role_id IS NULL
      )
    ) ORDER BY CASE r.role_name
      WHEN 'owner' THEN 1
      WHEN 'administrator' THEN 2
      WHEN 'manager' THEN 3
      WHEN 'team_lead' THEN 4
      WHEN 'team_member' THEN 5
      WHEN 'guest' THEN 6
      WHEN 'client' THEN 7
      ELSE 8
    END
  ) INTO v_roles
  FROM public.roles r
  WHERE r.role_name IN ('owner', 'administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client');

  -- Add custom roles for this organization
  SELECT v_roles || COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cr.id,
      'role_key', cr.role_key,
      'name', cr.name,
      'description', cr.description,
      'type', 'custom',
      'is_system', cr.is_system,
      'is_active', cr.is_active,
      'permissions', cr.permissions,
      'scope_limits', cr.scope_limits,
      'created_at', cr.created_at,
      'member_count', (
        SELECT count(*) FROM public.user_organizations uo 
        WHERE uo.org_id = p_org_id AND uo.custom_role_id = cr.id
      )
    ) ORDER BY cr.created_at
  ), '[]'::jsonb) INTO v_roles
  FROM public.organization_roles cr
  WHERE cr.org_id = p_org_id;

  -- Job Titles Catalog (Extensible, zero department dependencies)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', jt.id,
      'title', jt.title,
      'functional_category', COALESCE(jt.functional_category, jt.department_name, 'General'),
      'department_name', COALESCE(jt.functional_category, jt.department_name, 'General'),
      'description', jt.description,
      'career_level', jt.career_level,
      'career_level_name', jt.career_level_name,
      'is_system', jt.is_system,
      'is_active', jt.is_active,
      'is_custom', (jt.org_id IS NOT NULL)
    ) ORDER BY jt.career_level DESC, jt.title
  ) INTO v_job_titles
  FROM public.job_titles jt
  WHERE (jt.org_id IS NULL OR jt.org_id = p_org_id) AND jt.is_active = true;

  -- Departments (Optional, custom organization departments)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'name', d.name,
      'description', d.description,
      'color', d.color,
      'head_user_id', d.head_user_id,
      'member_count', (
        SELECT count(*) FROM public.user_organizations uo 
        WHERE uo.org_id = p_org_id AND uo.department_id = d.id
      )
    ) ORDER BY d.name
  ) INTO v_departments
  FROM public.departments d
  WHERE d.org_id = p_org_id AND d.is_deleted = false;

  -- Members with clean Role & Job Title attributes
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', uo.user_id,
      'full_name', u.full_name,
      'email', u.email,
      'role', CASE WHEN uo.role = 'employee' THEN 'team_member' ELSE uo.role END,
      'custom_role_id', uo.custom_role_id,
      'job_title_id', uo.job_title_id,
      'job_title', COALESCE(uo.job_title, jt.title, 'Team Member'),
      'career_level', COALESCE(uo.career_level, jt.career_level, 'L3'),
      'department_id', uo.department_id,
      'department_name', d.name,
      'joined_at', uo.joined_at
    ) ORDER BY CASE uo.role
      WHEN 'owner' THEN 1
      WHEN 'administrator' THEN 2
      WHEN 'manager' THEN 3
      WHEN 'team_lead' THEN 4
      WHEN 'team_member' THEN 5
      WHEN 'employee' THEN 5
      WHEN 'guest' THEN 6
      WHEN 'client' THEN 7
      ELSE 8
    END, u.full_name
  ) INTO v_members
  FROM public.user_organizations uo
  JOIN public.users u ON u.id = uo.user_id
  LEFT JOIN public.job_titles jt ON jt.id = uo.job_title_id
  LEFT JOIN public.departments d ON d.id = uo.department_id
  WHERE uo.org_id = p_org_id;

  SELECT jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'roles', COALESCE(v_roles, '[]'::jsonb),
    'job_titles', COALESCE(v_job_titles, '[]'::jsonb),
    'departments', COALESCE(v_departments, '[]'::jsonb),
    'members', COALESCE(v_members, '[]'::jsonb)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- ------------------------------------------------------------------------------
-- PART 8: PERMISSION GRANTS
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_join_request(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_organization_join_request(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_member_job_and_role(uuid, uuid, text, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_organization_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_role(uuid, text, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_job_title(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_rbac_overview(uuid) TO authenticated;
