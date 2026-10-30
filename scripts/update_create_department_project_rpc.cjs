process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();
  const sql = `
    CREATE OR REPLACE FUNCTION public.create_department_project(
      p_title               TEXT,
      p_description         TEXT       DEFAULT NULL,
      p_priority            TEXT       DEFAULT 'medium',
      p_cover_color         TEXT       DEFAULT '#1F6FEB',
      p_status              TEXT       DEFAULT 'active',
      p_due_date            TEXT       DEFAULT NULL,
      p_department_id       TEXT       DEFAULT NULL,
      p_org_id              TEXT       DEFAULT NULL,
      p_project_type        TEXT       DEFAULT 'standard',
      p_workflow_stage      TEXT       DEFAULT 'planning',
      p_department_metadata JSONB      DEFAULT '{}'::jsonb
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_user_id UUID := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));
      v_department_id UUID;
      v_org_id UUID;
      v_due_date DATE;
      v_project_id UUID;
      v_result JSONB;
    BEGIN
      IF p_department_id IS NOT NULL AND p_department_id <> '' THEN
        v_department_id := p_department_id::UUID;
      END IF;

      IF p_org_id IS NOT NULL AND p_org_id <> '' THEN
        v_org_id := p_org_id::UUID;
      END IF;

      IF p_due_date IS NOT NULL AND p_due_date <> '' THEN
        v_due_date := p_due_date::DATE;
      END IF;

      INSERT INTO public.projects (
        org_id,
        department_id,
        title,
        description,
        priority,
        cover_color,
        status,
        due_date,
        project_type,
        workflow_stage,
        department_metadata,
        owner_id,
        created_by
      ) VALUES (
        v_org_id,
        v_department_id,
        p_title,
        p_description,
        p_priority,
        p_cover_color,
        p_status,
        v_due_date,
        COALESCE(p_project_type, 'standard'),
        COALESCE(p_workflow_stage, 'planning'),
        COALESCE(p_department_metadata, '{}'::jsonb),
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_project_id;

      INSERT INTO public.project_members (project_id, user_id, role, added_by)
      VALUES (v_project_id, v_user_id, 'owner', v_user_id)
      ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

      SELECT jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'status', p.status,
        'project_type', p.project_type,
        'workflow_stage', p.workflow_stage,
        'department_id', p.department_id,
        'org_id', p.org_id
      ) INTO v_result
      FROM public.projects p
      WHERE p.id = v_project_id;

      RETURN v_result;
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.create_department_project(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon, service_role;
  `;

  await client.query(sql);
  console.log('create_department_project RPC successfully applied.');
  await client.end();
}

run().catch(err => {
  console.error('Migration update error:', err);
  process.exit(1);
});
