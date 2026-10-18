const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');

    // 1. Check FKs referencing users
    const fkQuery = `
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE ccu.table_name IN ('users')
    `;
    const fks = await client.query(fkQuery);
    console.log('Foreign key constraints on users:', fks.rows);

    // 2. Count existing records across major tables
    const tables = [
      'auth.users',
      'public.users',
      'public.user_organizations',
      'public.organizations',
      'public.subscriptions',
      'public.subscription_payments',
      'public.projects',
      'public.invoices',
      'public.meetings'
    ];

    for (const t of tables) {
      try {
        const c = await client.query(`SELECT count(*) FROM ${t}`);
        console.log(`${t} count:`, c.rows[0].count);
      } catch (err) {
        console.log(`${t}: table does not exist or error:`, err.message);
      }
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
