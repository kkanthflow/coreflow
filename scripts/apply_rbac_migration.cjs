const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261027130000_enterprise_job_roles_and_rbac.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration 20261027130000_enterprise_job_roles_and_rbac.sql...');
  await client.query(sql);
  console.log('Enterprise Job Roles & RBAC migration applied successfully!');

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
