process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%capab%' OR table_name LIKE '%approv%' OR table_name LIKE '%activ%' OR table_name LIKE '%collab%')
    ORDER BY table_name;
  `);
  console.log('Matching tables:', tables.rows.map(r => r.table_name));

  const allPublicTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log('\nAll public tables:', allPublicTables.rows.map(r => r.table_name));

  await client.end();
}
run().catch(console.error);

