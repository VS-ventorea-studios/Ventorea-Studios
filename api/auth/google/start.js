import { createHash, randomBytes } from 'node:crypto';
import { APP_ORIGIN, setCookies } from '../../_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || APP_ORIGIN + '/api/auth/google/callback';
  if (!clientId) return res.status(503).redirect('/account/?auth_error=google_not_configured');

  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const cookieBase = '; Path=/api/auth/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax';
  setCookies(res, [
    'ventorea_oauth_state=' + encodeURIComponent(state) + cookieBase,
    'ventorea_oauth_verifier=' + encodeURIComponent(verifier) + cookieBase
  ]);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  }).toString();

  return res.redirect(302, url.toString());
}
