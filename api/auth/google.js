import { createHash, randomBytes } from 'node:crypto';
import { getAppOrigin } from '../_lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured yet.' });

  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const temporary = Buffer.from(JSON.stringify({ state, nonce, verifier })).toString('base64url');
  const redirectUri = getAppOrigin(req) + '/api/auth/callback';
  const cookie = 'ventorea_oauth=' + temporary + '; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=600';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  });
  res.setHeader('Set-Cookie', cookie);
  return res.redirect(302, 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
}
