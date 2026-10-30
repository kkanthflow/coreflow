process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function check() {
  await client.connect();

  console.log('--- SUPABASE LIVE DATABASE AUDIT ---');

  // 1. Check Tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN (
      'organization_owners', 
      'leadership_members', 
      'department_members', 
      'department_announcements', 
      'department_records', 
      'departments'
    )
    ORDER BY table_name;
  `);
  console.log('1. Target Tables in Public Schema:');
  tables.rows.forEach(r => console.log('   ✓', r.table_name));

  // 2. Check Departments User-Defined Columns
  const deptCols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'departments' AND table_schema = 'public'
    AND column_name IN (
      'purpose', 
      'responsibilities', 
      'enabled_modules', 
      'module_configurations', 
      'approval_status', 
      'dynamic_questions',
      'created_by'
    )
    ORDER BY column_name;
  `);
  console.log('\n2. User-Defined Department Columns:');
  deptCols.rows.forEach(r => console.log(`   ✓ ${r.column_name} (${r.data_type})`));

  // 3. Check RPCs
  const rpcs = await client.query(`
    SELECT proname, pg_catalog.pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname IN (
      'create_user_defined_department', 
      'update_department_configuration', 
      'update_organization_member_role', 
      'can_access_department', 
      'is_org_owner',
      'appoint_organization_owner',
      'remove_organization_owner'
    )
    AND pronamespace = 'public'::regnamespace
    ORDER BY proname;
  `);
  console.log('\n3. Live RPC Functions:');
  rpcs.rows.forEach(r => console.log(`   ✓ ${r.proname}(${r.args})`));

  // 4. Check for any overloaded duplicate signatures
  const overloads = await client.query(`
    SELECT proname, COUNT(*) as count
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('update_organization_member_role', 'approve_organization_join_request')
    GROUP BY proname;
  `);
  console.log('\n4. Overload Conflict Status:');
  overloads.rows.forEach(r => console.log(`   ${r.count == 1 ? '✓ Clean (Single Signature)' : '⚠ Overloaded'}: ${r.proname} (${r.count} signature)`));

  // 5. Check RLS status
  const rls = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename IN (
      'organization_owners', 
      'leadership_members', 
      'department_members', 
      'department_announcements', 
      'department_records', 
      'departments'
    );
  `);
  console.log('\n5. Row Level Security (RLS) Status:');
  rls.rows.forEach(r => console.log(`   ✓ ${r.tablename}: RLS ${r.rowsecurity ? 'ENABLED' : 'DISABLED'}`));

  await client.end();
}

check().catch(console.error);

