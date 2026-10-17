import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261018030000_account_setup_and_rbac.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is missing');

  console.log('Connecting to PostgreSQL database to apply migration...');
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected! Executing migration...');
  await client.query(sql);
  console.log('✅ Migration 20261018010000_subscription_entitlements.sql applied successfully!');
  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
