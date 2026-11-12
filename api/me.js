import { getDb } from './_lib/db.js';
import { getSessionUser } from './_lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Sign in with Google to continue.' });
  try {
    const sql = getDb();
    const rows = await sql`select id, email, display_name, phone, bio, avatar_url, friend_code from public.users where id = ${session.id} limit 1`;
    if (!rows[0]) return res.status(401).json({ error: 'Your account was not found. Sign in again.' });
    const user = rows[0];
    return res.status(200).json({
      id: user.id, email: user.email, displayName: user.display_name,
      phone: user.phone || '', bio: user.bio || '', avatarUrl: user.avatar_url || null,
      friendCode: user.friend_code || null
    });
  } catch (error) {
    console.error('Account lookup failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'Account details are temporarily unavailable.' });
  }
}
