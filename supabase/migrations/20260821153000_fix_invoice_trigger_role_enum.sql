-- Migration: Fix user_role enum cast error in notify_invoice_updates trigger and extend user_role enum
-- Description: The notify_invoice_updates trigger previously checked u.role IN ('managing_director', 'ceo', 'cto', 'owner', 'admin').
-- In Postgres, 'admin' is not a valid member of enum user_role ('administrator' is the valid value).
-- Comparing enum column u.role with text literal 'admin' caused runtime error:
-- "invalid input value for enum user_role: "admin"" on invoice inserts and updates.

-- 1. Ensure all standard roles exist in enum user_role
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrator';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Fix the notify_invoice_updates function to cast u.role to TEXT and check proper role names
CREATE OR REPLACE FUNCTION public.notify_invoice_updates()
RETURNS trigger AS $$
DECLARE
  org_owner RECORD;
  client_title TEXT := 'Client';
BEGIN
  -- Resolve client name if available
  IF NEW.client_id IS NOT NULL THEN
    SELECT COALESCE(company_name, name) INTO client_title
    FROM public.clients
    WHERE id = NEW.client_id;
    IF client_title IS NULL THEN
      client_title := 'Client';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS NOT NULL THEN
      FOR org_owner IN
        SELECT u.id
        FROM public.users u
        JOIN public.user_organizations uo ON u.id = uo.user_id
        WHERE uo.org_id = NEW.organization_id 
          AND u.role::TEXT IN ('managing_director', 'ceo', 'cto', 'owner', 'administrator', 'admin')
      LOOP
        BEGIN
          INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
          VALUES (
            org_owner.id,
            'Invoice Created',
            'New invoice (' || COALESCE(NEW.invoice_number, 'Draft') || ') for ' || client_title,
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
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS NOT NULL THEN
      IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
        FOR org_owner IN
          SELECT u.id
          FROM public.users u
          JOIN public.user_organizations uo ON u.id = uo.user_id
          WHERE uo.org_id = NEW.organization_id 
            AND u.role::TEXT IN ('managing_director', 'ceo', 'cto', 'owner', 'administrator', 'admin')
        LOOP
          BEGIN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
            VALUES (
              org_owner.id,
              'Invoice Paid 💰',
              'Payment received for invoice ' || COALESCE(NEW.invoice_number, 'Invoice'),
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
      ELSIF NEW.status = 'overdue' AND (OLD.status IS NULL OR OLD.status != 'overdue') THEN
        FOR org_owner IN
          SELECT u.id
          FROM public.users u
          JOIN public.user_organizations uo ON u.id = uo.user_id
          WHERE uo.org_id = NEW.organization_id 
            AND u.role::TEXT IN ('managing_director', 'ceo', 'cto', 'owner', 'administrator', 'admin')
        LOOP
          BEGIN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
            VALUES (
              org_owner.id,
              'Invoice Overdue ⚠️',
              'Invoice ' || COALESCE(NEW.invoice_number, 'Invoice') || ' is now overdue',
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.notify_invoice_updates() SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.notify_invoice_updates() TO authenticated, service_role;

-- Rebind trigger cleanly
DROP TRIGGER IF EXISTS tr_notify_invoice_updates ON public.invoices;

CREATE TRIGGER tr_notify_invoice_updates
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_invoice_updates();

NOTIFY pgrst, 'reload schema';
