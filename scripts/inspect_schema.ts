import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let dbUrl = (process.env.DATABASE_URL || '').replace(/sslcert=[^&]*/g, '').replace(/&&+/g, '&').replace(/\?&/, '?').replace(/&\?/, '?').replace(/\?$/, '').replace(/&$/, '');

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected to DB');

  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables:', tablesRes.rows.map((r: any) => r.table_name).join(', '));

  const subCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    ORDER BY ordinal_position;
  `);
  console.log('subscriptions columns:', subCols.rows);

  const projCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'projects' 
    ORDER BY ordinal_position;
  `);
  console.log('projects columns:', projCols.rows);

  const invCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    ORDER BY ordinal_position;
  `);
  console.log('invoices columns:', invCols.rows);

  const meetCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'meetings' 
    ORDER BY ordinal_position;
  `);
  console.log('meetings columns:', meetCols.rows);

  const memCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'organization_memberships' 
    ORDER BY ordinal_position;
  `);
  console.log('organization_memberships columns:', memCols.rows);

  await client.end();
}

run().catch((err) => {
  console.error('Error in inspect_schema:', err);
  process.exit(1);
});
