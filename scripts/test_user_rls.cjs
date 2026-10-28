const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// We can get the user's password or generate an auth token using service key, or check auth.users
async function run() {
  const pgClient = new Client({
    connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
  });
  await pgClient.connect();

  const authUserRes = await pgClient.query("SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'kk5480346@gmail.com'");
  console.log('AUTH USER:', authUserRes.rows[0]);

  // Let's test the RLS policy evaluation in postgres directly by impersonating the user's auth.uid()!
  await pgClient.query("BEGIN;");
  await pgClient.query("SET LOCAL ROLE authenticated;");
  await pgClient.query(`SET LOCAL "request.jwt.claim.sub" = '${authUserRes.rows[0].id}';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  await pgClient.query(`SET LOCAL "request.jwt.claim.email" = 'kk5480346@gmail.com';`);

  console.log('\n--- TESTING DIRECT QUERIES WITH AUTHENTICATED RLS ROLE ---');

  // Query 1: user profile
  const userProfile = await pgClient.query("SELECT * FROM public.users WHERE id = '7f76bf0c-2ed9-4f79-ac12-da06c25079e1';");
  console.log('1. User profile under RLS:', userProfile.rows);

  // Query 2: user organizations
  const userOrgs = await pgClient.query("SELECT * FROM public.user_organizations WHERE user_id = '7f76bf0c-2ed9-4f79-ac12-da06c25079e1';");
  console.log('2. User organizations under RLS:', userOrgs.rows);

  // Query 3: organizations
  const orgs = await pgClient.query("SELECT * FROM public.organizations WHERE id = 'a1641901-1ce1-400c-bb20-c723710da323';");
  console.log('3. Organizations under RLS:', orgs.rows);

  // Query 4: Invoices with exact frontend query
  const invsFrontend = await pgClient.query(`
    SELECT id, invoice_number, status, due_date, issue_date, currency, total_amount, paid_amount, balance_due, organization_id, owner_id
    FROM public.invoices
    WHERE is_deleted = false AND organization_id = 'a1641901-1ce1-400c-bb20-c723710da323';
  `);
  console.log('4. Invoices (by org_id) under RLS:', invsFrontend.rows);

  // Query 5: Invoices (by owner_id)
  const invsOwner = await pgClient.query(`
    SELECT id, invoice_number, status, due_date, issue_date, currency, total_amount, paid_amount, balance_due, organization_id, owner_id
    FROM public.invoices
    WHERE is_deleted = false AND owner_id = '7f76bf0c-2ed9-4f79-ac12-da06c25079e1';
  `);
  console.log('5. Invoices (by owner_id) under RLS:', invsOwner.rows);

  // Query 6: Clients with exact frontend query
  const clientsFrontend = await pgClient.query(`
    SELECT * FROM public.clients
    WHERE is_deleted = false AND organization_id = 'a1641901-1ce1-400c-bb20-c723710da323';
  `);
  console.log('6. Clients (by org_id) under RLS:', clientsFrontend.rows);

  // Query 7: Analytics query
  try {
    const analyticsRes = await pgClient.query(`
      SELECT id, status, total_amount, amount_paid FROM public.invoices;
    `);
    console.log('7. Analytics query:', analyticsRes.rows);
  } catch (err) {
    console.log('7. Analytics query ERROR:', err.message);
  }

  await pgClient.query("ROLLBACK;");
  await pgClient.end();
}

run().catch(console.error);
