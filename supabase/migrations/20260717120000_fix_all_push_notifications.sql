-- ─────────────────────────────────────────────────────────────────────────────
-- FIX ALL PUSH NOTIFICATIONS
-- This migration is the definitive, final version of all notification triggers.
-- It ensures:
--   1. All notifications include entity_id, entity_type, action_url for deep linking
--   2. Chat notifications include sender_id for self-message filtering
--   3. on_new_notification_inserted routes through the Node.js FCM backend
--      (which uses Firebase Admin SDK for true background push delivery)
--   4. All triggers are hardened with EXCEPTION blocks
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add sender_id column to notifications for self-message suppression
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.users (id) ON DELETE SET NULL;

-- 2. Fix chat message trigger: insert notifications with sender_id + entity info
CREATE OR REPLACE FUNCTION public.on_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_member RECORD;
  sender_name TEXT;
  message_preview TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name FROM public.users WHERE id = NEW.sender_id;
  IF sender_name IS NULL THEN
    sender_name := 'Someone';
  END IF;

  -- Prepare message preview (mask E2EE content)
  IF NEW.content LIKE '__E2EE__:%' THEN
    message_preview := '🔒 Encrypted Message';
  ELSE
    message_preview := substring(NEW.content FROM 1 FOR 100);
  END IF;

  -- Insert notification for each channel member except the sender
  FOR recipient_member IN
    SELECT DISTINCT user_id
    FROM public.channel_members
    WHERE channel_id = NEW.channel_id
      AND user_id != NEW.sender_id
  LOOP
    BEGIN
      INSERT INTO public.notifications (
        user_id, title, message, type, entity_id, entity_type, action_url, is_read, sender_id
      ) VALUES (
        recipient_member.user_id,
        sender_name,
        message_preview,
        'chat',
        NEW.channel_id,
        'chat_channel',
        '/chat/' || NEW.channel_id::TEXT,
        FALSE,
        NEW.sender_id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[on_new_chat_message] Failed to insert notification for user %: %', recipient_member.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.on_new_chat_message() SET search_path = public, pg_temp;

GRANT
EXECUTE ON FUNCTION public.on_new_chat_message () TO authenticated,
service_role;

-- 3. Fix task assignment trigger: add entity_id, entity_type, action_url
CREATE OR REPLACE FUNCTION public.notify_task_assignee()
RETURNS trigger AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS DISTINCT FROM NEW.assignee_id OR TG_OP = 'INSERT') THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
      VALUES (
        NEW.assignee_id,
        'Task Assigned',
        'You have been assigned to: ' || NEW.title,
        'task_assigned',
        NEW.id,
        'task',
        '/tasks/' || NEW.id::TEXT,
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_task_assignee] Failed to insert notification: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.notify_task_assignee() SET search_path = public, pg_temp;

GRANT
EXECUTE ON FUNCTION public.notify_task_assignee () TO authenticated,
service_role;

-- 4. Fix meeting notifications trigger (add proper entity info)
CREATE OR REPLACE FUNCTION public.notify_meeting_attendees()
RETURNS trigger AS $$
DECLARE
  attendee RECORD;
  action_msg TEXT;
  notif_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_msg := 'New meeting scheduled: ' || NEW.title;
    notif_type := 'meeting_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_cancelled = TRUE AND OLD.is_cancelled = FALSE THEN
      action_msg := 'Meeting cancelled: ' || NEW.title;
      notif_type := 'meeting_cancelled';
    ELSIF NEW.title != OLD.title OR NEW.start_time != OLD.start_time THEN
      action_msg := 'Meeting updated: ' || NEW.title;
      notif_type := 'meeting_updated';
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  FOR attendee IN
    SELECT user_id FROM public.meeting_attendees WHERE meeting_id = COALESCE(NEW.id, OLD.id)
  LOOP
    IF attendee.user_id != COALESCE(NEW.creator_id, OLD.creator_id) THEN
      BEGIN
        INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
        VALUES (
          attendee.user_id,
          'Meeting Update',
          action_msg,
          notif_type,
          COALESCE(NEW.id, OLD.id),
          'meeting',
          '/meetings/' || COALESCE(NEW.id, OLD.id)::TEXT,
          FALSE
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify_meeting_attendees] Failed to insert notification: %', SQLERRM;
      END;
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.notify_meeting_attendees() SET search_path = public, pg_temp;

GRANT
EXECUTE ON FUNCTION public.notify_meeting_attendees () TO authenticated,
service_role;

-- Re-register meeting trigger
DROP TRIGGER IF EXISTS tr_notify_meeting_attendees ON public.meetings;

CREATE TRIGGER tr_notify_meeting_attendees
  AFTER INSERT OR UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_meeting_attendees();

-- 5. THE CRITICAL FIX: on_new_notification_inserted must route through Node.js FCM backend
--    for true background push delivery. The Node.js server uses Firebase Admin SDK.
CREATE OR REPLACE FUNCTION public.on_new_notification_inserted()
RETURNS trigger AS $$
DECLARE
  server_url TEXT := 'https://coreflow-one.vercel.app/api/notifications/send-push';
  auth_secret TEXT := 'cf_internal_push_secret_2026';
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := server_url,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || auth_secret
      )::jsonb,
      body := json_build_object(
        'id',          NEW.id,
        'user_id',     NEW.user_id,
        'title',       NEW.title,
        'message',     NEW.message,
        'type',        COALESCE(NEW.type, 'general'),
        'entity_type', COALESCE(NEW.entity_type, ''),
        'entity_id',   COALESCE(NEW.entity_id::TEXT, ''),
        'action_url',  COALESCE(NEW.action_url, ''),
        'sender_id',   COALESCE(NEW.sender_id::TEXT, '')
      )::jsonb,
      timeout_ms := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[on_new_notification_inserted] FCM dispatch HTTP post failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.on_new_notification_inserted() SET search_path = public, pg_temp;

GRANT
EXECUTE ON FUNCTION public.on_new_notification_inserted () TO authenticated,
service_role;

-- Ensure trigger is registered (in case it was dropped)
DROP TRIGGER IF EXISTS tr_push_notification_on_insert ON public.notifications;

CREATE TRIGGER tr_push_notification_on_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE PROCEDURE public.on_new_notification_inserted();

-- 6. Fix invoice notification trigger with proper entity info (already good but ensure hardened)
CREATE OR REPLACE FUNCTION public.notify_invoice_updates()
RETURNS trigger AS $$
DECLARE
  org_owner RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR org_owner IN
      SELECT u.id
      FROM public.users u
      JOIN public.user_organizations uo ON u.id = uo.user_id
      WHERE uo.org_id = NEW.organization_id AND u.role IN ('managing_director', 'ceo', 'cto', 'owner', 'admin')
    LOOP
      BEGIN
        INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
        VALUES (
          org_owner.id,
          'Invoice Created',
          'New invoice (' || NEW.invoice_number || ') for ' || COALESCE(NEW.client_name, 'Client'),
          'invoice_created',
          NEW.id,
          'invoice',
          '/invoices/' || NEW.id::TEXT,
          FALSE
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify_invoice_updates] Failed to insert notification: %', SQLERRM;
      END;
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
      FOR org_owner IN
        SELECT u.id
        FROM public.users u
        JOIN public.user_organizations uo ON u.id = uo.user_id
        WHERE uo.org_id = NEW.organization_id AND u.role IN ('managing_director', 'ceo', 'cto', 'owner', 'admin')
      LOOP
        BEGIN
          INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
          VALUES (
            org_owner.id,
            'Invoice Paid 💰',
            'Payment received for invoice ' || NEW.invoice_number,
            'invoice_paid',
            NEW.id,
            'invoice',
            '/invoices/' || NEW.id::TEXT,
            FALSE
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[notify_invoice_updates] Failed to insert notification: %', SQLERRM;
        END;
      END LOOP;
    ELSIF NEW.status = 'overdue' AND OLD.status != 'overdue' THEN
      FOR org_owner IN
        SELECT u.id
        FROM public.users u
        JOIN public.user_organizations uo ON u.id = uo.user_id
        WHERE uo.org_id = NEW.organization_id AND u.role IN ('managing_director', 'ceo', 'cto', 'owner', 'admin')
      LOOP
        BEGIN
          INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
          VALUES (
            org_owner.id,
            'Invoice Overdue ⚠️',
            'Invoice ' || NEW.invoice_number || ' is now overdue',
            'invoice_overdue',
            NEW.id,
            'invoice',
            '/invoices/' || NEW.id::TEXT,
            FALSE
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[notify_invoice_updates] Failed to insert notification: %', SQLERRM;
        END;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.notify_invoice_updates() SET search_path = public, pg_temp;

GRANT
EXECUTE ON FUNCTION public.notify_invoice_updates () TO authenticated,
service_role;

DROP TRIGGER IF EXISTS tr_notify_invoice_updates ON public.invoices;

CREATE TRIGGER tr_notify_invoice_updates
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_invoice_updates();

-- 7. Add project member join notification
CREATE OR REPLACE FUNCTION public.notify_project_member_added()
RETURNS trigger AS $$
DECLARE
  project_title TEXT;
BEGIN
  SELECT title INTO project_title FROM public.projects WHERE id = NEW.project_id;

  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
    VALUES (
      NEW.user_id,
      'Added to Project',
      'You have been added to project: ' || COALESCE(project_title, 'a project'),
      'project_member_added',
      NEW.project_id,
      'project',
      '/projects/' || NEW.project_id::TEXT,
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_project_member_added] Failed to insert notification: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.notify_project_member_added() SET search_path = public, pg_temp;

GRANT
EXECUTE ON FUNCTION public.notify_project_member_added () TO authenticated,
service_role;

DROP TRIGGER IF EXISTS tr_notify_project_member_added ON public.project_members;

CREATE TRIGGER tr_notify_project_member_added
  AFTER INSERT ON public.project_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_project_member_added();

NOTIFY pgrst, 'reload schema';