const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE proname IN ('has_permission', 'is_org_member');
  `);
  for (const row of res.rows) {
    console.log(`FUNCTION ${row.proname}:`);
    console.log(row.prosrc);
  }

  // Let's test calling has_permission for user '7f76bf0c-2ed9-4f79-ac12-da06c25079e1'
  const permRes = await client.query(`
    SELECT 
      has_permission('7f76bf0c-2ed9-4f79-ac12-da06c25079e1'::uuid, 'view_invoices'::text) as view_invoices,
      has_permission('7f76bf0c-2ed9-4f79-ac12-da06c25079e1'::uuid, 'manage_clients'::text) as manage_clients,
      has_permission('7f76bf0c-2ed9-4f79-ac12-da06c25079e1'::uuid, 'create_invoices'::text) as create_invoices;
  `);
  console.log('PERMISSIONS FOR kk5480346@gmail.com:');
  console.table(permRes.rows);

  await client.end();
}

run().catch(console.error);
