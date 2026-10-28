-- ==============================================================================
-- AUVRYN — Enterprise Job Roles Catalogue & RBAC Implementation
-- Migration: 20261027130000_enterprise_job_roles_and_rbac.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND ROLES TABLE WITH BUILT-IN ENTERPRISE ROLES & GRANULAR PERMISSIONS
-- ------------------------------------------------------------------------------

-- Ensure 'department_head' and 'guest' exist in roles
INSERT INTO public.roles (role_name, permissions, created_at)
VALUES 
  ('department_head', '[
    "departments.view", "departments.update", "members.view",
    "projects.view", "projects.create", "projects.update",
    "tasks.view", "tasks.create", "tasks.update", "tasks.assign",
    "workflows.view", "workflows.execute", "files.view", "files.upload", "files.download",
    "chat.view", "chat.send", "meetings.view", "meetings.create", "reports.view",
    "manage_departments", "view_projects", "create_projects", "manage_projects",
    "create_tasks", "manage_tasks", "assign_tasks", "upload_files", "download_files",
    "send_messages", "schedule_meetings", "view_team_directory", "view_reports"
  ]'::jsonb, now()),
  ('guest', '[
    "projects.view", "tasks.view", "files.download", "chat.view", "chat.send",
    "view_projects", "download_files", "send_messages"
  ]'::jsonb, now())
ON CONFLICT (role_name) DO UPDATE SET
  permissions = EXCLUDED.permissions;

-- Update existing roles with both granular dot-notation and legacy permissions
UPDATE public.roles
SET permissions = permissions || '[
  "organization.view", "organization.update", "organization.manage_settings", "organization.delete",
  "members.view", "members.invite", "members.update", "members.remove", "members.assign_roles",
  "departments.view", "departments.create", "departments.update", "departments.archive", "teams.manage",
  "roles.view", "roles.create", "roles.update", "roles.assign", "roles.delete", "permissions.manage",
  "projects.view", "projects.create", "projects.update", "projects.delete",
  "tasks.view", "tasks.create", "tasks.update", "tasks.assign", "tasks.delete",
  "workflows.view", "workflows.create", "workflows.update", "workflows.execute", "workflows.manage",
  "clients.view", "clients.create", "clients.update", "clients.archive",
  "invoices.view", "invoices.create", "invoices.update", "invoices.approve", "invoices.download", "billing.manage",
  "files.view", "files.upload", "files.update", "files.download", "files.share", "files.delete",
  "chat.view", "chat.send", "chat.manage",
  "meetings.view", "meetings.create", "meetings.manage",
  "reports.view", "reports.export",
  "audit_logs.view", "security.manage", "integrations.manage"
]'::jsonb
WHERE role_name IN ('owner', 'managing_director', 'ceo', 'cto');

UPDATE public.roles
SET permissions = permissions || '[
  "organization.view", "organization.update", "organization.manage_settings",
  "members.view", "members.invite", "members.update", "members.remove", "members.assign_roles",
  "departments.view", "departments.create", "departments.update", "departments.archive", "teams.manage",
  "roles.view", "roles.create", "roles.update", "roles.assign",
  "projects.view", "projects.create", "projects.update", "projects.delete",
  "tasks.view", "tasks.create", "tasks.update", "tasks.assign", "tasks.delete",
  "workflows.view", "workflows.create", "workflows.update", "workflows.execute", "workflows.manage",
  "clients.view", "clients.create", "clients.update",
  "invoices.view", "invoices.create", "invoices.update", "invoices.approve", "invoices.download",
  "files.view", "files.upload", "files.update", "files.download", "files.share", "files.delete",
  "chat.view", "chat.send", "chat.manage",
  "meetings.view", "meetings.create", "meetings.manage",
  "reports.view", "reports.export",
  "audit_logs.view", "security.manage"
]'::jsonb
WHERE role_name IN ('administrator', 'admin', 'hr');

UPDATE public.roles
SET permissions = permissions || '[
  "organization.view",
  "members.view", "members.invite",
  "departments.view",
  "projects.view", "projects.create", "projects.update",
  "tasks.view", "tasks.create", "tasks.update", "tasks.assign",
  "workflows.view", "workflows.execute",
  "clients.view",
  "invoices.view", "invoices.create", "invoices.download",
  "files.view", "files.upload", "files.update", "files.download", "files.share",
  "chat.view", "chat.send",
  "meetings.view", "meetings.create", "meetings.manage",
  "reports.view"
]'::jsonb
WHERE role_name IN ('manager', 'senior_manager', 'director', 'project_manager');

UPDATE public.roles
SET permissions = permissions || '[
  "organization.view",
  "members.view",
  "departments.view",
  "projects.view",
  "tasks.view", "tasks.create", "tasks.update", "tasks.assign",
  "workflows.view", "workflows.execute",
  "files.view", "files.upload", "files.download",
  "chat.view", "chat.send",
  "meetings.view", "meetings.create"
]'::jsonb
WHERE role_name IN ('team_lead');

UPDATE public.roles
SET permissions = permissions || '[
  "organization.view",
  "members.view",
  "departments.view",
  "projects.view",
  "tasks.view", "tasks.create", "tasks.update",
  "workflows.view", "workflows.execute",
  "files.view", "files.upload", "files.download",
  "chat.view", "chat.send",
  "meetings.view"
]'::jsonb
WHERE role_name IN ('employee', 'senior_employee', 'intern', 'developer', 'general_member');

UPDATE public.roles
SET permissions = permissions || '[
  "projects.view",
  "invoices.view",
  "invoices.download",
  "files.view", "files.download",
  "chat.view", "chat.send"
]'::jsonb
WHERE role_name = 'client';

-- ------------------------------------------------------------------------------
-- 2. CREATE ORGANIZATION-SCOPED CUSTOM ROLES TABLE
-- ------------------------------------------------------------------------------

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

-- Enable RLS on organization_roles
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

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
        (uo.role)::text = ANY(ARRAY['owner', 'administrator', 'managing_director', 'ceo'])
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
        (uo.role)::text = ANY(ARRAY['owner', 'administrator', 'managing_director', 'ceo'])
        OR public.has_org_permission(auth.uid(), organization_roles.org_id, 'roles.create')
      )
  )
);

-- ------------------------------------------------------------------------------
-- 3. CREATE JOB ROLES CATALOGUE TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  department_name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  career_level text NOT NULL DEFAULT 'L3' CHECK (career_level IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10')),
  career_level_name text NOT NULL DEFAULT 'Professional',
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_titles_org_id ON public.job_titles(org_id);
CREATE INDEX IF NOT EXISTS idx_job_titles_dept_name ON public.job_titles(department_name);

-- Enable RLS on job_titles
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

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
        AND ((uo.role)::text = ANY(ARRAY['owner', 'administrator', 'managing_director', 'ceo', 'hr']))
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
        AND ((uo.role)::text = ANY(ARRAY['owner', 'administrator', 'managing_director', 'ceo', 'hr']))
    )
  )
);

-- ------------------------------------------------------------------------------
-- 4. EXTEND USER_ORGANIZATIONS WITH JOB TITLE & CUSTOM ROLE ATTRIBUTES
-- ------------------------------------------------------------------------------

ALTER TABLE public.user_organizations
ADD COLUMN IF NOT EXISTS job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS career_level text DEFAULT 'L3',
ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.organization_roles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scope_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 5. SEED ENTERPRISE DEPARTMENTS FOR ALL EXISTING ORGANIZATIONS
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_org RECORD;
  v_dept_name text;
  v_dept_color text;
  v_dept_desc text;
  v_depts text[][] := ARRAY[
    ARRAY['Executive Leadership', '#8B5CF6', 'Executive strategic direction and company governance.'],
    ARRAY['Software Engineering & Development', '#3B82F6', 'Core platform, applications, backend services, and APIs.'],
    ARRAY['Cybersecurity & Information Security', '#EF4444', 'Information protection, compliance, threat detection, and audits.'],
    ARRAY['DevOps, Cloud & Infrastructure', '#06B6D4', 'Cloud architecture, CI/CD pipelines, and infrastructure reliability.'],
    ARRAY['Quality Assurance & Testing', '#10B981', 'Automated testing, test verification, performance and quality gates.'],
    ARRAY['Product Management & Design', '#F59E0B', 'Product lifecycle, roadmaps, UI/UX design, and user research.'],
    ARRAY['Data, Analytics & Artificial Intelligence', '#EC4899', 'Data engineering, business intelligence, machine learning, and AI.'],
    ARRAY['Project & Program Management', '#6366F1', 'Agile delivery, scrum ceremonies, timelines, and deliverables.'],
    ARRAY['Finance & Accounting', '#14B8A6', 'Financial planning, accounting, corporate taxes, and invoicing.'],
    ARRAY['Human Resources & People Operations', '#F97316', 'Recruitment, team performance, workplace culture, and employee welfare.'],
    ARRAY['Sales & Business Development', '#84CC16', 'Client acquisitions, enterprise contracts, and partnerships.'],
    ARRAY['Marketing & Communications', '#D946EF', 'Brand awareness, digital campaigns, content, and public relations.'],
    ARRAY['Customer Support & Professional Services', '#0284C7', 'Customer support, SLA fulfillment, and customer success management.'],
    ARRAY['Legal, Compliance & Risk', '#64748B', 'Legal advisory, regulatory compliance, risk management, and IP.'],
    ARRAY['Administration & Internal IT', '#78716C', 'Workplace administration, hardware allocation, and corporate IT support.'],
    ARRAY['Research & Development', '#A855F7', 'Advanced exploratory technology research and product innovations.']
  ];
  i int;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    FOR i IN 1..array_length(v_depts, 1) LOOP
      v_dept_name := v_depts[i][1];
      v_dept_color := v_depts[i][2];
      v_dept_desc := v_depts[i][3];
      
      IF NOT EXISTS (
        SELECT 1 FROM public.departments WHERE org_id = v_org.id AND name ILIKE v_dept_name
      ) THEN
        INSERT INTO public.departments (org_id, name, description, color, is_deleted)
        VALUES (v_org.id, v_dept_name, v_dept_desc, v_dept_color, false);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6. SEED COMPREHENSIVE GLOBAL JOB TITLES CATALOGUE (16 DEPARTMENTS)
-- ------------------------------------------------------------------------------

INSERT INTO public.job_titles (title, department_name, description, career_level, career_level_name, is_system, is_active)
VALUES
  -- 1. Executive Leadership
  ('Chief Executive Officer (CEO)', 'Executive Leadership', 'Sets corporate vision, long-term strategy, and leads company operations.', 'L10', 'Executive', true, true),
  ('Chief Technology Officer (CTO)', 'Executive Leadership', 'Directs enterprise technology roadmap, architectural standards, and engineering.', 'L10', 'Executive', true, true),
  ('Chief Financial Officer (CFO)', 'Executive Leadership', 'Manages corporate financial strategy, fiscal compliance, and investments.', 'L10', 'Executive', true, true),
  ('Chief Operating Officer (COO)', 'Executive Leadership', 'Drives cross-departmental operations, organizational efficiency, and scale.', 'L10', 'Executive', true, true),
  ('Managing Director', 'Executive Leadership', 'Oversees enterprise divisions and operational execution.', 'L9', 'Vice President', true, true),

  -- 2. Software Engineering & Development
  ('Software Engineering Intern', 'Software Engineering & Development', 'Assists software development teams with feature implementation and testing.', 'L1', 'Intern / Trainee', true, true),
  ('Associate Software Engineer', 'Software Engineering & Development', 'Builds and maintains features under senior engineering guidance.', 'L2', 'Entry-Level / Associate', true, true),
  ('Software Engineer', 'Software Engineering & Development', 'Designs, codes, and delivers high-performance web and backend services.', 'L3', 'Professional', true, true),
  ('Senior Software Engineer', 'Software Engineering & Development', 'Architects scalable modules, reviews code, and solves complex technical challenges.', 'L4', 'Senior Professional', true, true),
  ('Lead Software Engineer', 'Software Engineering & Development', 'Guides engineering squads, establishes design patterns, and oversees delivery.', 'L5', 'Lead / Staff / Principal', true, true),
  ('Principal Software Architect', 'Software Engineering & Development', 'Defines company-wide system architecture, reliability, and technical strategy.', 'L5', 'Lead / Staff / Principal', true, true),
  ('Frontend Developer', 'Software Engineering & Development', 'Specializes in responsive user interfaces, design systems, and browser performance.', 'L3', 'Professional', true, true),
  ('Senior Frontend Developer', 'Software Engineering & Development', 'Leads client-side architecture, WebSockets, and state management.', 'L4', 'Senior Professional', true, true),
  ('Backend Developer', 'Software Engineering & Development', 'Implements microservices, relational databases, caching, and server APIs.', 'L3', 'Professional', true, true),
  ('Full-Stack Developer', 'Software Engineering & Development', 'Develops end-to-end features spanning React web clients and Node.js backend services.', 'L3', 'Professional', true, true),
  ('Mobile App Developer', 'Software Engineering & Development', 'Constructs cross-platform mobile applications on iOS and Android.', 'L3', 'Professional', true, true),

  -- 3. Cybersecurity & Information Security
  ('Security Analyst', 'Cybersecurity & Information Security', 'Monitors security logs, evaluates attack vectors, and prevents data breaches.', 'L3', 'Professional', true, true),
  ('Senior Security Analyst', 'Cybersecurity & Information Security', 'Coordinates incident response, vulnerability management, and perimeter audits.', 'L4', 'Senior Professional', true, true),
  ('Penetration Tester / Ethical Hacker', 'Cybersecurity & Information Security', 'Conducts red-team assessments, code penetration tests, and vulnerability reporting.', 'L4', 'Senior Professional', true, true),
  ('Chief Information Security Officer (CISO)', 'Cybersecurity & Information Security', 'Formulates enterprise security posture, risk policies, and regulatory compliance.', 'L9', 'Vice President', true, true),
  ('Information Security Specialist', 'Cybersecurity & Information Security', 'Configures identity and access management, encryption, and zero-trust controls.', 'L3', 'Professional', true, true),

  -- 4. DevOps, Cloud & Infrastructure
  ('DevOps Engineer', 'DevOps, Cloud & Infrastructure', 'Automates CI/CD pipelines, container orchestration, and environment deployments.', 'L3', 'Professional', true, true),
  ('Senior DevOps Engineer', 'DevOps, Cloud & Infrastructure', 'Architects continuous delivery pipelines, infrastructure-as-code, and secrets management.', 'L4', 'Senior Professional', true, true),
  ('Site Reliability Engineer (SRE)', 'DevOps, Cloud & Infrastructure', 'Ensures 99.99% system availability, telemetry monitoring, and disaster recovery.', 'L4', 'Senior Professional', true, true),
  ('Cloud Solutions Architect', 'DevOps, Cloud & Infrastructure', 'Designs resilient multi-cloud architectures across AWS, GCP, and Supabase.', 'L5', 'Lead / Staff / Principal', true, true),

  -- 5. Quality Assurance & Testing
  ('QA Engineer', 'Quality Assurance & Testing', 'Performs functional and regression testing to maintain software quality.', 'L3', 'Professional', true, true),
  ('Senior QA Automation Engineer', 'Quality Assurance & Testing', 'Builds automated test suites using Playwright, Jest, and CI integration.', 'L4', 'Senior Professional', true, true),
  ('Quality Assurance Lead', 'Quality Assurance & Testing', 'Manages QA team release verification, test strategies, and quality benchmarks.', 'L5', 'Lead / Staff / Principal', true, true),

  -- 6. Product Management & Design
  ('Associate Product Manager', 'Product Management & Design', 'Assists in defining product features, user stories, and acceptance criteria.', 'L2', 'Entry-Level / Associate', true, true),
  ('Product Manager', 'Product Management & Design', 'Defines product roadmaps, balances stakeholder priorities, and measures KPIs.', 'L3', 'Professional', true, true),
  ('Senior Product Manager', 'Product Management & Design', 'Drives strategic product domains and cross-functional feature rollouts.', 'L4', 'Senior Professional', true, true),
  ('UI/UX Designer', 'Product Management & Design', 'Creates user journeys, interactive wireframes, prototypes, and high-fidelity UI.', 'L3', 'Professional', true, true),
  ('Senior Product Designer', 'Product Management & Design', 'Directs enterprise design systems, accessible UI patterns, and user experience.', 'L4', 'Senior Professional', true, true),

  -- 7. Data, Analytics & Artificial Intelligence
  ('Data Analyst', 'Data, Analytics & Artificial Intelligence', 'Extracts metrics, builds dashboards, and identifies operational insights.', 'L3', 'Professional', true, true),
  ('Data Engineer', 'Data, Analytics & Artificial Intelligence', 'Constructs ETL pipelines, data warehouses, and structured analytical models.', 'L3', 'Professional', true, true),
  ('Senior Data Scientist', 'Data, Analytics & Artificial Intelligence', 'Develops predictive statistical models, regression frameworks, and data mining.', 'L4', 'Senior Professional', true, true),
  ('AI / Machine Learning Engineer', 'Data, Analytics & Artificial Intelligence', 'Integrates large language models, neural embeddings, and intelligent agents.', 'L4', 'Senior Professional', true, true),

  -- 8. Project & Program Management
  ('Project Coordinator', 'Project & Program Management', 'Tracks milestones, meeting schedules, and resource dependencies.', 'L2', 'Entry-Level / Associate', true, true),
  ('Project Manager', 'Project & Program Management', 'Manages scope, sprints, budgets, deliverables, and team timelines.', 'L3', 'Professional', true, true),
  ('Technical Program Manager (TPM)', 'Project & Program Management', 'Orchestrates complex multi-team initiatives across engineering organizations.', 'L4', 'Senior Professional', true, true),
  ('Scrum Master / Agile Coach', 'Project & Program Management', 'Facilitates sprint planning, retrospectives, and agile development velocity.', 'L3', 'Professional', true, true),

  -- 9. Finance & Accounting
  ('Junior Accountant', 'Finance & Accounting', 'Reconciles payment entries, bills, and accounts payable.', 'L2', 'Entry-Level / Associate', true, true),
  ('Senior Accountant', 'Finance & Accounting', 'Manages general ledgers, corporate audits, balance sheets, and tax filings.', 'L4', 'Senior Professional', true, true),
  ('Financial Controller', 'Finance & Accounting', 'Directs accounting practices, financial controls, and risk governance.', 'L7', 'Senior Manager', true, true),
  ('Finance Director', 'Finance & Accounting', 'Guides enterprise financial strategy, fiscal forecasting, and audit reports.', 'L8', 'Director', true, true),

  -- 10. Human Resources & People Operations
  ('HR Specialist', 'Human Resources & People Operations', 'Coordinates employee onboarding, leave management, and benefits administration.', 'L2', 'Entry-Level / Associate', true, true),
  ('Talent Acquisition Recruiter', 'Human Resources & People Operations', 'Sources, interviews, and hires top engineering and business professionals.', 'L3', 'Professional', true, true),
  ('Human Resources Manager', 'Human Resources & People Operations', 'Leads people operations, organizational culture, conflict resolution, and performance.', 'L6', 'Manager', true, true),
  ('Director of People Operations', 'Human Resources & People Operations', 'Formulates talent retention strategies, compensation bands, and HR policies.', 'L8', 'Director', true, true),

  -- 11. Sales & Business Development
  ('Business Development Representative (BDR)', 'Sales & Business Development', 'Identifies qualified prospective enterprise clients and schedules discovery demos.', 'L2', 'Entry-Level / Associate', true, true),
  ('Account Executive', 'Sales & Business Development', 'Closes enterprise subscription deals and negotiates business terms.', 'L3', 'Professional', true, true),
  ('Sales Manager', 'Sales & Business Development', 'Coaches sales representatives and drives revenue quota attainment.', 'L6', 'Manager', true, true),
  ('Solutions Architect', 'Sales & Business Development', 'Partners with sales to architect technical solutions and custom demonstrations.', 'L4', 'Senior Professional', true, true),

  -- 12. Marketing & Communications
  ('Marketing Specialist', 'Marketing & Communications', 'Executes marketing campaigns, promotional events, and digital outreach.', 'L3', 'Professional', true, true),
  ('Content Strategist & Copywriter', 'Marketing & Communications', 'Authors case studies, technical documentation, newsletters, and blog posts.', 'L3', 'Professional', true, true),
  ('Growth Marketing Lead', 'Marketing & Communications', 'Optimizes conversion funnels, product analytics, and customer acquisition CAC.', 'L5', 'Lead / Staff / Principal', true, true),

  -- 13. Customer Support & Professional Services
  ('Customer Support Specialist', 'Customer Support & Professional Services', 'Provides rapid technical support and ticket resolution for platform users.', 'L2', 'Entry-Level / Associate', true, true),
  ('Customer Success Manager', 'Customer Support & Professional Services', 'Monitors customer retention, user adoption, training, and value realization.', 'L3', 'Professional', true, true),
  ('Professional Services Consultant', 'Customer Support & Professional Services', 'Delivers bespoke implementation, training, and system migrations.', 'L4', 'Senior Professional', true, true),

  -- 14. Legal, Compliance & Risk
  ('Corporate Legal Counsel', 'Legal, Compliance & Risk', 'Drafts contracts, intellectual property safeguards, and vendor agreements.', 'L4', 'Senior Professional', true, true),
  ('Data Privacy & Compliance Officer', 'Legal, Compliance & Risk', 'Oversees GDPR, SOC 2, HIPAA, and data protection regulations.', 'L4', 'Senior Professional', true, true),

  -- 15. Administration & Internal IT
  ('IT Support Specialist', 'Administration & Internal IT', 'Configures developer laptops, VPN credentials, and internal IT assets.', 'L2', 'Entry-Level / Associate', true, true),
  ('Systems Administrator', 'Administration & Internal IT', 'Maintains corporate network, Single Sign-On (SSO), and office infrastructure.', 'L3', 'Professional', true, true),

  -- 16. Research & Development
  ('Research Scientist', 'Research & Development', 'Explores novel computational algorithms and conducts fundamental research.', 'L4', 'Senior Professional', true, true),
  ('Principal R&D Engineer', 'Research & Development', 'Pioneers state-of-the-art technological breakthroughs and patent filings.', 'L5', 'Lead / Staff / Principal', true, true)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. ENHANCED PERMISSION CHECKING FUNCTION: public.has_org_permission
-- ------------------------------------------------------------------------------

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

  -- 1. Organization Owner has ALL permissions unconditionally
  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Derive canonical alias for cross-compatibility (dot vs underscore)
  -- e.g. 'projects.view' -> 'view_projects', 'manage_roles' -> 'roles.create'
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
    WHEN p_permission = 'departments.view' THEN 'manage_departments'
    WHEN p_permission = 'departments.create' THEN 'manage_departments'
    WHEN p_permission = 'departments.update' THEN 'manage_departments'
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

  -- 2. Check user's role and custom_role in user_organizations
  IF p_org_id IS NOT NULL THEN
    SELECT role, custom_role_id INTO v_role, v_custom_role_id 
    FROM public.user_organizations 
    WHERE org_id = p_org_id AND user_id = p_user_id;

    -- If user is marked as 'owner' in membership
    IF v_role = 'owner' THEN
      RETURN TRUE;
    END IF;

    -- A. Check custom organization role if assigned
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
    END IF;
  END IF;

  -- 3. Check explicit individual permission grants in role_permissions table
  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.role_permissions 
    WHERE org_id = p_org_id AND user_id = p_user_id 
      AND (permission = p_permission OR permission = v_perm_alt)
  ) THEN
    RETURN TRUE;
  END IF;

  -- 4. Fallback to global has_permission
  RETURN public.has_permission(p_user_id, p_permission);
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_org_permission(uuid, uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. RPC: CREATE CUSTOM ROLE WITH PRIVILEGE ESCALATION CHECKS
-- ------------------------------------------------------------------------------

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
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Authorize caller
  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator', 'managing_director', 'ceo')
    OR public.has_org_permission(v_caller_id, p_org_id, 'roles.create')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to create custom roles.' USING ERRCODE = '42501';
  END IF;

  -- Anti-privilege escalation: If caller is not owner, they cannot grant permissions they do not possess
  IF COALESCE(v_is_owner, false) = false AND v_caller_role != 'owner' THEN
    FOR v_requested_perm IN SELECT jsonb_array_elements_text(p_permissions) LOOP
      IF NOT public.has_org_permission(v_caller_id, p_org_id, v_requested_perm) THEN
        RAISE EXCEPTION 'Privilege escalation blocked: You cannot grant permission "%" which you do not possess.', v_requested_perm USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  -- Generate role key
  v_role_key := LOWER(REGEXP_REPLACE(TRIM(p_name), '[^a-zA-Z0-9]+', '_', 'g'));
  IF v_role_key = '' THEN
    v_role_key := 'custom_' || SUBSTR(gen_random_uuid()::text, 1, 8);
  END IF;

  -- Insert role
  INSERT INTO public.organization_roles (
    org_id, role_key, name, description, is_system, is_active, permissions, scope_limits, created_by
  ) VALUES (
    p_org_id, v_role_key, TRIM(p_name), p_description, false, true, p_permissions, p_scope_limits, v_caller_id
  )
  RETURNING id INTO v_new_role_id;

  -- Log action
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'custom_role_created', 'organization_roles', v_new_role_id,
    jsonb_build_object('name', p_name, 'role_key', v_role_key, 'permissions_count', jsonb_array_length(p_permissions))
  );

  SELECT jsonb_build_object(
    'success', true,
    'role_id', v_new_role_id,
    'role_key', v_role_key,
    'name', p_name,
    'message', format('Custom role "%s" created successfully.', p_name)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_role(uuid, text, text, jsonb, jsonb) TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. RPC: UPDATE CUSTOM ROLE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_custom_role(
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permissions jsonb,
  p_scope_limits jsonb,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_org_id uuid;
  v_is_owner boolean;
  v_caller_role text;
  v_is_system boolean;
  v_requested_perm text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, is_system INTO v_org_id, v_is_system FROM public.organization_roles WHERE id = p_role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom role not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = v_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = v_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator', 'managing_director', 'ceo')
    OR public.has_org_permission(v_caller_id, v_org_id, 'roles.update')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to edit roles in this organization.' USING ERRCODE = '42501';
  END IF;

  -- Anti-privilege escalation
  IF COALESCE(v_is_owner, false) = false AND v_caller_role != 'owner' THEN
    FOR v_requested_perm IN SELECT jsonb_array_elements_text(p_permissions) LOOP
      IF NOT public.has_org_permission(v_caller_id, v_org_id, v_requested_perm) THEN
        RAISE EXCEPTION 'Privilege escalation blocked: You cannot grant permission "%" which you do not possess.', v_requested_perm USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.organization_roles
  SET name = TRIM(p_name),
      description = p_description,
      permissions = p_permissions,
      scope_limits = p_scope_limits,
      is_active = p_is_active,
      updated_at = now()
  WHERE id = p_role_id;

  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    v_org_id, v_caller_id, 'custom_role_updated', 'organization_roles', p_role_id,
    jsonb_build_object('name', p_name, 'is_active', p_is_active)
  );

  SELECT jsonb_build_object(
    'success', true,
    'role_id', p_role_id,
    'message', format('Custom role "%s" updated successfully.', p_name)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_custom_role(uuid, text, text, jsonb, jsonb, boolean) TO authenticated;

-- ------------------------------------------------------------------------------
-- 10. RPC: DELETE CUSTOM ROLE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_custom_role(p_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_org_id uuid;
  v_role_name text;
  v_is_system boolean;
  v_is_owner boolean;
  v_caller_role text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, name, is_system INTO v_org_id, v_role_name, v_is_system 
  FROM public.organization_roles WHERE id = p_role_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_is_system = true THEN
    RAISE EXCEPTION 'Security error: System roles cannot be deleted.' USING ERRCODE = '42501';
  END IF;

  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = v_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = v_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator', 'managing_director', 'ceo')
    OR public.has_org_permission(v_caller_id, v_org_id, 'roles.delete')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to delete roles.' USING ERRCODE = '42501';
  END IF;

  -- Reassign any member currently using this custom role back to base role 'employee'
  UPDATE public.user_organizations
  SET custom_role_id = NULL,
      role = 'employee'
  WHERE custom_role_id = p_role_id;

  -- Delete role
  DELETE FROM public.organization_roles WHERE id = p_role_id;

  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value
  ) VALUES (
    v_org_id, v_caller_id, 'custom_role_deleted', 'organization_roles', p_role_id,
    jsonb_build_object('deleted_role_name', v_role_name)
  );

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Custom role "%s" deleted successfully.', v_role_name)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_custom_role(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 11. RPC: CREATE CUSTOM JOB TITLE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_custom_job_title(
  p_org_id uuid,
  p_title text,
  p_department_name text,
  p_description text,
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
  v_dept_id uuid;
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
    OR v_caller_role IN ('owner', 'administrator', 'managing_director', 'ceo', 'director', 'hr')
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

  SELECT id INTO v_dept_id FROM public.departments WHERE org_id = p_org_id AND name ILIKE p_department_name LIMIT 1;

  INSERT INTO public.job_titles (
    org_id, title, department_name, department_id, description, career_level, career_level_name, is_system, is_active
  ) VALUES (
    p_org_id, TRIM(p_title), TRIM(p_department_name), v_dept_id, p_description, v_clean_level, v_level_name, false, true
  )
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'success', true,
    'job_title_id', v_new_id,
    'title', p_title,
    'department_name', p_department_name,
    'career_level', v_clean_level,
    'career_level_name', v_level_name,
    'message', format('Job title "%s" added to catalogue.', p_title)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_job_title(uuid, text, text, text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 12. RPC: ASSIGN MEMBER PROFESSIONAL JOB TITLE, CAREER LEVEL & APPLICATION ROLE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_member_job_and_role(
  p_org_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_custom_role_id uuid DEFAULT NULL,
  p_job_title_id uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_career_level text DEFAULT 'L3'
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
  v_clean_role text;
  v_target_old_role text;
  v_job_title_name text;
  v_target_email text;
  v_target_name text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- 1. Anti-self-elevation
  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Security violation: Users cannot modify their own role or entitlements.' USING ERRCODE = '42501';
  END IF;

  -- 2. Prevent modifying primary organization owner
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Security violation: The primary organization owner cannot be modified or demoted.' USING ERRCODE = '42501';
  END IF;

  -- 3. Authorize caller
  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator', 'managing_director', 'ceo', 'director', 'senior_manager', 'manager', 'hr')
    OR public.has_org_permission(v_caller_id, p_org_id, 'members.assign_roles')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to manage member assignments.' USING ERRCODE = '42501';
  END IF;

  v_clean_role := LOWER(TRIM(p_role));
  IF v_clean_role = 'member' THEN
    v_clean_role := 'employee';
  END IF;

  -- Privilege hierarchy check
  IF v_clean_role IN ('owner', 'administrator') AND NOT (
    COALESCE(v_is_owner, false) = true 
    OR v_caller_role IN ('owner', 'ceo', 'managing_director')
  ) THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners and executive leadership can grant administrator roles.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role IN ('manager', 'senior_manager') AND v_clean_role IN ('director', 'administrator', 'owner', 'managing_director', 'ceo') THEN
    RAISE EXCEPTION 'Permission denied. You cannot assign a role higher than your own management tier.' USING ERRCODE = '42501';
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
      department_id = COALESCE(p_department_id, department_id)
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

GRANT EXECUTE ON FUNCTION public.assign_member_job_and_role(uuid, uuid, text, uuid, uuid, uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 13. RPC: GET COMPLETE ORGANISATION RBAC & JOB CATALOGUE OVERVIEW
-- ------------------------------------------------------------------------------

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

  -- 1. Built-in and custom roles
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.role_name,
      'role_key', r.role_name,
      'name', INITCAP(REPLACE(r.role_name, '_', ' ')),
      'type', 'built_in',
      'is_system', true,
      'is_active', true,
      'permissions', r.permissions,
      'member_count', (
        SELECT count(*) FROM public.user_organizations uo 
        WHERE uo.org_id = p_org_id AND uo.role = r.role_name AND uo.custom_role_id IS NULL
      )
    )
  ) INTO v_roles
  FROM public.roles r
  WHERE r.role_name IN ('owner', 'administrator', 'department_head', 'manager', 'team_lead', 'employee', 'guest', 'client');

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
    )
  ), '[]'::jsonb) INTO v_roles
  FROM public.organization_roles cr
  WHERE cr.org_id = p_org_id;

  -- 2. Job Titles Catalog (System + Organization custom)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', jt.id,
      'title', jt.title,
      'department_name', jt.department_name,
      'description', jt.description,
      'career_level', jt.career_level,
      'career_level_name', jt.career_level_name,
      'is_system', jt.is_system,
      'is_active', jt.is_active,
      'is_custom', (jt.org_id IS NOT NULL)
    ) ORDER BY jt.department_name, jt.career_level, jt.title
  ) INTO v_job_titles
  FROM public.job_titles jt
  WHERE jt.org_id IS NULL OR jt.org_id = p_org_id;

  -- 3. Departments
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

  -- 4. Members with full attributes
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', uo.user_id,
      'full_name', u.full_name,
      'email', u.email,
      'role', uo.role,
      'custom_role_id', uo.custom_role_id,
      'job_title_id', uo.job_title_id,
      'job_title', COALESCE(uo.job_title, jt.title, 'Member'),
      'career_level', COALESCE(uo.career_level, jt.career_level, 'L3'),
      'department_id', uo.department_id,
      'department_name', d.name,
      'joined_at', uo.joined_at
    ) ORDER BY uo.role, u.full_name
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

GRANT EXECUTE ON FUNCTION public.get_organization_rbac_overview(uuid) TO authenticated;
