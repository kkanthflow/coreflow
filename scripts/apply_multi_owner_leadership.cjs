process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function main() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261030200000_multi_owner_leadership_departments.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Applying migration 20261030200000_multi_owner_leadership_departments.sql...');
  await client.query(sql);

  console.log('Migration executed successfully!');

  // Verify created tables
  const tables = ['organization_owners', 'leadership_members', 'department_members', 'department_announcements'];
  for (const t of tables) {
    const res = await client.query(`SELECT COUNT(*) as count FROM public.${t}`);
    console.log(`Table ${t} row count:`, res.rows[0].count);
  }

  // Verify functions
  const fnRes = await client.query(`
    SELECT proname 
    FROM pg_proc 
    WHERE proname IN ('is_org_owner', 'can_access_department', 'appoint_organization_owner', 'remove_organization_owner', 'upsert_leadership_member', 'assign_department_member', 'transfer_department_member')
      AND pronamespace = 'public'::regnamespace;
  `);
  console.log('Verified database functions:', fnRes.rows.map(r => r.proname));

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

