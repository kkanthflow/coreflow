process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();

  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%dept%' OR table_name LIKE '%department%')
    ORDER BY table_name;
  `);
  console.log('Department tables:', tables.rows.map(r => r.table_name));

  for (const t of tables.rows) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [t.table_name]);
    console.log(`\nColumns of ${t.table_name}:`);
    console.table(cols.rows);
  }

  // Check row counts
  for (const t of tables.rows) {
    const cnt = await client.query(`SELECT count(*) as count FROM public."${t.table_name}"`);
    console.log(`Table ${t.table_name} count: ${cnt.rows[0].count}`);
  }

  await client.end();
}
run().catch(console.error);

