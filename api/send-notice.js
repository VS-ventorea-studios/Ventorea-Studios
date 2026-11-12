import { getSessionUser, isSameOrigin } from './_lib/session.js';

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && !isSameOrigin(req)) return res.status(403).json({ error: 'Request origin could not be verified.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in with the studio owner account.' });
  const ownerEmail = String(process.env.ADMIN_EMAIL || 'ventoreastudios.support@gmail.com').toLowerCase();
  if (String(user.email || '').toLowerCase() !== ownerEmail) {
    return res.status(403).json({ error: 'Owner access only. Sign in with the configured owner account.' });
  }

  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email sending is not configured. Add RESEND_API_KEY in Vercel.' });

  const body = req.body || {};
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const type = body.type === 'warning' ? 'warning' : body.type === 'note' ? 'note' : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Enter a valid visitor email address.' });
  if (!type) return res.status(400).json({ error: 'Choose Warning or Note.' });
  if (!message || message.length > 4000) return res.status(400).json({ error: 'Message must contain 1 to 4000 characters.' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email sending is not configured. Add RESEND_API_KEY in Vercel.' });
  const from = process.env.SUPPORT_FROM_EMAIL;
  if (!from) return res.status(503).json({ error: 'Set SUPPORT_FROM_EMAIL in Vercel to a sender address verified in Resend.' });

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const subject = type === 'warning' ? 'Important warning from Ventorea Studios' : 'A note from Ventorea Studios';
  const heading = type === 'warning' ? 'Official website warning' : 'A message from Ventorea Studios';
  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#182033;line-height:1.6"><h2>' + heading + '</h2><p>' + escapeHtml(message).replace(/\n/g, '<br>') + '</p><hr><p style="font-size:12px;color:#687386">Ventorea Studios · <a href="https://ventoreastudios.online">ventoreastudios.online</a></p></div>',
        text: heading + '\n\n' + message + '\n\nVentorea Studios · https://ventoreastudios.online'
      })
    });
    const data = await sent.json().catch(() => ({}));
    if (!sent.ok) {
      console.error('Notice email failed:', sent.status, data?.message || data?.name || 'Resend error');
      return res.status(502).json({ error: 'The email provider rejected the message. Check your verified sender and Resend account.' });
    }
    return res.status(200).json({ ok: true, id: data.id || null });
  } catch {
    return res.status(502).json({ error: 'Could not reach the email provider. Try again.' });
  }
}