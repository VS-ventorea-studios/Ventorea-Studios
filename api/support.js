export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Support email is not configured yet. Add RESEND_API_KEY in Vercel.' });

  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().slice(0, 160);
  const type = String(body.type || 'General').trim().slice(0, 40);
  const subject = String(body.subject || '').trim().slice(0, 120);
  const message = String(body.message || '').trim().slice(0, 4000);

  if (!name || !email || !subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please complete all required fields with a valid email address.' });
  }

  const emailSubject = `[Ventorea Support] ${type}: ${subject}`;
  const html = `<h2>New Ventorea Studios support request</h2><p><b>Name:</b> ${escapeHtml(name)}</p><p><b>Email:</b> ${escapeHtml(email)}</p><p><b>Issue type:</b> ${escapeHtml(type)}</p><p><b>Subject:</b> ${escapeHtml(subject)}</p><hr><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.SUPPORT_FROM_EMAIL || 'Ventorea Support <onboarding@resend.dev>',
      to: ['ventoreastudios.support@gmail.com'],
      reply_to: email,
      subject: emailSubject,
      html
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return res.status(502).json({ error: data?.message || 'The support email could not be sent.' });
  return res.status(200).json({ ok: true });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}