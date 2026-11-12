import { getDb } from './_lib/db.js';
import { getSessionUser, requireSameOrigin } from './_lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireSameOrigin(req, res)) return;
  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Your session expired. Sign in again.' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
  if (!displayName || displayName.length > 80) return res.status(400).json({ error: 'Display name must contain 1 to 80 characters.' });
  if (phone.length > 40) return res.status(400).json({ error: 'Phone number is too long.' });
  if (bio.length > 280) return res.status(400).json({ error: 'Bio must be 280 characters or fewer.' });
  try {
    const sql = getDb();
    const rows = await sql`update public.users set display_name = ${displayName}, phone = ${phone}, bio = ${bio}, updated_at = now() where id = ${session.id} returning id, email, display_name, phone, bio, avatar_url, friend_code`;
    if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
    const user = rows[0];
    return res.status(200).json({
      id: user.id, email: user.email, displayName: user.display_name,
      phone: user.phone, bio: user.bio, avatarUrl: user.avatar_url, friendCode: user.friend_code
    });
  } catch (error) {
    console.error('Profile update failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'Your profile could not be saved right now.' });
  }
}
