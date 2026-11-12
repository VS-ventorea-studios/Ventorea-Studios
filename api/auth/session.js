import { getSessionUser, noStore } from '../_lib/auth.js';

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await getSessionUser(req);
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Session lookup failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'Account service is temporarily unavailable.' });
  }
}
