const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename IN ('invoices', 'clients', 'organizations', 'user_organizations', 'users')
    ORDER BY tablename, policyname;
  `);
  console.log('POLICIES:');
  for (const row of res.rows) {
    console.log(`[${row.tablename}] ${row.cmd} "${row.policyname}"`);
    console.log('  QUAL:', row.qual);
    console.log('  WITH CHECK:', row.with_check);
  }
  await client.end();
}

run().catch(console.error);
