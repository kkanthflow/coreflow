-- ============================================================================================
-- Migration: 20261018070000_permanent_freelancer_setup_rpc.sql
-- Description:
--   1. Provide public.complete_freelancer_setup(p_full_name, p_skills, p_portfolio)
--      atomic RPC function with SECURITY DEFINER.
--   2. Ensure freelancer_profiles has an explicit INSERT policy for authenticated users.
--   3. Ensure independent workspace and workspace_members are atomically created and linked.
-- ============================================================================================

CREATE OR REPLACE FUNCTION public.complete_freelancer_setup(
  p_full_name TEXT,
  p_skills TEXT[] DEFAULT '{}'::text[],
  p_portfolio TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_full_name TEXT;
  v_clean_name TEXT;
  v_workspace_id UUID;
  v_res JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to complete freelancer setup.' USING ERRCODE = '42501';
  END IF;

  v_clean_name := TRIM(COALESCE(p_full_name, ''));

  -- Ensure public.users entry exists
  SELECT email, full_name INTO v_user_email, v_user_full_name FROM public.users WHERE id = v_user_id;
  IF NOT FOUND THEN
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_user_email, v_user_full_name
    FROM auth.users
    WHERE id = v_user_id;

    IF v_clean_name = '' THEN
      v_clean_name := COALESCE(v_user_full_name, 'Freelancer');
    END IF;

    INSERT INTO public.users (
      id, email, full_name, role, default_workspace_id, account_type, account_setup_completed, current_plan_tier, subscription_status
    ) VALUES (
      v_user_id, v_user_email, v_clean_name, 'freelancer', 'independent', true, 'freelancer_free', 'free'
    ) ON CONFLICT (id) DO NOTHING;
  ELSE
    IF v_clean_name = '' THEN
      v_clean_name := COALESCE(v_user_full_name, 'Freelancer');
    END IF;

    UPDATE public.users
    SET full_name = v_clean_name,
        account_type = 'freelancer',
        role = 'freelancer',
        default_workspace_id = 'independent',
        account_setup_completed = true,
        current_plan_tier = 'freelancer_free',
        subscription_status = 'free'
    WHERE id = v_user_id;
  END IF;

  -- 2. Upsert freelancer_profiles
  INSERT INTO public.freelancer_profiles (
    id, freelancer_type, skills, portfolio, availability, verification_status
  ) VALUES (
    v_user_id,
    'independent',
    COALESCE(p_skills, '{}'::text[]),
    COALESCE(TRIM(p_portfolio), ''),
    'available',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    skills = EXCLUDED.skills,
    portfolio = EXCLUDED.portfolio;

  -- 3. Ensure independent workspace exists
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE owner_id = v_user_id AND type = 'independent'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, type, owner_id, status)
    VALUES (v_clean_name || ' Workspace', 'independent', v_user_id, 'active')
    RETURNING id INTO v_workspace_id;
  END IF;

  -- Ensure owner is in workspace_members
  INSERT INTO public.workspace_members (workspace_id, user_id, status)
  VALUES (v_workspace_id, v_user_id, 'active')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  SELECT jsonb_build_object(
    'success', true,
    'account_type', 'freelancer',
    'role', 'freelancer',
    'workspace_id', v_workspace_id,
    'name', v_clean_name
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_freelancer_setup(TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_freelancer_setup(TEXT, TEXT[], TEXT) TO service_role;

-- Ensure RLS policy for inserting into freelancer_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'freelancer_profiles' AND policyname = 'Users can insert their own freelancer profile'
  ) THEN
    CREATE POLICY "Users can insert their own freelancer profile" ON public.freelancer_profiles
      FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
