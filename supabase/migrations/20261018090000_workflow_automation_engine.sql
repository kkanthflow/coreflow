-- ==============================================================================
-- AUVRYN MASTER MIGRATION: WORKFLOW AUTOMATION ENGINE SCHEMA
-- Production-ready, deterministic rule-based workflow system
-- ==============================================================================

-- 1. Create Workflows Table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  account_id VARCHAR(64) NOT NULL, -- user_id for Freelancer or org_id for Organization
  account_type VARCHAR(32) NOT NULL DEFAULT 'freelancer', -- 'freelancer' | 'organization'
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft', -- 'draft' | 'active' | 'paused' | 'archived'
  category VARCHAR(64) NOT NULL DEFAULT 'project_task', 
  -- Categories: 'project_task', 'deadline_reminder', 'team_notifications', 'approval', 
  -- 'recurring_task', 'project_status', 'client_onboarding', 'form_request', 'webhook', 'exception_escalation'
  
  trigger_type VARCHAR(64) NOT NULL,
  -- Triggers: 'project_created', 'project_updated', 'project_status_changed',
  -- 'task_created', 'task_updated', 'task_assigned', 'task_completed', 'task_overdue',
  -- 'form_submitted', 'approval_completed', 'schedule_cron', 'webhook_inbound'
  
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  webhook_secret VARCHAR(128),
  is_template BOOLEAN NOT NULL DEFAULT false,
  template_category VARCHAR(64),
  version INTEGER NOT NULL DEFAULT 1,
  
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for speedy lookups by account
CREATE INDEX IF NOT EXISTS idx_workflows_account ON public.workflows(account_id, account_type, status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON public.workflows(trigger_type, status);

-- 2. Create Workflow Executions Table (History & Logs)
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  account_id VARCHAR(64) NOT NULL,
  account_type VARCHAR(32) NOT NULL DEFAULT 'freelancer',
  triggered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  trigger_type VARCHAR(64) NOT NULL,
  
  event_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_approval'
  
  actions_attempted JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  error_code VARCHAR(64),
  
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  idempotency_key VARCHAR(128) UNIQUE,
  execution_depth INTEGER NOT NULL DEFAULT 0, -- Prevents recursive workflow loops
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_wf ON public.workflow_executions(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_acc ON public.workflow_executions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);

-- 3. Create Workflow Approvals Table
CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_approver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approver_role VARCHAR(64) DEFAULT 'manager',
  
  decision_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  
  resume_action_index INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_exec ON public.workflow_approvals(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_user ON public.workflow_approvals(assigned_approver_id, status);

-- 4. Enable Row Level Security (RLS) on all 3 workflow tables
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies for backend execution
CREATE POLICY workflows_service_all ON public.workflows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workflow_executions_service_all ON public.workflow_executions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workflow_approvals_service_all ON public.workflow_approvals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated User Policies for Workflows
CREATE POLICY workflows_authenticated_select ON public.workflows
  FOR SELECT TO authenticated
  USING (
    (account_type = 'freelancer' AND (account_id = auth.uid()::text OR created_by = auth.uid()))
    OR
    (account_type = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.org_id::text = workflows.account_id
        AND user_organizations.user_id = auth.uid()
    ))
  );

CREATE POLICY workflows_authenticated_insert ON public.workflows
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_type = 'freelancer' AND account_id = auth.uid()::text)
    OR
    (account_type = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.org_id::text = workflows.account_id
        AND user_organizations.user_id = auth.uid()
        AND user_organizations.role IN ('owner', 'administrator', 'director', 'manager')
    ))
  );

CREATE POLICY workflows_authenticated_update ON public.workflows
  FOR UPDATE TO authenticated
  USING (
    (account_type = 'freelancer' AND (account_id = auth.uid()::text OR created_by = auth.uid()))
    OR
    (account_type = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.org_id::text = workflows.account_id
        AND user_organizations.user_id = auth.uid()
        AND user_organizations.role IN ('owner', 'administrator', 'director', 'manager')
    ))
  );

CREATE POLICY workflows_authenticated_delete ON public.workflows
  FOR DELETE TO authenticated
  USING (
    (account_type = 'freelancer' AND (account_id = auth.uid()::text OR created_by = auth.uid()))
    OR
    (account_type = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.org_id::text = workflows.account_id
        AND user_organizations.user_id = auth.uid()
        AND user_organizations.role IN ('owner', 'administrator')
    ))
  );

-- Executions Policies
CREATE POLICY workflow_executions_authenticated_select ON public.workflow_executions
  FOR SELECT TO authenticated
  USING (
    (account_type = 'freelancer' AND account_id = auth.uid()::text)
    OR
    (account_type = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_organizations.org_id::text = workflow_executions.account_id
        AND user_organizations.user_id = auth.uid()
    ))
  );

-- Approvals Policies
CREATE POLICY workflow_approvals_authenticated_select ON public.workflow_approvals
  FOR SELECT TO authenticated
  USING (
    assigned_approver_id = auth.uid()
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workflows w
      WHERE w.id = workflow_approvals.workflow_id
        AND (
          (w.account_type = 'freelancer' AND w.account_id = auth.uid()::text)
          OR (w.account_type = 'organization' AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id::text = w.account_id AND uo.user_id = auth.uid()
          ))
        )
    )
  );
