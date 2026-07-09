const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const dbUrl = "postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
if (!dbUrl) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '../supabase/migrations/20260709120000_delete_user_function.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const caPath = path.join(__dirname, '../prod-ca-2021.crt');
const caCert = fs.readFileSync(caPath, 'utf8');

async function main() {
  console.log('Connecting to database...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      ca: caCert,
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected successfully. Executing user presence migration SQL...');
    await client.query(sql);
    console.log('Presence migration executed successfully!');
  } catch (err) {
    console.error('Database migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
