process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();

  console.log('--- 1. PROJECTS COLUMNS ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'projects' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`));

  console.log('\n--- 2. TASKS COLUMNS ---');
  const taskCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  taskCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`));

  console.log('\n--- 3. DEPARTMENTS CONFIG COLUMNS ---');
  const deptCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'departments' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  deptCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  console.log('\n--- 4. EXISTING RLS POLICIES ON PROJECTS ---');
  const policies = await client.query(`
    SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as withcheck
    FROM pg_policy 
    WHERE polrelid = 'public.projects'::regclass;
  `);
  policies.rows.forEach(r => {
    console.log(`  [${r.polcmd}] ${r.polname}`);
    if (r.qual) console.log(`      QUAL: ${r.qual}`);
    if (r.withcheck) console.log(`      CHECK: ${r.withcheck}`);
  });

  console.log('\n--- 5. FUNCTION DEFINITIONS ---');
  const fns = await client.query(`
    SELECT proname, pg_get_functiondef(oid) as def 
    FROM pg_proc 
    WHERE proname IN ('can_view_project', 'can_manage_project');
  `);
  fns.rows.forEach(r => console.log(`\n=== ${r.proname} ===\n${r.def}`));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
