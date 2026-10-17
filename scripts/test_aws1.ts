import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const hosts = [
  'aws-1-ap-northeast-1.pooler.supabase.com:5432',
  'aws-1-ap-northeast-1.pooler.supabase.com:6543',
];

async function main() {
  for (const h of hosts) {
    const connStr = `postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@${h}/postgres?sslmode=require`;
    console.log(`Connecting to ${h}...`);
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Connected to PG at ${h}!`);
      const res = await client.query('SELECT current_user, version()');
      console.log('Result:', res.rows[0]);
      await client.end();
      return h;
    } catch (err: any) {
      console.log(`Failed on ${h}:`, err.message);
      try { await client.end(); } catch {}
    }
  }
}

main().catch(console.error);
