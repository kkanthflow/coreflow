const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function run() {
  await client.connect();
  const rolesRes = await client.query('SELECT role_name, permissions FROM roles');
  console.log('ROLES & PERMISSIONS:');
  for (const r of rolesRes.rows) {
    console.log(r.role_name, ':', Object.keys(r.permissions || {}));
  }
  await client.end();
}

run().catch(console.error);
