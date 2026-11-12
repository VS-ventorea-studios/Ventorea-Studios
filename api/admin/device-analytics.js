import { getDb } from '../_lib/db.js';
import { getSessionUser } from '../_lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getSessionUser(req);
  const ownerEmail = String(process.env.ADMIN_EMAIL || 'ventoreastudios.support@gmail.com').toLowerCase();
  if (!user || String(user.email || '').toLowerCase() !== ownerEmail) {
    return res.status(403).json({ error: 'Owner access only.' });
  }
  try {
    const sql = getDb();
    const rows = await sql`select created_at,device_type,operating_system,browser,page_path
      from public.device_analytics
      where created_at >= now() - interval '30 days'
      order by created_at desc limit 1000`;
    return res.status(200).json({ rows });
  } catch (error) {
    console.error('Device analytics read failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'Device analytics are temporarily unavailable.' });
  }
}
