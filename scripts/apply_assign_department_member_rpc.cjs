process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function main() {
  await client.connect();

  // Drop old signature if needed
  await client.query(`DROP FUNCTION IF EXISTS public.assign_department_member(uuid, uuid, text, boolean);`);
  await client.query(`DROP FUNCTION IF EXISTS public.assign_department_member(text, text, text, boolean);`);

  const sql = `
    -- 1. Signature with p_dept_id and p_user_id (matches DepartmentWorkspace.tsx)
    CREATE OR REPLACE FUNCTION public.assign_department_member(
      p_dept_id uuid,
      p_user_id uuid,
      p_department_role text DEFAULT 'member',
      p_is_primary boolean DEFAULT true
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_caller_id uuid;
      v_org_id uuid;
      v_dept_name text;
      v_channel_id uuid;
      v_role_clean text;
    BEGIN
      v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

      SELECT org_id, name INTO v_org_id, v_dept_name
      FROM public.departments
      WHERE id = p_dept_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Department not found.' USING ERRCODE = 'P0002';
      END IF;

      -- Validate authority
      IF NOT (
        public.is_org_owner(v_caller_id, v_org_id)
        OR EXISTS (
          SELECT 1 FROM public.departments WHERE id = p_dept_id AND head_user_id = v_caller_id
        )
        OR EXISTS (
          SELECT 1 FROM public.leadership_members WHERE org_id = v_org_id AND user_id = v_caller_id AND can_manage_departments = true
        )
        OR public.has_org_permission(v_caller_id, v_org_id, 'departments.manage')
      ) THEN
        RAISE EXCEPTION 'Access denied. You do not have permission to assign department members.' USING ERRCODE = '42501';
      END IF;

      v_role_clean := LOWER(TRIM(COALESCE(p_department_role, 'member')));
      IF v_role_clean NOT IN ('head', 'lead', 'member') THEN
        v_role_clean := 'member';
      END IF;

      -- 1. Insert/Update department_members
      INSERT INTO public.department_members (
        department_id, user_id, org_id, department_role, is_primary, assigned_by
      ) VALUES (
        p_dept_id, p_user_id, v_org_id, v_role_clean, COALESCE(p_is_primary, true), v_caller_id
      )
      ON CONFLICT (department_id, user_id)
      DO UPDATE SET
        department_role = v_role_clean,
        is_primary = COALESCE(p_is_primary, department_members.is_primary),
        updated_at = now();

      -- 2. If primary, sync user_organizations.department_id
      IF COALESCE(p_is_primary, true) THEN
        UPDATE public.user_organizations
        SET department_id = p_dept_id
        WHERE org_id = v_org_id AND user_id = p_user_id;

        UPDATE public.users
        SET department = v_dept_name
        WHERE id = p_user_id;
      END IF;

      -- 3. If role is 'head', set departments.head_user_id
      IF v_role_clean = 'head' THEN
        UPDATE public.departments
        SET head_user_id = p_user_id
        WHERE id = p_dept_id;
      END IF;

      -- 4. Automatically add member to department chat channel
      SELECT id INTO v_channel_id
      FROM public.chat_channels
      WHERE department_id = p_dept_id
      LIMIT 1;

      IF v_channel_id IS NOT NULL THEN
        INSERT INTO public.channel_members (channel_id, user_id, role)
        VALUES (v_channel_id, p_user_id, 'member')
        ON CONFLICT (channel_id, user_id) DO NOTHING;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'department_id', p_dept_id,
        'user_id', p_user_id,
        'department_role', v_role_clean
      );
    END;
    $$;

    -- 2. Overload with p_department_id and p_target_user_id (for backwards compatibility)
    CREATE OR REPLACE FUNCTION public.assign_department_member(
      p_department_id text,
      p_target_user_id text,
      p_department_role text DEFAULT 'member',
      p_is_primary boolean DEFAULT true
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN public.assign_department_member(
        p_department_id::uuid,
        p_target_user_id::uuid,
        p_department_role,
        p_is_primary
      );
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.assign_department_member(uuid, uuid, text, boolean) TO authenticated, anon, service_role;
    GRANT EXECUTE ON FUNCTION public.assign_department_member(text, text, text, boolean) TO authenticated, anon, service_role;
    NOTIFY pgrst, 'reload schema';
  `;

  await client.query(sql);
  console.log('assign_department_member functions successfully applied.');

  // Test calling with p_dept_id and p_user_id
  const testDept = await client.query(`SELECT id FROM public.departments LIMIT 1;`);
  const testUser = await client.query(`SELECT id FROM auth.users LIMIT 1;`);

  if (testDept.rows[0] && testUser.rows[0]) {
    const testRes = await client.query(`
      SELECT public.assign_department_member(
        p_dept_id := $1::uuid,
        p_user_id := $2::uuid,
        p_department_role := 'member',
        p_is_primary := true
      ) as res;
    `, [testDept.rows[0].id, testUser.rows[0].id]);
    console.log('Verified call with (p_dept_id, p_user_id):', testRes.rows[0]?.res);

    const testRes2 = await client.query(`
      SELECT public.assign_department_member(
        p_department_id := $1::text,
        p_target_user_id := $2::text,
        p_department_role := 'member',
        p_is_primary := true
      ) as res;
    `, [testDept.rows[0].id, testUser.rows[0].id]);
    console.log('Verified call with (p_department_id, p_target_user_id):', testRes2.rows[0]?.res);
  }

  await client.end();
}

main().catch(err => {
  console.error('Error applying assign_department_member:', err);
  process.exit(1);
});
