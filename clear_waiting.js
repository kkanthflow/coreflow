const postgres = require('postgres');
async function main() {
  const sql = postgres("postgres://postgres:Krishna0okanth%23%40@db.rltygdzldplkmwuqfadm.supabase.co:5432/postgres", { ssl: 'require' });
  await sql`UPDATE public.meeting_participants SET admission_status = 'left' WHERE admission_status = 'waiting'`;
  console.log("Cleared waiting users");
  await sql.end();
}
main();
