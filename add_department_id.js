const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log("Adding department_id to user_organizations...");
    
    await client.query(`
      ALTER TABLE public.user_organizations 
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
      
      CREATE INDEX IF NOT EXISTS idx_user_orgs_dept_id ON public.user_organizations(department_id);
    `);

    console.log("Successfully added department_id column.");
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

main();
