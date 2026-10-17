-- Audit Logs Indexes Migration

-- Since audit_logs is already created in 20260712120000_freelancer_workspace_extensions.sql
-- We simply add missing indexes for performance optimization

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created_at ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);

-- Deny all INSERT/UPDATE/DELETE from client (Must be done via service role / backend)
-- Note: if policies already exist, these might be redundant but safe to add
CREATE POLICY "Deny insert from client" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny update from client" ON public.audit_logs FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny delete from client" ON public.audit_logs FOR DELETE TO authenticated USING (false);
