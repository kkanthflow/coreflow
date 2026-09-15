const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not defined in environment variables');
  process.exit(1);
}

const caPath = path.join(__dirname, './prod-ca-2021.crt');
const caCert = fs.readFileSync(caPath, 'utf8');

async function main() {
  console.log('Connecting to database...');
  const client = new Client({
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.rltygdzldplkmwuqfadm',
    password: 'Krishna0okanth#@',
    ssl: {
      rejectUnauthorized: false,
      servername: 'aws-0-ap-northeast-1.pooler.supabase.com'
    }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");

    // 1. Apply the project access hardening migration
    console.log("Applying project access hardening migration...");
    const hardeningSql = fs.readFileSync('./supabase/migrations/20260828100000_project_access_hardening.sql', 'utf8');
    await client.query(hardeningSql);
    console.log("✓ Project access hardening applied successfully");

    // 2. Apply the create_project_with_member RPC migration
    console.log("Applying create_project_with_member RPC migration...");
    const rpcSql = fs.readFileSync('./supabase/migrations/20260828110000_create_project_rpc.sql', 'utf8');
    await client.query(rpcSql);
    console.log("✓ create_project_with_member RPC applied successfully");

  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

main();
