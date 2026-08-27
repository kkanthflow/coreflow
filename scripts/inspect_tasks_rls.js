const { Client } = require('pg');
const dbUrl = "postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function inspect() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as with_check
    FROM pg_policy
    WHERE polrelid = 'public.tasks'::regclass;
  `);
  console.log('Tasks policies:', JSON.stringify(res.rows, null, 2));
  
  // Check user organizations for user
  const userOrgs = await client.query(`
    SELECT uo.user_id, uo.org_id, uo.role, u.email, u.full_name
    FROM public.user_organizations uo
    JOIN public.users u ON u.id = uo.user_id;
  `);
  console.log('User organizations sample:', JSON.stringify(userOrgs.rows.slice(0, 5), null, 2));

  // Check columns on tasks
  const cols = await client.query(`
    SELECT column_name, is_nullable, column_default, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tasks';
  `);
  console.log('Tasks columns:', JSON.stringify(cols.rows, null, 2));

  await client.end();
}

inspect().catch(console.error);
