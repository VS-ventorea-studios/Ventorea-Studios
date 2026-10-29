const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ncmthgqsrkasesfqvuzk.supabase.co';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_ORIGINS = new Set(['https://ventoreastudios.online','https://www.ventoreastudios.online','https://ventorea-studios.vercel.app']);
const recentRequests = new Map();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'This website origin is not allowed.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const body = req.body || {};
  if (String(body.website || '').trim()) return res.status(400).json({ error: 'Upload request rejected.' });
  const email = String(body.email || '').trim().slice(0, 160);
  const contentType = String(body.contentType || '').toLowerCase();
  const size = Number(body.size);
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[contentType];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address before attaching a photo.' });
  if (!ext || !ALLOWED_TYPES.has(contentType) || !Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) return res.status(400).json({ error: 'Choose a JPG, PNG or WebP image up to 5 MB.' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  for (const [key, time] of recentRequests) if (now - time > 10 * 60 * 1000) recentRequests.delete(key);
  const previous = recentRequests.get(ip);
  if (previous && now - previous < 5000) return res.status(429).json({ error: 'Please wait a few seconds before trying another upload.' });
  recentRequests.set(ip, now);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Photo uploads need SUPABASE_SERVICE_ROLE_KEY configured in Vercel.' });
  const path = 'feedback/' + crypto.randomUUID() + '.' + ext;
  try {
    const response = await fetch(SUPABASE_URL + '/storage/v1/object/upload/sign/feedback-attachments/' + path, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsert: false })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) return res.status(502).json({ error: 'Could not prepare a secure photo upload.' });
    return res.status(200).json({ path, token: data.token });
  } catch {
    return res.status(502).json({ error: 'Photo upload service is temporarily unavailable.' });
  }
}
