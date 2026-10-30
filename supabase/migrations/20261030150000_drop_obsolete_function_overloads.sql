-- ==============================================================================
-- AUVRYN — Fix Function Overload Ambiguity
-- Migration: 20261030150000_drop_obsolete_function_overloads.sql
-- Description: Drop obsolete overloaded function signatures that caused PostgREST 
--              candidate resolution errors (Error 42725).
-- ==============================================================================

-- Drop older 3-parameter signature of update_organization_member_role
-- The 4-parameter version handles both with `p_job_title text DEFAULT NULL`
DROP FUNCTION IF EXISTS public.update_organization_member_role(uuid, uuid, text);

-- Drop older 4-parameter signature of approve_organization_join_request
-- The 5-parameter version handles all callers with `p_assigned_job_title text DEFAULT NULL`
DROP FUNCTION IF EXISTS public.approve_organization_join_request(uuid, text, uuid, text);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

