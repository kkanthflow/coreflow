process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();

  const procs = await client.query(`
    SELECT proname, proargnames, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND (proname LIKE '%dept%' OR proname LIKE '%department%')
    ORDER BY proname;
  `);
  console.log('Department functions in public:');
  console.table(procs.rows);

  await client.end();
}
run().catch(console.error);

