const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^"|"$/g, '')
  : 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261020000000_client_project_invites_and_linking.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 20261020000000_client_project_invites_and_linking.sql...');
    await client.query(sql);
    console.log('✅ Migration applied successfully!');

    // Verify project_invites table
    const tableRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'project_invites'");
    console.log('Verified table project_invites:', tableRes.rows);

    // Verify clients user_id column
    const colRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'user_id'");
    console.log('Verified clients.user_id:', colRes.rows);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
