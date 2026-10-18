const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});
async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'handle_new_user';
  `);
  console.log('--- handle_new_user definition ---');
  console.log(res.rows[0]?.pg_get_functiondef);

  console.log('--- Triggers on auth.users ---');
  const trigs = await client.query(`
    SELECT tgname, proname, tgenabled
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE tgrelid = 'auth.users'::regclass;
  `);
  console.log(trigs.rows);

  console.log('--- Column defaults on public.users ---');
  const cols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    AND column_name IN ('role', 'account_type', 'account_setup_completed', 'default_workspace_id');
  `);
  console.log(cols.rows);

  await client.end();
}
main().catch(console.error);
