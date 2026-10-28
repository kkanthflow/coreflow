const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function applyMigration() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('Connected to PostgreSQL database.');
  const sqlPath = path.resolve(__dirname, '../supabase/migrations/20261027140000_enterprise_role_limitations_and_security_rules.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying 20261027140000_enterprise_role_limitations_and_security_rules.sql...');
  await client.query(sql);
  console.log('Migration applied successfully!');

  await client.end();
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
