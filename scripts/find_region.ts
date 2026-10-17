import pg from 'pg';
import dns from 'dns/promises';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const regions = [
  'ap-south-1',      // Mumbai (India - very likely given user timezone +05:30 and INR currency!)
  'ap-southeast-1',  // Singapore
  'ap-northeast-1',  // Tokyo
  'us-east-1',       // N. Virginia
  'us-west-1',       // N. California
  'eu-central-1',    // Frankfurt
  'eu-west-1',       // Ireland
];

async function testPoolers() {
  for (const reg of regions) {
    const host = `aws-0-${reg}.pooler.supabase.com`;
    const connStr = `postgres://postgres.rltygdzldplkmwuqfadm:Krishna0okanth%23%40@${host}:6543/postgres?sslmode=require`;
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Connected to pooler region: ${reg} (${host})`);
      const res = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name');
      console.log('Tables:', res.rows.map((r: any) => r.table_name).join(', '));
      await client.end();
      return reg;
    } catch (err: any) {
      console.log(`Failed on ${reg}:`, err.message);
      try { await client.end(); } catch {}
    }
  }
}

testPoolers().catch(console.error);
