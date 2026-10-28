const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const client = new Client({
  connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require'
});

async function main() {
  await client.connect();
  const sqlPath = path.join(__dirname, '../supabase/migrations/20261027110000_global_account_integrity_and_data_access.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying migration: 20261027110000_global_account_integrity_and_data_access.sql ...');
  await client.query(sql);
  console.log('MIGRATION APPLIED SUCCESSFULLY!');

  // Verify organizations owner_id
  const orgRes = await client.query(`
    SELECT id, name, owner_id 
    FROM public.organizations 
    WHERE name = 'Skavelon Technologies';
  `);
  console.log('Skavelon Technologies after migration:', orgRes.rows[0]);

  // Verify user setup
  const userRes = await client.query(`
    SELECT id, email, role, default_workspace_id, account_type, account_setup_completed 
    FROM public.users 
    WHERE email = 'kk5480346@gmail.com';
  `);
  console.log('User kk5480346@gmail.com after migration:', userRes.rows[0]);

  // Verify roles count
  const rolesRes = await client.query(`SELECT count(*) FROM public.roles;`);
  console.log('Total roles in public.roles:', rolesRes.rows[0].count);

  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
