-- 1. Recreate pg_net extension in extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION pg_net SCHEMA extensions;

-- 2. Fix Function Search Paths (Security Definer Search Path Mutable)
ALTER FUNCTION public.check_can_view_channel(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.check_department_dependencies(uuid) SET search_path = public;
ALTER FUNCTION public.create_default_org_channels() SET search_path = public;
ALTER FUNCTION public.create_project_channel() SET search_path = public;
ALTER FUNCTION public.delete_department_safe(uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.log_task_activity() SET search_path = public;
ALTER FUNCTION public.notify_project_member_assigned() SET search_path = public;
ALTER FUNCTION public.notify_task_assignee() SET search_path = public;
ALTER FUNCTION public.trg_trim_organization_name() SET search_path = public;

-- 3. Restrict Execution of SECURITY DEFINER Functions (Revoke from Public / Anon)
REVOKE EXECUTE ON FUNCTION public.check_can_view_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_can_view_channel(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_department_dependencies(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_department_dependencies(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_default_org_channels() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_default_org_channels() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_project_channel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_channel() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_department_safe(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_department_safe(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_task_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_task_activity() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.notify_project_member_assigned() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_project_member_assigned() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.notify_task_assignee() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_task_assignee() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.trg_trim_organization_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_trim_organization_name() TO authenticated, service_role;

-- 4. Harden Permissive RLS Policies (rls_policy_always_true)
DROP POLICY IF EXISTS "Members can insert channel keys" ON public.channel_keys;
CREATE POLICY "Members can insert channel keys" ON public.channel_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = channel_keys.channel_id 
        AND user_id = (select auth.uid())::uuid
    )
  );

DROP POLICY IF EXISTS "Anyone can create an org" ON public.organizations;
CREATE POLICY "Anyone can create an org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can log task activity" ON public.task_activity;
CREATE POLICY "System can log task activity" ON public.task_activity
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid())::uuid);

-- 5. Recreate public.on_new_chat_message (since pg_net cascade drop removed it)
CREATE OR REPLACE FUNCTION public.on_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_token RECORD;
  sender_name TEXT;
  message_preview TEXT;
  channel_name TEXT;
BEGIN
  -- Get sender's full name
  SELECT full_name INTO sender_name FROM public.users WHERE id = NEW.sender_id;
  IF sender_name IS NULL THEN
    sender_name := 'Someone';
  END IF;

  -- Prepare message preview
  IF NEW.content LIKE '__E2EE__:%' THEN
    message_preview := '🔒 Encrypted Message';
  ELSE
    message_preview := substring(NEW.content from 1 for 100);
  END IF;

  -- Get channel details to determine title
  SELECT name INTO channel_name FROM public.chat_channels WHERE id = NEW.channel_id;

  -- Loop through all other members of the channel
  FOR recipient_token IN
    SELECT t.token, m.user_id
    FROM public.channel_members m
    JOIN public.user_push_tokens t ON t.user_id = m.user_id
    WHERE m.channel_id = NEW.channel_id AND m.user_id != NEW.sender_id
  LOOP
    -- Send push notification via Expo Push API (now using extensions.http_post)
    PERFORM extensions.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object(
        'to', recipient_token.token,
        'title', sender_name,
        'body', message_preview,
        'sound', 'default',
        'data', json_build_object(
          'channelId', NEW.channel_id,
          'senderId', NEW.sender_id
        )
      )::jsonb
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS tr_on_new_chat_message ON public.chat_messages;
CREATE TRIGGER tr_on_new_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_chat_message();

-- Restrict execution of the new function
REVOKE EXECUTE ON FUNCTION public.on_new_chat_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_new_chat_message() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
