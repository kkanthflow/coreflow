const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();

  console.log('--- SUBSCRIPTIONS TABLE COLUMNS ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
    ORDER BY ordinal_position
  `);
  console.log(cols.rows);

  console.log('--- SUBSCRIPTION_PLANS TABLE (IF ANY) ---');
  const plans = await client.query(`
    SELECT * FROM information_schema.tables WHERE table_name LIKE '%plan%'
  `);
  console.log(plans.rows);

  await client.end();
}

main().catch(console.error);
