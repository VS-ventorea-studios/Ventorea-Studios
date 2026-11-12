import pg from 'pg';

const { Pool } = pg;
let pool;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: true }
    });
    pool.on('error', error => {
      console.error('Ventorea database pool error:', error?.message || 'database error');
    });
  }
  return pool;
}
