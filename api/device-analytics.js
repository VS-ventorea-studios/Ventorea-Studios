import { getDb } from './_lib/db.js';
import { isSameOrigin } from './_lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  if (origin && !isSameOrigin(req)) return res.status(403).json({ error: 'Request origin could not be verified.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const deviceType = String(body.device_type || '');
  const operatingSystem = String(body.operating_system || '').slice(0,40);
  const browser = String(body.browser || '').slice(0,50);
  const pagePath = String(body.page_path || '').slice(0,180);
  const viewportBucket = String(body.viewport_bucket || '');
  if (!['Mobile phone','Tablet','Desktop / laptop'].includes(deviceType) ||
      !operatingSystem || !browser || !pagePath.startsWith('/') ||
      !['small','medium','large'].includes(viewportBucket)) {
    return res.status(400).json({ error: 'Invalid analytics record.' });
  }
  try {
    const sql = getDb();
    await sql`insert into public.device_analytics (device_type,operating_system,browser,page_path,viewport_bucket)
      values (${deviceType},${operatingSystem},${browser},${pagePath},${viewportBucket})`;
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Anonymous analytics insert failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'Analytics are temporarily unavailable.' });
  }
}
