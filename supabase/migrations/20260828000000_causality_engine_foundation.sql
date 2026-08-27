-- ============================================================
-- CoreFlow Enterprise — Project Causality Engine Foundation
-- Migration: 20260828000000_causality_engine_foundation.sql
-- ============================================================

-- 1. Project Commitments (Immutable Baselines V1 -> Vn)
CREATE TABLE IF NOT EXISTS public.project_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  delivery_date DATE NOT NULL,
  scope_count INT NOT NULL DEFAULT 0,
  deliverables_summary JSONB DEFAULT '[]'::jsonb,
  change_reason TEXT,
  change_request_id UUID,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  effective_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, version_number)
);

-- 2. Formal Change Requests (CR)
CREATE TABLE IF NOT EXISTS public.project_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cr_code VARCHAR(50) NOT NULL, -- e.g. 'CR-001'
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requester_type VARCHAR(50) NOT NULL DEFAULT 'client' CHECK (requester_type IN ('client', 'owner', 'lead')),
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'submitted', 'in_review', 'accepted', 'rejected', 'withdrawn')),
  
  -- Impact Matrix (Deterministic)
  cost_impact NUMERIC(14,2) NOT NULL DEFAULT 0,
  schedule_impact_days INT NOT NULL DEFAULT 0,
  scope_impact_count INT NOT NULL DEFAULT 0,
  engineering_hours_impact NUMERIC(8,2) DEFAULT 0,
  
  -- Resulting baseline snapshot
  resulting_cost NUMERIC(14,2),
  resulting_delivery_date DATE,
  resulting_scope_count INT,
  
  client_decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Project Events (Core Causality Log)
CREATE TABLE IF NOT EXISTS public.project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'PROJECT_CREATED', 'CR_ACCEPTED', 'MILESTONE_COMPLETED', 'DELIVERY_CHANGED', etc.
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role VARCHAR(50),
  title TEXT NOT NULL,
  description TEXT,
  visibility VARCHAR(50) NOT NULL DEFAULT 'CLIENT_VISIBLE' 
    CHECK (visibility IN ('INTERNAL', 'CLIENT_VISIBLE', 'CLIENT_ACTION_REQUIRED', 'SHARED_AFTER_APPROVAL')),
  impact_summary JSONB DEFAULT '{}'::jsonb, -- e.g. { "costDelta": 7000, "daysDelta": 3, "scopeDelta": 1 }
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Event Relationships (Graph Edges for Project DNA & WHY)
CREATE TABLE IF NOT EXISTS public.project_event_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_event_id UUID NOT NULL REFERENCES public.project_events(id) ON DELETE CASCADE,
  target_event_id UUID NOT NULL REFERENCES public.project_events(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
    'caused_by', 'requested_by', 'approved_by', 'affects', 'depends_on', 
    'blocks', 'unlocks', 'generated', 'replaced', 'superseded_by', 
    'fulfilled_by', 'verified_by', 'resulted_in'
  )),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_event_id, target_event_id, relationship_type)
);

-- 5. Project Evidence Vault
CREATE TABLE IF NOT EXISTS public.project_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.project_events(id) ON DELETE SET NULL,
  evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN (
    'task', 'milestone', 'deliverable', 'file', 'approval', 'meeting_decision',
    'change_request', 'invoice', 'payment', 'test_result', 'client_acceptance'
  )),
  reference_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  status VARCHAR(50) DEFAULT 'verified',
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Project Receipts & Seal (Permanent Verification)
CREATE TABLE IF NOT EXISTS public.project_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'CF-PR-00291'
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  receipt_type VARCHAR(50) NOT NULL CHECK (receipt_type IN (
    'client_approval', 'scope_change', 'cost_change', 'delivery_change',
    'milestone_acceptance', 'deliverable_acceptance', 'payment', 'project_seal'
  )),
  title TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_to_name TEXT,
  issued_to_email TEXT,
  signer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ DEFAULT now(),
  is_immutable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Responsibility Tracker
CREATE TABLE IF NOT EXISTS public.project_responsibility_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  held_by VARCHAR(50) NOT NULL CHECK (held_by IN ('PROJECT_OWNER', 'CLIENT')),
  action_item TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds BIGINT,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'transferred'))
);

-- Indexes for lightning fast causality traversal
CREATE INDEX IF NOT EXISTS idx_project_commitments_proj ON public.project_commitments(project_id, version_number);
CREATE INDEX IF NOT EXISTS idx_project_change_requests_proj ON public.project_change_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_events_proj ON public.project_events(project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_project_events_visibility ON public.project_events(project_id, visibility);
CREATE INDEX IF NOT EXISTS idx_project_event_rel_source ON public.project_event_relationships(source_event_id);
CREATE INDEX IF NOT EXISTS idx_project_event_rel_target ON public.project_event_relationships(target_event_id);
CREATE INDEX IF NOT EXISTS idx_project_evidence_proj ON public.project_evidence(project_id, evidence_type);
CREATE INDEX IF NOT EXISTS idx_project_receipts_code ON public.project_receipts(receipt_code);
CREATE INDEX IF NOT EXISTS idx_project_receipts_proj ON public.project_receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_resp_proj ON public.project_responsibility_periods(project_id, status);

-- Enable Row Level Security
ALTER TABLE public.project_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_event_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_responsibility_periods ENABLE ROW LEVEL SECURITY;

-- Helper security policy: Authenticated users who belong to the project org or own the independent project can access
CREATE POLICY "Users can access commitments for their projects"
  ON public.project_commitments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_commitments.project_id
        AND (
          p.owner_id = (select auth.uid())::uuid
          OR p.created_by = (select auth.uid())::uuid
          OR (p.org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = p.org_id AND uo.user_id = (select auth.uid())::uuid
          ))
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = (select auth.uid())::uuid
          )
        )
    )
  );

CREATE POLICY "Users can access change requests for their projects"
  ON public.project_change_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_change_requests.project_id
        AND (
          p.owner_id = (select auth.uid())::uuid
          OR p.created_by = (select auth.uid())::uuid
          OR (p.org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = p.org_id AND uo.user_id = (select auth.uid())::uuid
          ))
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = (select auth.uid())::uuid
          )
        )
    )
  );

CREATE POLICY "Users can access project events for their projects"
  ON public.project_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_events.project_id
        AND (
          p.owner_id = (select auth.uid())::uuid
          OR p.created_by = (select auth.uid())::uuid
          OR (p.org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = p.org_id AND uo.user_id = (select auth.uid())::uuid
          ))
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = (select auth.uid())::uuid
          )
        )
    )
  );

CREATE POLICY "Users can access project event relationships"
  ON public.project_event_relationships FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_event_relationships.project_id
        AND (
          p.owner_id = (select auth.uid())::uuid
          OR p.created_by = (select auth.uid())::uuid
          OR (p.org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = p.org_id AND uo.user_id = (select auth.uid())::uuid
          ))
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = (select auth.uid())::uuid
          )
        )
    )
  );

CREATE POLICY "Users can access evidence"
  ON public.project_evidence FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_evidence.project_id
        AND (
          p.owner_id = (select auth.uid())::uuid
          OR p.created_by = (select auth.uid())::uuid
          OR (p.org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = p.org_id AND uo.user_id = (select auth.uid())::uuid
          ))
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = (select auth.uid())::uuid
          )
        )
    )
  );

CREATE POLICY "Users can access receipts"
  ON public.project_receipts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_receipts.project_id
        AND (
          p.owner_id = (select auth.uid())::uuid
          OR p.created_by = (select auth.uid())::uuid
          OR (p.org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = p.org_id AND uo.user_id = (select auth.uid())::uuid
          ))
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = (select auth.uid())::uuid
          )
        )
    )
  );

CREATE POLICY "Users can access responsibility periods"
  ON public.project_responsibility_periods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_responsibility_periods.project_id
        AND (
          p.owner_id = (select auth.uid())::uuid
          OR p.created_by = (select auth.uid())::uuid
          OR (p.org_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = p.org_id AND uo.user_id = (select auth.uid())::uuid
          ))
          OR EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = (select auth.uid())::uuid
          )
        )
    )
  );
