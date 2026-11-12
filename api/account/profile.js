import { assertSameOrigin, getSessionUser, noStore } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req, res) {
  noStore(res);
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in with Google to manage your account.' });
    if (req.method === 'GET') return res.status(200).json({ user });

    if (!assertSameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
    const body = req.body || {};
    const displayName = String(body.displayName || '').trim().slice(0, 80);
    const phone = String(body.phone || '').trim().slice(0, 32);
    const bio = String(body.bio || '').trim().slice(0, 280);
    if (!displayName) return res.status(400).json({ error: 'Enter a display name.' });

    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'update app.users set display_name = $2, updated_at = now() where id = $1',
        [user.id, displayName]
      );
      await client.query(
        `update app.profiles set display_name = $2, phone_number = $3, bio = $4, updated_at = now()
         where user_id = $1`,
        [user.id, displayName, phone, bio]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    const updated = await getSessionUser(req);
    return res.status(200).json({ user: updated });
  } catch (error) {
    console.error('Profile update failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'Your profile could not be saved. Please try again.' });
  }
}
