const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261018050000_update_effective_limits_and_locks.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration 20261018050000_update_effective_limits_and_locks.sql...');
    await client.query(sql);
    console.log('✅ Migration applied successfully!');

    // Test the updated function
    const testRes = await client.query(`
      SELECT * FROM public.fn_get_effective_limits('00000000-0000-0000-0000-000000000001', NULL);
    `);
    console.log('User baseline limits:', testRes.rows[0]);

    const orgRes = await client.query(`
      SELECT * FROM public.fn_get_effective_limits('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
    `);
    console.log('Org baseline limits:', orgRes.rows[0]);

    await client.end();
  } catch (err) {
    console.error('Migration failed:', err);
    try { await client.end(); } catch {}
    process.exit(1);
  }
}

runMigration();
