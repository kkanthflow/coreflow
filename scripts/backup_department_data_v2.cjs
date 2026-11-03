process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  // Create backup tables with timestamp
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._backup_departments_v2_migration AS
    SELECT *, now() AS backup_taken_at FROM public.departments;
  `);
  console.log('✓ Created backup table: _backup_departments_v2_migration');

  await client.query(`
    CREATE TABLE IF NOT EXISTS public._backup_department_members_v2_migration AS
    SELECT *, now() AS backup_taken_at FROM public.department_members;
  `);
  console.log('✓ Created backup table: _backup_department_members_v2_migration');

  // Verify backup record counts
  const deptCount = await client.query(`SELECT count(*) FROM public._backup_departments_v2_migration;`);
  const memberCount = await client.query(`SELECT count(*) FROM public._backup_department_members_v2_migration;`);
  console.log(`Verified backup rows: ${deptCount.rows[0].count} departments, ${memberCount.rows[0].count} department_members.`);

  await client.end();
}

run().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});

