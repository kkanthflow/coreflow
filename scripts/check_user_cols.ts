import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`
    SELECT table_name, column_name, data_type, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name IN ('users', 'organizations', 'user_organizations', 'subscriptions', 'subscription_payments')
    ORDER BY table_name, ordinal_position;
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
