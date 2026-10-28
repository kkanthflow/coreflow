const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT t.tgname, p.proname, p.prosrc 
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgrelid = 'auth.users'::regclass;
  `);
  console.log('TRIGGERS ON auth.users:');
  for (const r of res.rows) {
    console.log(r.tgname, '->', r.proname);
    console.log(r.prosrc);
  }
  await client.end();
}

run().catch(console.error);
