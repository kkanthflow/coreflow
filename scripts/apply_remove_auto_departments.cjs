const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const DB_URL = 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function apply() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const migrationFile = path.resolve(__dirname, '../supabase/migrations/20261028010000_remove_auto_generated_departments.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('Applying migration 20261028010000_remove_auto_generated_departments.sql...');
  await client.query(sql);
  console.log('Migration applied successfully!\n');

  // Verification queries
  const totalAfter = await client.query('SELECT count(*) FROM departments;');
  console.log('Total departments remaining in DB:', totalAfter.rows[0].count);

  const remaining = await client.query(`
    SELECT d.id, d.name, d.color, o.name as org_name, d.created_at
    FROM departments d
    LEFT JOIN organizations o ON o.id = d.org_id;
  `);
  console.log('Remaining departments in DB:');
  console.table(remaining.rows);

  const backupCount = await client.query('SELECT count(*) FROM _backup_auto_seeded_departments;');
  console.log('Backed up auto-seeded records count:', backupCount.rows[0].count);

  await client.end();
}

apply().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
