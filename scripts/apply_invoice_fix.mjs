import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  // Remove sslcert query param if relative path might fail, and pass ssl: { rejectUnauthorized: false }
  const cleanUrl = connectionString.split('?')[0];
  const client = new pg.Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Postgres');

    const sqlFile = path.join(__dirname, '../supabase/migrations/20260821153000_fix_invoice_trigger_role_enum.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    await client.query(sql);
    console.log('Successfully executed migration 20260821153000_fix_invoice_trigger_role_enum.sql');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
