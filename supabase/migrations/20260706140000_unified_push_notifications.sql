-- Migration to implement unified push notifications for all system events

-- 1. Global Dispatcher to Send Expo Push Notifications when a notification is inserted
CREATE OR REPLACE FUNCTION public.on_new_notification_inserted()
RETURNS trigger AS $$
DECLARE
  recipient_token RECORD;
BEGIN
  -- Loop through all push tokens belonging to the notified user
  FOR recipient_token IN
    SELECT token FROM public.user_push_tokens WHERE user_id = NEW.user_id
  LOOP
    -- Post to Expo API
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object(
        'to', recipient_token.token,
        'title', NEW.title,
        'body', NEW.message,
        'sound', 'default',
        'data', json_build_object(
          'id', NEW.id,
          'type', NEW.type,
          'entity_type', NEW.entity_type,
          'entity_id', NEW.entity_id,
          'action_url', NEW.action_url
        )
      )::jsonb,
      timeout_ms := 5000
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_push_notification_on_insert ON public.notifications;
CREATE TRIGGER tr_push_notification_on_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE PROCEDURE public.on_new_notification_inserted();


-- 2. Meetings Triggers
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
    ELSE
      action_msg := 'Meeting details updated: ' || NEW.title;
      notif_type := 'meeting_updated';
    END IF;
  END IF;

  -- Notify all attendees registered for this meeting
  FOR attendee IN
    SELECT user_id FROM public.meeting_attendees WHERE meeting_id = COALESCE(NEW.id, OLD.id)
  LOOP
    IF attendee.user_id != COALESCE(NEW.creator_id, OLD.creator_id) THEN
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
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_meeting_attendees ON public.meetings;
CREATE TRIGGER tr_notify_meeting_attendees
  AFTER INSERT OR UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_meeting_attendees();


-- 3. Additional Tasks Triggers (Priority Change, Completion)
CREATE OR REPLACE FUNCTION public.notify_task_updates()
RETURNS trigger AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    -- Task Completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
      VALUES (
        NEW.assignee_id,
        'Task Completed',
        'Your assigned task has been marked completed: ' || NEW.title,
        'task_completed',
        NEW.id,
        'task',
        '/tasks/' || NEW.id::TEXT,
        FALSE
      );
    -- Priority changed
    ELSIF NEW.priority != OLD.priority THEN
      INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
      VALUES (
        NEW.assignee_id,
        'Task Priority Updated',
        'Task "' || NEW.title || '" priority changed to ' || NEW.priority,
        'task_priority_changed',
        NEW.id,
        'task',
        '/tasks/' || NEW.id::TEXT,
        FALSE
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_task_updates ON public.tasks;
CREATE TRIGGER tr_notify_task_updates
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_task_updates();


-- 4. Projects Triggers (Archived, Milestone/Updated)
CREATE OR REPLACE FUNCTION public.notify_project_updates()
RETURNS trigger AS $$
DECLARE
  member RECORD;
  msg TEXT;
  notif_type TEXT;
BEGIN
  IF NEW.status != OLD.status THEN
    IF NEW.status = 'archived' THEN
      msg := 'Project archived: ' || NEW.title;
      notif_type := 'project_archived';
    ELSIF NEW.status = 'completed' THEN
      msg := 'Project completed: ' || NEW.title;
      notif_type := 'project_completed';
    ELSE
      msg := 'Project status updated to ' || NEW.status || ': ' || NEW.title;
      notif_type := 'project_updated';
    END IF;

    -- Notify all project members
    FOR member IN
      SELECT user_id FROM public.project_members WHERE project_id = NEW.id AND is_active = TRUE
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
      VALUES (
        member.user_id,
        'Project Update',
        msg,
        notif_type,
        NEW.id,
        'project',
        '/projects/' || NEW.id::TEXT,
        FALSE
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_project_updates ON public.projects;
CREATE TRIGGER tr_notify_project_updates
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_project_updates();


-- 5. Invoices Triggers (Created, Paid, Overdue)
CREATE OR REPLACE FUNCTION public.notify_invoice_updates()
RETURNS trigger AS $$
DECLARE
  org_owner RECORD;
BEGIN
  -- Invoice Created (Notify organization owners)
  IF TG_OP = 'INSERT' THEN
    FOR org_owner IN
      SELECT u.id 
      FROM public.users u
      JOIN public.user_organizations uo ON u.id = uo.user_id
      WHERE uo.org_id = NEW.organization_id AND u.role IN ('managing_director', 'ceo', 'cto')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
      VALUES (
        org_owner.id,
        'Invoice Created',
        'A new invoice (' || NEW.invoice_number || ') has been generated for ' || COALESCE(NEW.client_name, 'Client'),
        'invoice_created',
        NEW.id,
        'invoice',
        '/invoices/' || NEW.id::TEXT,
        FALSE
      );
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Invoice Paid
    IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
      FOR org_owner IN
        SELECT u.id 
        FROM public.users u
        JOIN public.user_organizations uo ON u.id = uo.user_id
        WHERE uo.org_id = NEW.organization_id AND u.role IN ('managing_director', 'ceo', 'cto')
      LOOP
        INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
        VALUES (
          org_owner.id,
          'Invoice Paid',
          'Payment received for invoice ' || NEW.invoice_number,
          'invoice_paid',
          NEW.id,
          'invoice',
          '/invoices/' || NEW.id::TEXT,
          FALSE
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_invoice_updates ON public.invoices;
CREATE TRIGGER tr_notify_invoice_updates
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_invoice_updates();
