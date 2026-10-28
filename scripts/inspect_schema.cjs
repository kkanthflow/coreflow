const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();

  console.log('=== TABLES & COLUMNS ===');
  const tables = ['organizations', 'user_organizations', 'users', 'departments', 'invitations', 'organization_join_requests', 'join_requests'];
  for (const t of tables) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    if (cols.rows.length > 0) {
      console.log(`\nTable: ${t}`);
      cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`));
    } else {
      console.log(`\nTable ${t}: NOT FOUND`);
    }
  }

  console.log('\n=== ENUMS / ROLES ===');
  const enums = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public';
  `);
  enums.rows.forEach(r => console.log(`  ${r.typname} -> ${r.enumlabel}`));

  console.log('\n=== RLS POLICIES ON organizations & user_organizations ===');
  const policies = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('organizations', 'user_organizations', 'departments', 'users');
  `);
  policies.rows.forEach(r => {
    console.log(`\n[${r.tablename}] Policy: ${r.policyname} (${r.cmd})`);
    console.log(`  Roles: ${r.roles}`);
    console.log(`  Qual: ${r.qual}`);
    console.log(`  With Check: ${r.with_check}`);
  });

  await client.end();
}

main().catch(console.error);
