-- FCM Enterprise Setup Migration
-- 1. Upgrade user_push_tokens to include device metadata
ALTER TABLE public.user_push_tokens ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.user_push_tokens ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE public.user_push_tokens ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_push_tokens ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE public.user_push_tokens ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

-- Migrate existing legacy records
UPDATE public.user_push_tokens SET device_id = COALESCE(device_id, 'legacy-' || substring(token from 1 for 12));

ALTER TABLE public.user_push_tokens ALTER COLUMN device_id SET NOT NULL;
ALTER TABLE public.user_push_tokens ALTER COLUMN device_id SET DEFAULT 'default';

-- Deduplicate existing user_push_tokens records before setting primary key
DELETE FROM public.user_push_tokens a
USING public.user_push_tokens b
WHERE a.user_id = b.user_id
  AND a.device_id = b.device_id
  AND a.ctid < b.ctid;

-- Update primary key constraint to support multiple devices per user
ALTER TABLE public.user_push_tokens DROP CONSTRAINT IF EXISTS user_push_tokens_pkey;
ALTER TABLE public.user_push_tokens ADD CONSTRAINT user_push_tokens_pkey PRIMARY KEY (user_id, device_id);

-- 2. Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id                UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  chat_enabled           BOOLEAN DEFAULT true,
  meetings_enabled       BOOLEAN DEFAULT true,
  tasks_enabled          BOOLEAN DEFAULT true,
  finance_enabled        BOOLEAN DEFAULT true,
  announcements_enabled  BOOLEAN DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Preferences policies
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage their own preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- 3. Add delivery tracking fields to notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'queued';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER DEFAULT 0;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivery_error TEXT;

-- 4. Update database trigger function to route notifications through the Node.js backend
CREATE OR REPLACE FUNCTION public.on_new_notification_inserted()
RETURNS trigger AS $$
DECLARE
  server_url TEXT := 'https://coreflow-one.vercel.app/api/notifications/send-push';
  auth_secret TEXT := 'cf_internal_push_secret_2026';
BEGIN
  PERFORM net.http_post(
    url := server_url,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || auth_secret
    )::jsonb,
    body := json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id,
      'action_url', NEW.action_url
    )::jsonb,
    timeout_ms := 8000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification dispatch HTTP post failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply linter search_path security settings
ALTER FUNCTION public.on_new_notification_inserted() SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.on_new_notification_inserted() TO authenticated, service_role;
