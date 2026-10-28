process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL.');

  const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '20261028050000_fix_invoice_payments_rls.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('Applying migration 20261028050000_fix_invoice_payments_rls.sql...');
  await client.query(sql);
  console.log('Migration applied successfully!');

  // Verify Lokender's permissions now
  const u = await client.query("SELECT id, email, full_name, role FROM users WHERE full_name ILIKE '%lokender%'");
  const uId = u.rows[0].id;
  const p1 = await client.query("SELECT has_permission($1, 'record_payments') AS perm", [uId]);
  console.log("has_permission('record_payments') for Lokender:", p1.rows[0]);

  const inv = await client.query("SELECT id, organization_id FROM invoices WHERE invoice_number ILIKE '%544%'");
  if (inv.rows.length > 0) {
    const p2 = await client.query("SELECT has_org_permission($1, $2, 'record_payments') AS perm", [uId, inv.rows[0].organization_id]);
    console.log("has_org_permission('record_payments') for Lokender on invoice org:", p2.rows[0]);
  }

  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
