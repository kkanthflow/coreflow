process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function applyDeletionMigration() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('========================================================================');
  console.log('APPLYING MIGRATION: Delete the Existing Legacy Roles System in AUVRYN');
  console.log('Timestamp:', new Date().toISOString());
  console.log('========================================================================\n');

  try {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261028030000_delete_legacy_roles_system.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN');
    console.log('Executing migration script...');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('[SUCCESS] Migration applied and committed successfully!\n');

    // Post-migration checks
    console.log('--- Verification: Roles in public.roles ---');
    const roles = await client.query('SELECT role_name FROM public.roles ORDER BY role_name');
    console.table(roles.rows);

    console.log('\n--- Verification: Roles in user_organizations ---');
    const uoRoles = await client.query('SELECT role, count(*) FROM public.user_organizations GROUP BY role');
    console.table(uoRoles.rows);

    console.log('\n--- Verification: Roles in public.users ---');
    const uRoles = await client.query('SELECT role, count(*) FROM public.users GROUP BY role');
    console.table(uRoles.rows);

    console.log('\n--- Verification: Check if dropped tables still exist ---');
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('workspace_member_roles', 'workspace_role_permissions', 'workspace_roles', 'role_change_audit')
    `);
    console.log('Remaining obsolete tables (expected 0):', tables.rows.length);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Migration failed. Transaction rolled back:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyDeletionMigration();
