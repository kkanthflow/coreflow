-- ============================================================
-- AUVRYN Enterprise: Client Portal Accounts & Portal Lifecycle
-- Migration: 20261021000000_client_portal_accounts_and_status.sql
-- ============================================================

-- 1. Add portal status and lifecycle columns to public.clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS portal_status VARCHAR(30) DEFAULT 'no_access' 
  CHECK (portal_status IN ('no_access', 'pending_login', 'active', 'disabled')),
ADD COLUMN IF NOT EXISTS portal_enabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS portal_last_login_at TIMESTAMPTZ;

-- 2. Create index on portal_status for quick filtering
CREATE INDEX IF NOT EXISTS idx_clients_portal_status ON public.clients(portal_status);

-- 3. Prevent duplicate client emails within the same business
-- In Auvryn, a business is either an organization (organization_id IS NOT NULL)
-- or an independent freelancer/owner (organization_id IS NULL, owner_id IS NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_business_email 
ON public.clients (COALESCE(organization_id, owner_id), LOWER(TRIM(email))) 
WHERE is_deleted = false AND email IS NOT NULL;

-- 4. Set existing linked clients to 'active' or 'pending_login'
UPDATE public.clients
SET portal_status = CASE 
  WHEN user_id IS NOT NULL THEN 'active'
  ELSE 'no_access'
END
WHERE portal_status IS NULL OR portal_status = 'no_access';

-- ============================================================
-- REVERSIBLE MIGRATION / ROLLBACK INSTRUCTIONS:
--
-- To rollback:
-- DROP INDEX IF EXISTS public.uq_clients_business_email;
-- DROP INDEX IF EXISTS public.idx_clients_portal_status;
-- ALTER TABLE public.clients DROP COLUMN IF EXISTS portal_last_login_at;
-- ALTER TABLE public.clients DROP COLUMN IF EXISTS portal_enabled_at;
-- ALTER TABLE public.clients DROP COLUMN IF EXISTS portal_status;
-- ============================================================
