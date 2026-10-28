const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function run() {
  await client.connect();
  const userRes = await client.query("SELECT id, email, role, full_name, default_workspace_id, account_type, account_setup_completed FROM users WHERE email = 'kk5480346@gmail.com'");
  const user = userRes.rows[0];
  console.log('USER:', user);
  
  if (user) {
    const userOrgs = await client.query('SELECT * FROM user_organizations WHERE user_id = $1', [user.id]);
    console.log('USER ORGS:', userOrgs.rows);

    const orgId = userOrgs.rows[0]?.org_id;
    if (orgId) {
      const orgs = await client.query('SELECT id, name, owner_id FROM organizations WHERE id = $1', [orgId]);
      console.log('ORGANIZATION:', orgs.rows);
    }

    const invs = await client.query('SELECT id, invoice_number, owner_id, organization_id, client_id, total_amount, paid_amount, balance_due, status FROM invoices WHERE owner_id = $1 OR organization_id = $2', [user.id, orgId || '00000000-0000-0000-0000-000000000000']);
    console.log('INVOICES:', invs.rows);

    const clients = await client.query('SELECT id, name, email, owner_id, organization_id, user_id FROM clients WHERE owner_id = $1 OR organization_id = $2', [user.id, orgId || '00000000-0000-0000-0000-000000000000']);
    console.log('CLIENTS:', clients.rows);
  }

  await client.end();
}

run().catch(console.error);
