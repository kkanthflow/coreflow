process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function fixRLSRecursion() {
  await client.connect();
  console.log('Connected to PostgreSQL database...');

  const sql = `
    -- 1. Helper security definer functions to prevent RLS recursion
    CREATE OR REPLACE FUNCTION public.check_is_leadership_admin(p_user_id uuid, p_org_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.leadership_members
        WHERE org_id = p_org_id 
          AND user_id = p_user_id 
          AND is_active = true 
          AND can_manage_leadership = true
      );
    $$;

    CREATE OR REPLACE FUNCTION public.check_can_manage_departments(p_user_id uuid, p_org_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.leadership_members
        WHERE org_id = p_org_id 
          AND user_id = p_user_id 
          AND is_active = true 
          AND can_manage_departments = true
      );
    $$;

    CREATE OR REPLACE FUNCTION public.check_can_manage_announcements(p_user_id uuid, p_org_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.leadership_members
        WHERE org_id = p_org_id 
          AND user_id = p_user_id 
          AND is_active = true 
          AND can_manage_announcements = true
      );
    $$;

    GRANT EXECUTE ON FUNCTION public.check_is_leadership_admin(uuid, uuid) TO authenticated, service_role, anon;
    GRANT EXECUTE ON FUNCTION public.check_can_manage_departments(uuid, uuid) TO authenticated, service_role, anon;
    GRANT EXECUTE ON FUNCTION public.check_can_manage_announcements(uuid, uuid) TO authenticated, service_role, anon;

    -- 2. Drop and recreate policies with security definer functions
    DROP POLICY IF EXISTS "Owners and leadership admins can manage leadership" ON public.leadership_members;
    CREATE POLICY "Owners and leadership admins can manage leadership" ON public.leadership_members
    FOR ALL
    USING (
      is_org_owner(auth.uid(), org_id) 
      OR check_is_leadership_admin(auth.uid(), org_id)
    )
    WITH CHECK (
      is_org_owner(auth.uid(), org_id) 
      OR check_is_leadership_admin(auth.uid(), org_id)
    );

    DROP POLICY IF EXISTS "Authorized users can manage department members" ON public.department_members;
    CREATE POLICY "Authorized users can manage department members" ON public.department_members
    FOR ALL
    USING (
      is_org_owner(auth.uid(), org_id)
      OR EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = department_members.department_id AND d.head_user_id = auth.uid()
      )
      OR check_can_manage_departments(auth.uid(), org_id)
    )
    WITH CHECK (
      is_org_owner(auth.uid(), org_id)
      OR EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = department_members.department_id AND d.head_user_id = auth.uid()
      )
      OR check_can_manage_departments(auth.uid(), org_id)
    );

    DROP POLICY IF EXISTS "Authorized leaders can manage department announcements" ON public.department_announcements;
    CREATE POLICY "Authorized leaders can manage department announcements" ON public.department_announcements
    FOR ALL
    USING (
      is_org_owner(auth.uid(), org_id)
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = department_announcements.department_id AND d.head_user_id = auth.uid()
      )
      OR check_can_manage_announcements(auth.uid(), org_id)
    );

    DROP POLICY IF EXISTS "dept_records_delete_policy" ON public.department_records;
    CREATE POLICY "dept_records_delete_policy" ON public.department_records
    FOR DELETE
    USING (
      is_org_owner(auth.uid(), org_id)
      OR EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = department_records.department_id AND d.head_user_id = auth.uid()
      )
      OR check_can_manage_departments(auth.uid(), org_id)
    );

    -- Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
  `;

  await client.query(sql);
  console.log('Successfully applied RLS recursion fixes and reloaded PostgREST schema!');

  await client.end();
}

fixRLSRecursion().catch(err => {
  console.error('Error applying fix:', err);
  process.exit(1);
});
