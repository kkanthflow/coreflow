const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.rltygdzldplkmwuqfadm',
    password: 'Krishna0okanth#@',
    ssl: {
      rejectUnauthorized: false,
      servername: 'aws-0-ap-northeast-1.pooler.supabase.com' // Send SNI!
    }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");

    const query = `
      DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;
      
      CREATE OR REPLACE FUNCTION public.is_org_admin(org_uuid UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_organizations
          WHERE org_id = org_uuid AND user_id = auth.uid()::uuid AND role IN ('owner', 'admin')
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      CREATE POLICY "Users can join an org or be added" ON public.user_organizations
        FOR INSERT
        WITH CHECK (
          user_id = auth.uid()::uuid 
          OR 
          public.is_org_admin(org_id)
        );
        
      NOTIFY pgrst, 'reload schema';
    `;
    
    await client.query(query);
    console.log("Policy updated successfully!");

  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

main();
