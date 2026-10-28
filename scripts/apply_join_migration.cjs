const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();
  const sqlPath = path.join(__dirname, '../supabase/migrations/20261027100000_organization_self_service_join.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying migration: 20261027100000_organization_self_service_join.sql ...');
  await client.query(sql);
  console.log('MIGRATION APPLIED SUCCESSFULLY!');

  // Verify table
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'organization_join_requests' 
    ORDER BY ordinal_position;
  `);
  console.log('Columns in organization_join_requests:', res.rows);

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
