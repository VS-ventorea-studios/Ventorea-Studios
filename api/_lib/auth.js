import { createHash, randomBytes } from 'node:crypto';
import { getDb } from './db.js';

export const APP_ORIGIN = (process.env.APP_ORIGIN || 'https://ventoreastudios.online').replace(/\/$/, '');
export const SESSION_COOKIE = 'ventorea_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const result = {};
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

export function setCookies(res, cookies) {
  const existing = res.getHeader('Set-Cookie');
  const current = Array.isArray(existing) ? existing : existing ? [existing] : [];
  res.setHeader('Set-Cookie', [...current, ...cookies]);
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`;
}

export function clearOAuthCookies() {
  const base = '; Path=/api/auth/google; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax';
  return ['ventorea_oauth_state=', 'ventorea_oauth_verifier='].map(cookie => cookie + base);
}

export function cookieValue(req, name) {
  return parseCookies(req)[name] || '';
}

export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(client, userId, req) {
  const token = randomBytes(32).toString('base64url');
  await client.query(
    `insert into app.sessions (user_id, token_hash, expires_at, user_agent)
     values ($1, $2, now() + interval '30 days', $3)`,
    [userId, tokenHash(token), String(req.headers['user-agent'] || '').slice(0, 400)]
  );
  return token;
}

export async function getSessionUser(req) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token || token.length > 200) return null;
  const result = await getDb().query(
    `select u.id::text as id, u.email, u.email_verified, u.display_name,
            coalesce(p.avatar_url, u.avatar_url) as avatar_url,
            coalesce(p.phone_number, '') as phone_number,
            coalesce(p.bio, '') as bio,
            p.friend_code
     from app.sessions s
     join app.users u on u.id = s.user_id
     left join app.profiles p on p.user_id = u.id
     where s.token_hash = $1 and s.expires_at > now()
     limit 1`,
    [tokenHash(token)]
  );
  return result.rows[0] || null;
}

export async function deleteSession(req) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token || token.length > 200) return;
  await getDb().query('delete from app.sessions where token_hash = $1', [tokenHash(token)]);
}

export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const allowed = new Set([APP_ORIGIN, 'https://www.ventoreastudios.online']);
    return allowed.has(parsed.origin);
  } catch {
    return false;
  }
}

export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
}
