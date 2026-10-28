process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function main() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261028040000_separate_job_titles_and_rbac.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Connecting to Supabase PostgreSQL database...');
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Applying migration 20261028040000_separate_job_titles_and_rbac.sql...');
  await client.query(sql);

  console.log('Migration executed successfully!');

  // Verify functions exist
  const res = await client.query(`
    SELECT proname, pg_catalog.pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname IN ('update_organization_member_job_title', 'update_organization_member_role', 'approve_organization_join_request')
      AND pronamespace = 'public'::regnamespace;
  `);
  console.log('Verified database functions:');
  console.log(res.rows);

  // Check sample job titles in user_organizations
  const uoRes = await client.query('SELECT role, job_title, COUNT(*) FROM public.user_organizations GROUP BY role, job_title;');
  console.log('user_organizations roles & job titles:');
  console.log(uoRes.rows);

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
