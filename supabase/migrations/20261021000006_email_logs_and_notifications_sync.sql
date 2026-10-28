-- 20261021000006_email_logs_and_notifications_sync.sql
-- Complete audit and delivery logging for Resend email service and notification preferences

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  resend_id TEXT,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Enable RLS on email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_logs;
CREATE POLICY "Users can view own email logs" ON public.email_logs FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR (
      organization_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.user_organizations 
        WHERE user_organizations.org_id = email_logs.organization_id 
          AND user_organizations.user_id = auth.uid() 
          AND user_organizations.role IN ('owner', 'admin', 'administrator')
      )
    )
  );

DROP POLICY IF EXISTS "Service role can manage email logs" ON public.email_logs;
CREATE POLICY "Service role can manage email logs" ON public.email_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Notification preferences email extensions
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS email_task_updates BOOLEAN DEFAULT true;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS email_financial_alerts BOOLEAN DEFAULT true;
ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS email_invitations BOOLEAN DEFAULT true;

-- Indexes for lightning-fast queries & deduplication
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_idempotency_key ON public.email_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
