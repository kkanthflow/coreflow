const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('Connected to Supabase PostgreSQL database.');
  const sqlFile = path.join(__dirname, '../supabase/migrations/20261027120000_team_roles_chat_meetings_integration.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('Applying migration 20261027120000_team_roles_chat_meetings_integration.sql...');
  await client.query(sql);

  console.log('Migration applied successfully!');
  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
