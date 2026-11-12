import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'ventorea_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function secretKey() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  return new TextEncoder().encode(process.env.SESSION_SECRET);
}

export function getAppOrigin() {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return 'https://' + process.env.VERCEL_URL;
  }
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return 'http://localhost:3000';
}

export function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).origin === getAppOrigin(); }
  catch { return false; }
}

export function readCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }).filter(([key]) => key));
}

export function sessionCookie(token) {
  return COOKIE_NAME + '=' + token + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + SESSION_SECONDS;
}

export function clearSessionCookie() {
  return COOKIE_NAME + '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export async function createSession(user) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer('ventorea-studios')
    .setAudience('ventorea-web')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

export async function getSessionUser(req) {
  const token = readCookies(req)[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'ventorea-studios',
      audience: 'ventorea-web'
    });
    if (typeof payload.sub !== 'string') return null;
    return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : '' };
  } catch {
    return null;
  }
}

export function requireSameOrigin(req, res) {
  if (isSameOrigin(req)) return true;
  res.status(403).json({ error: 'Request origin could not be verified.' });
  return false;
}
