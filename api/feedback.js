export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

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

  if (!message || !rating || !category) {
    return res.status(400).json({ error: 'Please choose a feedback category and rating, and enter your feedback.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address or leave the email field blank.' });
  }

  const html = `<h2>New Ventorea Studios website feedback</h2><p><b>Name:</b> ${escapeHtml(name || 'Not provided')}</p><p><b>Email:</b> ${escapeHtml(email || 'Not provided')}</p><p><b>Category:</b> ${escapeHtml(category)}</p><p><b>Experience rating:</b> ${escapeHtml(rating)}</p><hr><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.SUPPORT_FROM_EMAIL || 'Ventorea Feedback <onboarding@resend.dev>',
      to: ['ventoreastudios.support@gmail.com'],
      reply_to: email || undefined,
      subject: `[Ventorea Feedback] ${category} — ${rating}`,
      html
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return res.status(502).json({ error: data?.message || 'Feedback could not be sent right now. Please try again later.' });
  return res.status(200).json({ ok: true });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}