const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});
async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT proname, pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname IN ('complete_freelancer_setup', 'create_organization_with_owner', 'join_organization_by_id');
  `);
  for (const row of res.rows) {
    console.log('=== ' + row.proname + ' ===');
    console.log(row.pg_get_functiondef);
  }
  if (res.rows.length === 0) {
    console.log('None of the functions found in pg_proc.');
  }
  await client.end();
}
main().catch(console.error);
