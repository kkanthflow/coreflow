const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();

async function run() {
  console.log("Connecting to database with explicit credentials...");
  const client = new Client({
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.rltygdzldplkmwuqfadm',
    password: 'Krishna0okanth#@',
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  await client.connect();
  console.log("Connected successfully. Adding delete policy to public.notifications table...");
  
  const sql = `
    DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
    CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
  `;
  
  await client.query(sql);
  console.log("Delete policy applied successfully!");
  await client.end();
}

run().catch(err => {
  console.error("Failed to apply policy:", err);
  process.exit(1);
});
