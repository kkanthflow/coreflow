const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database.');
    await client.query(`
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) DEFAULT 'paid';
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_payment_id VARCHAR(128);
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_payment_amount INTEGER;
      CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_status ON public.subscriptions(payment_status);
    `);
    console.log('Migration successfully applied: payment_status and payment tracking columns added.');
    await client.end();
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

run();
