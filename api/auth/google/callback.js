import { randomBytes } from 'node:crypto';
import { getDb } from '../../_lib/db.js';
import {
  APP_ORIGIN, cookieValue, createSession, noStore, sessionCookie, setCookies, clearOAuthCookies
} from '../../_lib/auth.js';

function fail(res, code) {
  setCookies(res, clearOAuthCookies());
  return res.redirect(302, APP_ORIGIN + '/account/?auth_error=' + encodeURIComponent(code));
}

function newFriendCode() {
  return 'VENT-' + randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  const state = cookieValue(req, 'ventorea_oauth_state');
  const verifier = cookieValue(req, 'ventorea_oauth_verifier');
  const returnedState = String(req.query?.state || '');
  const code = String(req.query?.code || '');
  if (!state || !verifier || !returnedState || state !== returnedState) return fail(res, 'state_invalid');
  if (!code) return fail(res, req.query?.error ? 'google_denied' : 'missing_code');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || APP_ORIGIN + '/api/auth/google/callback';
  if (!clientId || !clientSecret || !process.env.DATABASE_URL) return fail(res, 'server_not_configured');

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
        code_verifier: verifier
      })
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.access_token) return fail(res, 'token_exchange_failed');

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token },
      cache: 'no-store'
    });
    const profile = await profileResponse.json().catch(() => ({}));
    const emailVerified = profile.email_verified === true || profile.email_verified === 'true';
    if (!profileResponse.ok || !profile.sub || !profile.email || !emailVerified) {
      return fail(res, 'google_identity_unverified');
    }

    const client = await getDb().connect();
    let token;
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        `insert into app.users
          (id, google_sub, email, email_verified, display_name, avatar_url, last_login_at)
         values (gen_random_uuid(), $1, $2, true, $3, $4, now())
         on conflict (google_sub) do update set
           email = excluded.email,
           email_verified = true,
           display_name = case
             when app.users.display_name = 'Ventorea member' then excluded.display_name
             else app.users.display_name
           end,
           avatar_url = coalesce(excluded.avatar_url, app.users.avatar_url),
           last_login_at = now(),
           updated_at = now()
         returning id::text as id`,
        [profile.sub, profile.email, String(profile.name || profile.email.split('@')[0]).slice(0, 80), profile.picture || null]
      );
      const userId = userResult.rows[0].id;

      let profileCreated = false;
      for (let attempt = 0; attempt < 8 && !profileCreated; attempt++) {
        try {
          await client.query(
            `insert into app.profiles (user_id, display_name, friend_code, avatar_url)
             values ($1, $2, $3, $4)
             on conflict (user_id) do nothing`,
            [userId, String(profile.name || profile.email.split('@')[0]).slice(0, 80), newFriendCode(), profile.picture || null]
          );
          profileCreated = true;
        } catch (error) {
          if (error?.code !== '23505') throw error;
        }
      }
      if (!profileCreated) throw new Error('Could not initialize account profile');

      token = await createSession(client, userId, req);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    setCookies(res, [
      ...clearOAuthCookies(),
      sessionCookie(token)
    ]);
    return res.redirect(302, APP_ORIGIN + '/account/?signed_in=1');
  } catch (error) {
    console.error('Google OAuth callback failed:', error?.message || 'unknown error');
    return fail(res, 'sign_in_failed');
  }
}
