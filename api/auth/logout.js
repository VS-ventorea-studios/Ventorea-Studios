import { assertSameOrigin, clearSessionCookie, deleteSession, noStore, setCookies } from '../_lib/auth.js';

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertSameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
  try {
    await deleteSession(req);
  } catch (error) {
    console.error('Session revocation failed:', error?.message || 'database error');
    setCookies(res, [clearSessionCookie()]);
    return res.status(503).json({ error: 'The session could not be revoked. Please try again.' });
  }
  setCookies(res, [clearSessionCookie()]);
  return res.status(200).json({ ok: true });
}
