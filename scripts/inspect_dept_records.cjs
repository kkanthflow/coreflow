process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();

  const depts = await client.query(`
    SELECT id, org_id, name, status, is_deleted, head_user_id, created_at, enabled_modules
    FROM public.departments 
    ORDER BY created_at DESC 
    LIMIT 10;
  `);
  console.log('Sample departments:');
  console.table(depts.rows);

  const members = await client.query(`
    SELECT dm.id, dm.department_id, d.name as dept_name, dm.user_id, u.email, dm.department_role, dm.is_primary
    FROM public.department_members dm
    JOIN public.departments d ON d.id = dm.department_id
    JOIN public.users u ON u.id = dm.user_id;
  `);
  console.log('Department members:');
  console.table(members.rows);

  await client.end();
}
run().catch(console.error);

