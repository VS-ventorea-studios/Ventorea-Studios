import { neon } from '@neondatabase/serverless';

let cachedSql;
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  if (!cachedSql) cachedSql = neon(process.env.DATABASE_URL);
  return cachedSql;
}
