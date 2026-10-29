export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  const allowedOrigins = new Set(['https://ventoreastudios.online', 'https://www.ventoreastudios.online', 'https://ventorea-studios.vercel.app']);
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'This website origin is not allowed.' });
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Feedback email is not configured yet. Add RESEND_API_KEY in Vercel.' });

  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().slice(0, 160);
  const category = String(body.category || 'General feedback').trim().slice(0, 60);
  const rating = String(body.rating || '').trim().slice(0, 40);
  const message = String(body.message || '').trim().slice(0, 4000);
  const attachmentPath = String(body.attachmentPath || '').trim();

  if (!message || !rating || !category) return res.status(400).json({ error: 'Please choose a feedback category and rating, and enter your feedback.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address so we can reply.' });
  if (attachmentPath && (!/^feedback\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(attachmentPath))) return res.status(400).json({ error: 'The photo attachment is invalid. Please select it again.' });

  let attachmentHtml = '';
  if (attachmentPath) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ncmthgqsrkasesfqvuzk.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return res.status(500).json({ error: 'Feedback photo delivery needs SUPABASE_SERVICE_ROLE_KEY configured in Vercel.' });
    try {
      const response = await fetch(supabaseUrl + '/storage/v1/object/sign/feedback-attachments/' + attachmentPath, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 604800 })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.signedURL) throw new Error('Could not create private attachment link.');
      const signedUrl = data.signedURL.startsWith('http') ? data.signedURL : supabaseUrl + '/storage/v1' + data.signedURL;
      attachmentHtml = '<p><b>Photo attachment:</b> <a href="' + escapeHtml(signedUrl) + '">Open private photo (link expires in 7 days)</a></p>';
    } catch {
      return res.status(502).json({ error: 'The photo uploaded, but we could not prepare its private link. Please try sending feedback again.' });
    }
  }

  const html = '<h2>New Ventorea Studios website feedback</h2><p><b>Name:</b> ' + escapeHtml(name || 'Not provided') + '</p><p><b>Email:</b> ' + escapeHtml(email) + '</p><p><b>Category:</b> ' + escapeHtml(category) + '</p><p><b>Experience rating:</b> ' + escapeHtml(rating) + '</p>' + attachmentHtml + '<hr><p>' + escapeHtml(message).replace(/\n/g, '<br>') + '</p>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.SUPPORT_FROM_EMAIL || 'Ventorea Feedback <onboarding@resend.dev>',
        to: ['ventoreastudios.support@gmail.com'],
        reply_to: email,
        subject: '[Ventorea Feedback] ' + category + ' — ' + rating,
        html
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: data?.message || 'Feedback could not be sent right now. Please try again later.' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'Feedback could not be sent right now. Please try again later.' });
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
