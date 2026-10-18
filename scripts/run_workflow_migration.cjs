const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();
  console.log('Connected to PostgreSQL database.');
  
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261018090000_workflow_automation_engine.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Applying workflow automation migration...');
  await client.query(sql);
  console.log('✓ Migration applied successfully!');
  
  // Verify tables
  const res = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('workflows', 'workflow_executions', 'workflow_approvals');
  `);
  console.log('Verified tables created:', res.rows.map(r => r.table_name));
  
  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
