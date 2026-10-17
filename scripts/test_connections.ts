import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  realtime: { transport: ws as any }
});

async function main() {
  console.log('Testing Supabase REST Client:');
  const { data: tables, error } = await supabase.from('subscriptions').select('count', { count: 'exact', head: true });
  console.log('Subscriptions table check:', { data: tables, error });

  const { data: users, error: uErr } = await supabase.from('users').select('id, email, current_plan_tier').limit(2);
  console.log('Users sample:', { users, uErr });

  const { data: plans, error: pErr } = await supabase.from('subscription_plans').select('id, tier, interval, price_inr').limit(5);
  console.log('Subscription plans:', { plans, pErr });

  // Test direct connection pooler vs session pooler
  const hosts = [
    'aws-0-ap-northeast-1.pooler.supabase.com:5432',
    'aws-0-ap-northeast-1.pooler.supabase.com:6543',
    'db.rltygdzldplkmwuqfadm.supabase.co:5432',
  ];

  for (const host of hosts) {
    const isDirect = host.includes('db.rltygdzldplkmwuqfadm');
    const user = isDirect ? 'postgres' : 'postgres.rltygdzldplkmwuqfadm';
    const connStr = `postgres://${user}:Krishna0okanth%23%40@${host}/postgres?sslmode=require`;
    console.log(`\nTesting PG: ${host} (user: ${user})...`);
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`✅ Connected successfully to ${host}`);
      const res = await client.query('SELECT current_user, version()');
      console.log('PG query result:', res.rows[0]);
      await client.end();
      break;
    } catch (e: any) {
      console.log(`❌ Failed on ${host}:`, e.message);
      try { await client.end(); } catch {}
    }
  }
}

main().catch(console.error);
