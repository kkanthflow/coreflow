-- =====================================================================
-- Migration: 20261018010000_subscription_entitlements.sql
-- Description: Usage Ledger, Atomic Quota Enforcement Triggers & Functions
--              for Invoices, Projects, Meetings, and Team Seats
-- =====================================================================

-- 1. Subscription Usage Ledger Table
CREATE TABLE IF NOT EXISTS public.subscription_usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL,
  organization_id VARCHAR(64),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_tier VARCHAR(32) NOT NULL DEFAULT 'freelancer',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  invoices_count INTEGER DEFAULT 0 NOT NULL,
  meetings_count INTEGER DEFAULT 0 NOT NULL,
  active_projects_count INTEGER DEFAULT 0 NOT NULL,
  team_seats_count INTEGER DEFAULT 1 NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user ON public.subscription_usage_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_org ON public.subscription_usage_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_period ON public.subscription_usage_ledger(period_start, period_end);

-- 2. Function: Get Effective Subscription Tier & Quotas
CREATE OR REPLACE FUNCTION public.fn_get_effective_limits(
  p_user_id TEXT,
  p_org_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  out_plan_tier VARCHAR(32),
  out_max_seats INTEGER,
  out_max_invoices INTEGER,
  out_max_projects INTEGER,
  out_max_meetings INTEGER,
  out_period_start TIMESTAMPTZ,
  out_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier VARCHAR(32) := 'freelancer';
  v_interval VARCHAR(16) := 'monthly';
  v_sub_start TIMESTAMPTZ;
  v_sub_end TIMESTAMPTZ;
  v_status VARCHAR(32);
  v_months_elapsed INTEGER;
  v_win_start TIMESTAMPTZ;
  v_win_end TIMESTAMPTZ;
BEGIN
  -- Check active subscription for Organization if provided
  IF p_org_id IS NOT NULL AND p_org_id <> '' THEN
    SELECT plan_tier, plan_interval, status, current_period_start, current_period_end
    INTO v_tier, v_interval, v_status, v_sub_start, v_sub_end
    FROM public.subscriptions
    WHERE organization_id = p_org_id AND status IN ('active', 'authenticated')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Fallback to User-level active subscription if no org sub
  IF v_sub_start IS NULL AND p_user_id IS NOT NULL AND p_user_id <> '' THEN
    SELECT plan_tier, plan_interval, status, current_period_start, current_period_end
    INTO v_tier, v_interval, v_status, v_sub_start, v_sub_end
    FROM public.subscriptions
    WHERE user_id = p_user_id AND status IN ('active', 'authenticated')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- If still no active sub record, fallback to current_plan_tier in organizations or users
  IF v_sub_start IS NULL THEN
    IF p_org_id IS NOT NULL AND p_org_id <> '' THEN
      SELECT COALESCE(current_plan_tier, 'freelancer') INTO v_tier
      FROM public.organizations WHERE id = p_org_id::uuid;
    ELSIF p_user_id IS NOT NULL AND p_user_id <> '' THEN
      SELECT COALESCE(current_plan_tier, 'freelancer') INTO v_tier
      FROM public.users WHERE id = p_user_id::uuid;
    END IF;
    v_tier := COALESCE(v_tier, 'freelancer');
  END IF;

  -- Calculate Monthly Window
  IF v_sub_start IS NOT NULL AND v_sub_end IS NOT NULL THEN
    IF v_interval = 'yearly' THEN
      -- Monthly quota window inside annual billing cycle (anchored on start date, avoiding 30-day drift)
      v_months_elapsed := GREATEST(0, (EXTRACT(YEAR FROM NOW()) - EXTRACT(YEAR FROM v_sub_start)) * 12 + (EXTRACT(MONTH FROM NOW()) - EXTRACT(MONTH FROM v_sub_start)));
      v_win_start := v_sub_start + (v_months_elapsed * INTERVAL '1 month');
      IF NOW() < v_win_start AND v_months_elapsed > 0 THEN
        v_win_start := v_sub_start + ((v_months_elapsed - 1) * INTERVAL '1 month');
      END IF;
      v_win_end := v_win_start + INTERVAL '1 month';
      IF v_win_end > v_sub_end THEN
        v_win_end := v_sub_end;
      END IF;
    ELSE
      -- Monthly subscription cycle
      v_win_start := v_sub_start;
      v_win_end := v_sub_end;
    END IF;
  ELSE
    -- Default calendar month window for baseline/free accounts
    v_win_start := date_trunc('month', NOW() AT TIME ZONE 'UTC');
    v_win_end := v_win_start + INTERVAL '1 month';
  END IF;

  out_plan_tier := v_tier;
  out_period_start := v_win_start;
  out_period_end := v_win_end;

  IF v_tier = 'pro' THEN
    out_max_seats := NULL;
    out_max_invoices := NULL;
    out_max_projects := NULL;
    out_max_meetings := NULL;
  ELSIF v_tier = 'starter' THEN
    out_max_seats := 5;
    out_max_invoices := 100;
    out_max_projects := 25;
    out_max_meetings := 100;
  ELSE -- freelancer
    out_max_seats := 1;
    out_max_invoices := 15;
    out_max_projects := 5;
    out_max_meetings := 20;
  END IF;

  RETURN NEXT;
END;
$$;

-- 3. Atomic Quota Trigger for Invoices
CREATE OR REPLACE FUNCTION public.trg_enforce_invoice_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_current_count INTEGER;
  v_user_id TEXT;
  v_org_id TEXT;
BEGIN
  v_user_id := COALESCE(NEW.owner_id::text, NEW.creator_id::text, auth.uid()::text);
  v_org_id := NEW.organization_id::text;

  SELECT * INTO v_limits FROM public.fn_get_effective_limits(v_user_id, v_org_id);

  IF v_limits.out_max_invoices IS NOT NULL THEN
    -- Count non-deleted invoices within the current billing/monthly window
    SELECT COUNT(*) INTO v_current_count
    FROM public.invoices
    WHERE ((v_org_id IS NOT NULL AND organization_id = NEW.organization_id)
        OR (v_org_id IS NULL AND owner_id = NEW.owner_id))
      AND is_deleted = false
      AND created_at >= v_limits.out_period_start
      AND created_at < v_limits.out_period_end;

    IF v_current_count >= v_limits.out_max_invoices THEN
      RAISE EXCEPTION 'quota_exceeded:invoices: Monthly invoice quota of % reached for % tier (% used). Window resets on %.',
        v_limits.out_max_invoices, v_limits.out_plan_tier, v_current_count, v_limits.out_period_end
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_invoice_quota_before_insert ON public.invoices;
CREATE TRIGGER check_invoice_quota_before_insert
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_invoice_quota();

-- 4. Atomic Quota Trigger for Projects
CREATE OR REPLACE FUNCTION public.trg_enforce_project_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_active_count INTEGER;
  v_user_id TEXT;
  v_org_id TEXT;
BEGIN
  v_user_id := COALESCE(NEW.owner_id::text, NEW.created_by::text, auth.uid()::text);
  v_org_id := NEW.org_id::text;

  SELECT * INTO v_limits FROM public.fn_get_effective_limits(v_user_id, v_org_id);

  IF v_limits.out_max_projects IS NOT NULL THEN
    -- Count active projects excluding completed, archived, and deleted
    SELECT COUNT(*) INTO v_active_count
    FROM public.projects
    WHERE ((v_org_id IS NOT NULL AND org_id = NEW.org_id)
        OR (v_org_id IS NULL AND owner_id = NEW.owner_id))
      AND status NOT IN ('completed', 'archived')
      AND deleted_at IS NULL;

    IF v_active_count >= v_limits.out_max_projects THEN
      RAISE EXCEPTION 'quota_exceeded:projects: Active project quota of % reached for % tier (% active). Please complete or archive projects or upgrade at /pricing.',
        v_limits.out_max_projects, v_limits.out_plan_tier, v_active_count
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_project_quota_before_insert ON public.projects;
CREATE TRIGGER check_project_quota_before_insert
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_project_quota();

-- 5. Updated create_project_with_member RPC with Atomic Project Quota Check
CREATE OR REPLACE FUNCTION public.create_project_with_member(
  p_title        TEXT,
  p_description  TEXT       DEFAULT NULL,
  p_priority     TEXT       DEFAULT 'medium',
  p_cover_color  TEXT       DEFAULT '#1F6FEB',
  p_status       TEXT       DEFAULT 'active',
  p_due_date     TEXT       DEFAULT NULL,
  p_department_id TEXT      DEFAULT NULL,
  p_org_id       TEXT       DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
  v_result JSONB;
  v_due_date DATE;
  v_department_id UUID;
  v_org_id UUID;
  v_limits RECORD;
  v_active_count INTEGER;
BEGIN
  -- 1. Resolve the calling user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Convert and cast parameters
  v_due_date := NULLIF(p_due_date, '')::DATE;
  v_department_id := NULLIF(p_department_id, '')::UUID;
  v_org_id := NULLIF(p_org_id, '')::UUID;

  -- 2. Authorization: user must belong to the org (if org-scoped)
  IF v_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = v_org_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'You are not a member of this organization';
    END IF;
  END IF;

  -- 3. Atomic Quota Verification
  SELECT * INTO v_limits FROM public.fn_get_effective_limits(v_user_id::text, p_org_id);

  IF v_limits.out_max_projects IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.projects
    WHERE ((v_org_id IS NOT NULL AND org_id = v_org_id)
        OR (v_org_id IS NULL AND owner_id = v_user_id))
      AND status NOT IN ('completed', 'archived')
      AND deleted_at IS NULL;

    IF v_active_count >= v_limits.out_max_projects THEN
      RAISE EXCEPTION 'quota_exceeded:projects: Active project quota of % reached for % tier (% active). Upgrade at /pricing.',
        v_limits.out_max_projects, v_limits.out_plan_tier, v_active_count
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 4. Insert the project
  INSERT INTO public.projects (
    title, description, priority, cover_color, status,
    owner_id, created_by, due_date, department_id, org_id
  ) VALUES (
    p_title, p_description, p_priority, p_cover_color, p_status,
    v_user_id, v_user_id, v_due_date, v_department_id, v_org_id
  )
  RETURNING id INTO v_project_id;

  -- 5. Add creator as project owner member
  INSERT INTO public.project_members (project_id, user_id, role, is_active, added_by)
  VALUES (v_project_id, v_user_id, 'owner', true, v_user_id)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner', is_active = true;

  -- 6. Return created project
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'priority', p.priority,
    'cover_color', p.cover_color,
    'status', p.status,
    'owner_id', p.owner_id,
    'created_by', p.created_by,
    'due_date', p.due_date,
    'department_id', p.department_id,
    'org_id', p.org_id,
    'created_at', p.created_at
  ) INTO v_result
  FROM public.projects p
  WHERE p.id = v_project_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 6. Atomic Quota Trigger for Meetings
CREATE OR REPLACE FUNCTION public.trg_enforce_meeting_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_current_count INTEGER;
  v_user_id TEXT;
  v_org_id TEXT := NULL;
BEGIN
  v_user_id := COALESCE(NEW.host_id::text, auth.uid()::text);

  -- If workspace_id is provided, check if it maps to an organization
  IF NEW.workspace_id IS NOT NULL THEN
    SELECT organization_id::text INTO v_org_id
    FROM public.workspaces
    WHERE id = NEW.workspace_id;
  END IF;

  SELECT * INTO v_limits FROM public.fn_get_effective_limits(v_user_id, v_org_id);

  IF v_limits.out_max_meetings IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_count
    FROM public.meetings
    WHERE host_id = NEW.host_id
      AND created_at >= v_limits.out_period_start
      AND created_at < v_limits.out_period_end;

    IF v_current_count >= v_limits.out_max_meetings THEN
      RAISE EXCEPTION 'quota_exceeded:meetings: Monthly meeting quota of % reached for % tier (% used). Window resets on %.',
        v_limits.out_max_meetings, v_limits.out_plan_tier, v_current_count, v_limits.out_period_end
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_meeting_quota_before_insert ON public.meetings;
CREATE TRIGGER check_meeting_quota_before_insert
  BEFORE INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_meeting_quota();

-- 7. Atomic Quota Trigger for Team Seats (user_organizations)
CREATE OR REPLACE FUNCTION public.trg_enforce_seats_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limits RECORD;
  v_current_seats INTEGER;
BEGIN
  SELECT * INTO v_limits FROM public.fn_get_effective_limits(NEW.user_id::text, NEW.org_id::text);

  IF v_limits.out_max_seats IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_seats
    FROM public.user_organizations
    WHERE org_id = NEW.org_id;

    IF v_current_seats >= v_limits.out_max_seats THEN
      RAISE EXCEPTION 'quota_exceeded:seats: Organization team seat limit of % reached for % tier (% active seats). Please upgrade at /pricing to add more members.',
        v_limits.out_max_seats, v_limits.out_plan_tier, v_current_seats
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_seats_quota_before_insert ON public.user_organizations;
CREATE TRIGGER check_seats_quota_before_insert
  BEFORE INSERT ON public.user_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_seats_quota();

-- 8. Row Level Security on Usage Ledger
ALTER TABLE public.subscription_usage_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage ledger" ON public.subscription_usage_ledger;
CREATE POLICY "Users can view own usage ledger"
  ON public.subscription_usage_ledger FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()::text OR
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = organization_id::uuid AND user_id = auth.uid()
    ))
  );

NOTIFY pgrst, 'reload schema';
