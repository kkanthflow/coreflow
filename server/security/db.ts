import { Pool } from 'pg';

let pool: Pool | null = null;

export function getSecurityDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Security database configuration error: DATABASE_URL is not set in environment.");
    }
    
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const p = getSecurityDbPool();
  return p.query(text, params);
}
