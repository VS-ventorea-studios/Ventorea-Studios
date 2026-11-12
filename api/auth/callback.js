import { createRemoteJWKSet, jwtVerify } from 'jose';
import { getDb } from '../_lib/db.js';
import { createSession, getAppOrigin, readCookies, sessionCookie } from '../_lib/session.js';

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const clearOAuth = 'ventorea_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0';
  const fail = (status, message) => {
    res.setHeader('Set-Cookie', clearOAuth);
    return res.status(status).send(message);
  };
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(503, 'Google sign-in is not configured yet.');
  const cookies = readCookies(req);
  let oauth;
  try { oauth = JSON.parse(Buffer.from(cookies.ventorea_oauth || '', 'base64url').toString('utf8')); }
  catch { return fail(400, 'Your Google sign-in session expired. Start again.'); }
  const code = typeof req.query?.code === 'string' ? req.query.code : '';
  const state = typeof req.query?.state === 'string' ? req.query.state : '';
  if (!code || !state || state !== oauth.state || !oauth.nonce || !oauth.verifier) {
    return fail(400, 'Google sign-in could not be verified. Start again.');
  }

  const redirectUri = getAppOrigin() + '/api/auth/callback';
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: oauth.verifier
      })
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof tokens.id_token !== 'string') {
      console.error('Google token exchange failed:', tokenResponse.status);
      return fail(401, 'Google sign-in failed. Please try again.');
    }

    const { payload } = await jwtVerify(tokens.id_token, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId
    });
    if (payload.nonce !== oauth.nonce || payload.email_verified !== true ||
        typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return fail(401, 'Google did not return a verified account. Please try again.');
    }

    const sql = getDb();
    const googleSub = payload.sub;
    const email = payload.email.toLowerCase();
    const displayName = typeof payload.name === 'string' ? payload.name.slice(0, 80) : email.split('@')[0];
    const avatarUrl = typeof payload.picture === 'string' ? payload.picture.slice(0, 1000) : null;
    let rows = await sql`select id, google_sub, email from public.users where google_sub = ${googleSub} limit 1`;
    let user = rows[0];
    if (!user) {
      const byEmail = await sql`select id, google_sub, email from public.users where lower(email) = ${email} order by created_at asc limit 1`;
      if (byEmail[0] && !byEmail[0].google_sub) {
        rows = await sql`update public.users set google_sub = ${googleSub}, email = ${email}, updated_at = now() where id = ${byEmail[0].id} returning id, google_sub, email`;
        user = rows[0];
      } else if (byEmail[0] && byEmail[0].google_sub === googleSub) {
        user = byEmail[0];
      }
    }
    if (!user) {
      const newId = (await sql`insert into public.users (google_sub,email,display_name,avatar_url,friend_code) values (${googleSub},${email},${displayName},${avatarUrl},${'VENT-' + Math.random().toString(36).slice(2,8).toUpperCase()}) returning id, google_sub, email`)[0];
      user = newId;
    } else {
      await sql`update public.users set email = ${email}, avatar_url = coalesce(${avatarUrl}, avatar_url), updated_at = now() where id = ${user.id}`;
    }

    const token = await createSession({ id: user.id, email });
    res.setHeader('Set-Cookie', [
      'ventorea_session=' + token + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800',
      clearOAuth
    ]);
    return res.redirect(302, getAppOrigin() + '/account/');
  } catch (error) {
    console.error('Google callback failed:', error?.message || 'unknown error');
    return fail(500, 'Sign-in could not be completed. Please try again.');
  }
}
