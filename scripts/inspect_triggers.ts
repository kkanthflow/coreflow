import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const cols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name IN ('default_workspace_id', 'current_plan_tier', 'account_type', 'account_setup_completed', 'subscription_status');
  `);
  console.log('users columns verification:', cols.rows);

  const plans = await client.query(`SELECT id, tier, price_inr, max_seats, max_active_projects FROM subscription_plans;`);
  console.log('plans in DB:', plans.rows);

  await client.end();
}

main().catch(console.error);
