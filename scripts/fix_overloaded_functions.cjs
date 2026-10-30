process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' });

async function run() {
  await client.connect();
  console.log('Dropping obsolete overloaded functions in public schema...');
  
  await client.query(`
    DROP FUNCTION IF EXISTS public.update_organization_member_role(uuid, uuid, text);
    DROP FUNCTION IF EXISTS public.approve_organization_join_request(uuid, text, uuid, text);
    NOTIFY pgrst, 'reload schema';
  `);
  console.log('Obsolete functions dropped.');

  const res = await client.query(`
    SELECT proname, pg_catalog.pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname IN ('update_organization_member_role', 'approve_organization_join_request')
      AND pronamespace = 'public'::regnamespace;
  `);
  console.log('Remaining function signatures in public schema:', res.rows);

  // Check if any overloaded public functions remain
  const checkOverloads = await client.query(`
    SELECT proname, COUNT(*) as count
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
    GROUP BY proname
    HAVING COUNT(*) > 1;
  `);
  console.log('Overloaded public functions remaining:', checkOverloads.rows);

  await client.end();
}

run().catch(console.error);

