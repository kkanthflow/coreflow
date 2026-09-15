import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MIGRATIONS = [
  '20260828000000_causality_engine_foundation.sql',
  '20260828100000_project_access_hardening.sql',
  '20260828110000_create_project_rpc.sql',
];

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  // Strip SSL cert param (file path may not resolve) and use ssl option instead
  const cleanUrl = connectionString.split('?')[0];
  const client = new pg.Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Postgres');

    for (const file of MIGRATIONS) {
      const sqlFile = path.join(__dirname, '../supabase/migrations/', file);
      if (!fs.existsSync(sqlFile)) {
        console.warn(`⚠️  Migration file not found, skipping: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(sqlFile, 'utf8');
      console.log(`\n🔄 Applying migration: ${file}`);
      try {
        await client.query(sql);
        console.log(`✅ Successfully applied: ${file}`);
      } catch (err) {
        // Many "already exists" errors are safe to ignore
        if (err.code === '42P07' || err.code === '42710' || err.message?.includes('already exists')) {
          console.log(`ℹ️  Already applied (some objects exist): ${file}`);
        } else {
          console.error(`❌ Error in ${file}:`, err.message);
        }
      }
    }

    console.log('\n🎉 All migrations processed.');
  } catch (err) {
    console.error('Fatal connection error:', err.message);
  } finally {
    await client.end();
  }
}

run();
