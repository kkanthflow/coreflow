const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();

  console.log('Updating submit_join_request and get_user_join_request_status...');

  await client.query(`
    CREATE OR REPLACE FUNCTION public.submit_join_request(
      p_org_id uuid,
      p_job_title text DEFAULT NULL,
      p_department_id uuid DEFAULT NULL
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_user_id uuid;
      v_user_email text;
      v_user_full_name text;
      v_org_name text;
      v_existing_mem record;
      v_existing_req record;
      v_req_id uuid;
      v_res jsonb;
    BEGIN
      v_user_id := auth.uid();
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit join request.' USING ERRCODE = '42501';
      END IF;

      -- Verify target organization exists
      SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Target organization not found.' USING ERRCODE = 'P0002';
      END IF;

      -- Check if user is already an active member of this organization
      SELECT role INTO v_existing_mem FROM public.user_organizations 
      WHERE org_id = p_org_id AND user_id = v_user_id;
      IF FOUND THEN
        RAISE EXCEPTION 'You are already an active member of %.', v_org_name USING ERRCODE = '23505';
      END IF;

      -- Ensure public.users profile exists
      SELECT email, full_name INTO v_user_email, v_user_full_name FROM public.users WHERE id = v_user_id;
      IF NOT FOUND THEN
        SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
        INTO v_user_email, v_user_full_name
        FROM auth.users
        WHERE id = v_user_id;

        INSERT INTO public.users (
          id, email, full_name, role, default_workspace_id, account_type, account_setup_completed, current_plan_tier, subscription_status
        ) VALUES (
          v_user_id, v_user_email, COALESCE(v_user_full_name, 'Team Member'), 'employee', NULL, 'organization', false, 'business_free', 'free'
        ) ON CONFLICT (id) DO NOTHING;
      END IF;

      -- Check for existing pending request for this user and organization
      SELECT id, status, created_at INTO v_existing_req
      FROM public.organization_join_requests
      WHERE org_id = p_org_id AND user_id = v_user_id AND status = 'pending'
      LIMIT 1;

      IF FOUND THEN
        SELECT jsonb_build_object(
          'success', true,
          'id', v_existing_req.id,
          'request_id', v_existing_req.id,
          'org_id', p_org_id,
          'org_name', v_org_name,
          'status', 'pending',
          'created_at', v_existing_req.created_at,
          'is_duplicate', true,
          'message', 'You already have a pending join request for this organization.'
        ) INTO v_res;
        RETURN v_res;
      END IF;

      -- Insert new join request
      INSERT INTO public.organization_join_requests (
        org_id, user_id, full_name, email, job_title, department_id, status
      ) VALUES (
        p_org_id,
        v_user_id,
        COALESCE(v_user_full_name, 'Applicant'),
        v_user_email,
        NULLIF(TRIM(p_job_title), ''),
        p_department_id,
        'pending'
      )
      RETURNING id INTO v_req_id;

      -- Update users account_type to 'organization', but keep account_setup_completed = false
      UPDATE public.users
      SET account_type = 'organization',
          account_setup_completed = false
      WHERE id = v_user_id;

      SELECT jsonb_build_object(
        'success', true,
        'id', v_req_id,
        'request_id', v_req_id,
        'org_id', p_org_id,
        'org_name', v_org_name,
        'status', 'pending',
        'created_at', now(),
        'is_duplicate', false,
        'message', 'Join request submitted successfully. Awaiting management review.'
      ) INTO v_res;

      RETURN v_res;
    END;
    $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_user_join_request_status()
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_user_id uuid;
      v_req record;
      v_res jsonb;
    BEGIN
      v_user_id := auth.uid();
      IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('has_pending_request', false);
      END IF;

      SELECT 
        r.id,
        r.org_id,
        r.job_title,
        r.status,
        r.created_at,
        r.reviewed_at,
        r.review_notes,
        o.name AS org_name,
        o.logo_url AS org_logo_url,
        o.industry AS org_industry,
        o.size_category AS org_size_category
      INTO v_req
      FROM public.organization_join_requests r
      JOIN public.organizations o ON o.id = r.org_id
      WHERE r.user_id = v_user_id
      ORDER BY 
        CASE WHEN r.status = 'pending' THEN 1 ELSE 2 END,
        r.created_at DESC
      LIMIT 1;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('has_pending_request', false);
      END IF;

      SELECT jsonb_build_object(
        'has_pending_request', (v_req.status = 'pending'),
        'id', v_req.id,
        'request_id', v_req.id,
        'org_id', v_req.org_id,
        'org_name', v_req.org_name,
        'industry', v_req.org_industry,
        'size_category', v_req.org_size_category,
        'org_logo_url', v_req.org_logo_url,
        'org_industry', v_req.org_industry,
        'job_title', v_req.job_title,
        'status', v_req.status,
        'created_at', v_req.created_at,
        'reviewed_at', v_req.reviewed_at,
        'review_notes', v_req.review_notes
      ) INTO v_res;

      RETURN v_res;
    END;
    $$;
  `);

  console.log('Successfully updated RPCs.');
  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
