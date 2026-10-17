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
    SELECT * FROM public.fn_get_effective_limits('c7e0317a-f7e3-4ddb-8543-a43928946e54', NULL);
  `);
  console.log('fn_get_effective_limits result:', res.rows[0]);
  await client.end();
}

main().catch(console.error);
