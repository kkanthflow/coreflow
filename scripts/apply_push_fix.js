const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config({ path: '.env.local' });

async function run() {
  console.log("Connecting to database...");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();
  console.log("Connected. Running migration: 20260717120000_fix_all_push_notifications.sql");

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260717120000_fix_all_push_notifications.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  await client.query(sql);
  console.log("✅ Migration applied successfully!");
  await client.end();
}

run().catch(err => {
  console.error("❌ Migration failed:", err.message || err);
  process.exit(1);
});
