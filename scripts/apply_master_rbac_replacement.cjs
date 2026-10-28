const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function applyMigration() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('========================================================================');
  console.log('APPLYING MASTER MIGRATION: Complete Role Replacement, Job Titles & RBAC');
  console.log('Timestamp:', new Date().toISOString());
  console.log('========================================================================\n');

  try {
    // 1. Commit enum additions first outside transaction block
    console.log('Step 1: Adding enum values to user_role...');
    await client.query("ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'team_member'");
    await client.query("ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'guest'");
    console.log('[SUCCESS] Enum values added and committed.\n');

    // 2. Read SQL migration file
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261028020000_complete_role_replacement_and_unified_rbac.sql');
    let sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Remove the enum ALTER lines since they are already committed
    sqlContent = sqlContent.replace(/ALTER TYPE public\.user_role ADD VALUE IF NOT EXISTS 'team_member';/g, '-- enum team_member added');
    sqlContent = sqlContent.replace(/ALTER TYPE public\.user_role ADD VALUE IF NOT EXISTS 'guest';/g, '-- enum guest added');

    // 3. Execute rest of migration in transaction
    await client.query('BEGIN');
    console.log('Step 2: Executing table updates, catalogue seeding, and RPC functions...');
    await client.query(sqlContent);
    await client.query('COMMIT');
    console.log('[SUCCESS] Master migration applied and committed successfully!\n');

    // Verification check
    console.log('--- Verification: Built-in roles in public.roles ---');
    const rolesRes = await client.query('SELECT role_name FROM public.roles ORDER BY role_name');
    console.table(rolesRes.rows);

    console.log('\n--- Verification: Roles in user_organizations ---');
    const uoRes = await client.query('SELECT role, count(*)::int as count FROM public.user_organizations GROUP BY role ORDER BY count DESC');
    console.table(uoRes.rows);

    console.log('\n--- Verification: Job Titles Catalogue count ---');
    const jtRes = await client.query('SELECT count(*)::int as count FROM public.job_titles WHERE is_active = true');
    console.log(`Active Job Titles: ${jtRes.rows[0].count}`);

    console.log('\n--- Verification: Check sample job titles ---');
    const sample = await client.query(`
      SELECT title, functional_category, career_level 
      FROM public.job_titles 
      WHERE title IN ('Founder', 'Co-founder', 'Chief Executive Officer (CEO)', 'Chief Technology Officer (CTO)', 'Full-Stack Developer', 'DevOps Engineer', 'Accountant', 'Intern')
      ORDER BY career_level DESC
    `);
    console.table(sample.rows);

  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[ERROR] Migration failed. Transaction rolled back:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
  process.exit(1);
});
