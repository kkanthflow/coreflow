import { supabaseAdmin } from '../server/_core/supabase.js';

async function testDashboardQueries() {
  const userId = '7f76bf0c-2ed9-4f79-ac12-da06c25079e1';
  const orgId = 'a1641901-1ce1-400c-bb20-c723710da323';
  const isIndie = false;
  const now = new Date().toISOString();

  console.log('Testing Dashboard queries...');

  // 1. Pending Deliverables
  const tasksPromise = supabaseAdmin
    .from('tasks')
    .select(`
      id, title, status, priority, due_date,
      assignee:assignee_id(full_name, avatar_url),
      project:project_id(title)
    `)
    .eq('status', 'todo')
    .order('due_date', { ascending: true, nullsFirst: false });

  // 2. Upcoming Meetings
  const meetingsPromise = supabaseAdmin
    .from('meetings')
    .select(`
      id, title, start_time, end_time, status,
      host:host_id(full_name, email),
      participants:meeting_participants(user_id)
    `)
    .gt('end_time', now)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })
    .limit(3);

  // 3. Projects
  const projectsPromise = supabaseAdmin
    .from('projects')
    .select('id, title, status, cover_color, tasks(id, status)')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .limit(5);

  // 4. Invoices
  const invoicesPromise = supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, total_amount, status, due_date')
    .eq(isIndie ? 'owner_id' : 'organization_id', isIndie ? userId : orgId)
    .eq('is_deleted', false);

  // 5. Members
  const membersPromise = supabaseAdmin
    .from('user_organizations')
    .select('user_id, role, users:user_id(id, full_name, email)')
    .eq('org_id', orgId);

  // 6. Clients
  const clientsPromise = supabaseAdmin
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  const [t, m, p, i, mem, c] = await Promise.all([
    tasksPromise,
    meetingsPromise,
    projectsPromise,
    invoicesPromise,
    membersPromise,
    clientsPromise
  ]);

  console.log('Tasks err:', t.error?.message, 'count:', t.data?.length);
  console.log('Meetings err:', m.error?.message, 'count:', m.data?.length);
  console.log('Projects err:', p.error?.message, 'count:', p.data?.length);
  console.log('Invoices err:', i.error?.message, 'count:', i.data?.length);
  console.log('Members err:', mem.error?.message, 'count:', mem.data?.length);
  console.log('Clients err:', c.error?.message, 'count:', c.count);
}

testDashboardQueries().catch(console.error);
