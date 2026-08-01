const postgres = require('postgres');
const fs = require('fs');

async function main() {
  const sql = postgres("postgres://postgres:Krishna0okanth%23%40@db.rltygdzldplkmwuqfadm.supabase.co:5432/postgres", { ssl: 'require' });
  
  try {
    console.log("Adding department_id to user_organizations...");
    await sql`
      ALTER TABLE public.user_organizations 
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
    `;
    console.log("Successfully added department_id!");

    console.log("Updating trigger functions just in case...");
    const migrationSql = fs.readFileSync('./supabase/migrations/20260625110000_soft_delete_departments.sql', 'utf8');
    await sql.unsafe(migrationSql);
    console.log("Successfully re-applied trigger functions!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
