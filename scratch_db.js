const pg = require('pg');
const { Client } = pg;

async function inspect() {
  const host = 'aws-0-ap-northeast-1.pooler.supabase.com';
  const client = new Client({
    host: host,
    port: 6543,
    database: 'postgres',
    user: 'postgres.rltygdzldplkmwuqfadm',
    password: 'Krishna0okanth#@',
    ssl: {
      rejectUnauthorized: false,
      servername: host
    }
  });
  try {
    await client.connect();
    console.log("Connected successfully on port 6543!");
    const res = await client.query("SELECT version();");
    console.log("Version:", res.rows[0].version);
    
    // Let's print user_role enum values
    const enumRes = await client.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'user_role';");
    console.log("user_role values:", enumRes.rows.map(r => r.enumlabel));

    // Let's print tables in public schema
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
    console.log("Tables:", tablesRes.rows.map(r => r.table_name));
  } catch (err) {
    console.error("Error on port 6543:", err.message);
  } finally {
    await client.end();
  }
}

inspect();
