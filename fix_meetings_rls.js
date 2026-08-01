const { Client } = require('pg');

const dbUrl = "postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // First, let's create the policy to allow participants to view meetings
    console.log("Adding policy for meeting participants...");
    
    await client.query(`
      DROP POLICY IF EXISTS "Participants can view their meetings" ON meetings;
      CREATE POLICY "Participants can view their meetings" ON meetings
      FOR SELECT USING (
        auth_is_meeting_participant(id)
      );
    `);

    console.log("Successfully added RLS policy.");
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

main();
