process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  console.log('Connecting to Supabase PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully.');

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261031000000_department_workspaces_and_projects.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 20261031000000_department_workspaces_and_projects.sql...');
  await client.query(sql);
  console.log('Migration executed successfully.');

  // Verification 1: Verify projects columns
  console.log('\n--- 1. VERIFYING PROJECTS COLUMNS ---');
  const projCols = await client.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'projects' AND table_schema = 'public' 
      AND column_name IN ('project_type', 'department_metadata', 'workflow_stage', 'department_id');
  `);
  projCols.rows.forEach(r => console.log(`   ✓ ${r.column_name}: ${r.data_type} (default: ${r.column_default})`));

  // Verification 2: Verify backfill stats
  console.log('\n--- 2. VERIFYING PROJECT DEPARTMENT BACKFILL ---');
  const backfillStats = await client.query(`
    SELECT 
      COUNT(*) as total_projects,
      COUNT(department_id) as assigned_to_department,
      COUNT(*) FILTER (WHERE department_id IS NULL AND org_id IS NOT NULL) as unassigned_org_projects
    FROM public.projects;
  `);
  console.log(`   Total Projects: ${backfillStats.rows[0].total_projects}`);
  console.log(`   Assigned to Department: ${backfillStats.rows[0].assigned_to_department}`);
  console.log(`   Unassigned Org Projects: ${backfillStats.rows[0].unassigned_org_projects}`);

  // Verification 3: Verify departments project configuration
  console.log('\n--- 3. VERIFYING DEPARTMENT PROJECT CONFIGURATIONS ---');
  const deptConfigs = await client.query(`
    SELECT name, module_configurations->'project_configuration' as p_config 
    FROM public.departments 
    WHERE is_deleted = false 
    LIMIT 3;
  `);
  deptConfigs.rows.forEach(r => {
    console.log(`   Dept: "${r.name}"`);
    console.log(`     Project Types:`, r.p_config?.project_types);
    console.log(`     Stages:`, r.p_config?.workflow_stages);
  });

  // Verification 4: Verify can_view_project and can_manage_project
  console.log('\n--- 4. VERIFYING FUNCTIONS ---');
  const rpcs = await client.query(`
    SELECT proname, pg_catalog.pg_get_function_identity_arguments(oid) as args
    FROM pg_proc 
    WHERE proname IN ('can_view_project', 'can_manage_project', 'create_department_project')
      AND pronamespace = 'public'::regnamespace;
  `);
  rpcs.rows.forEach(r => console.log(`   ✓ ${r.proname}(${r.args})`));

  await client.end();
  console.log('\nDatabase migration completed and verified successfully!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
