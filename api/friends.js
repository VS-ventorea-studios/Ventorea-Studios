import { randomBytes } from 'node:crypto';
import { getDb } from './_lib/db.js';
import { getSessionUser, requireSameOrigin } from './_lib/session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Sign in with Google to use friends.' });
  const sql = getDb();
  try {
    const current = (await sql`select id, friend_code from public.users where id = ${session.id} limit 1`)[0];
    if (!current) return res.status(401).json({ error: 'Account not found.' });
    if (!current.friend_code) {
      const code = 'VENT-' + randomBytes(4).toString('hex').toUpperCase();
      await sql`update public.users set friend_code = ${code} where id = ${session.id} and friend_code is null`;
    }

    if (req.method === 'GET') {
      const requests = await sql`select r.id, r.sender_id, r.created_at, u.display_name, u.friend_code from public.friend_requests r join public.users u on u.id = r.sender_id where r.receiver_id = ${session.id} and r.status = 'pending' order by r.created_at desc`;
      const friends = await sql`select f.friend_id, f.created_at, u.display_name, u.friend_code, u.bio from public.friendships f join public.users u on u.id = f.friend_id where f.user_id = ${session.id} order by f.created_at desc`;
      const profile = (await sql`select friend_code from public.users where id = ${session.id}`)[0];
      return res.status(200).json({ friendCode: profile?.friend_code || null, requests, friends });
    }
    if (!requireSameOrigin(req, res)) return;
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (req.method === 'POST') {
      const code = typeof body.friendCode === 'string' ? body.friendCode.trim().toUpperCase() : '';
      if (!/^VENT-[A-F0-9]{8}$/.test(code)) return res.status(400).json({ error: 'Enter a valid Ventorea friend code.' });
      const target = (await sql`select id, display_name from public.users where friend_code = ${code} limit 1`)[0];
      if (!target) return res.status(404).json({ error: 'That friend code was not found.' });
      if (target.id === session.id) return res.status(400).json({ error: 'You cannot add yourself.' });
      const already = await sql`select 1 from public.friendships where user_id = ${session.id} and friend_id = ${target.id} limit 1`;
      if (already.length) return res.status(409).json({ error: 'You are already friends.' });
      await sql`insert into public.friend_requests (sender_id,receiver_id,status) values (${session.id},${target.id},'pending') on conflict (sender_id,receiver_id) do update set status = 'pending', created_at = now()`;
      return res.status(200).json({ ok: true, displayName: target.display_name });
    }
    if (req.method === 'PUT') {
      const requestId = typeof body.requestId === 'string' ? body.requestId : '';
      const request = (await sql`update public.friend_requests set status = 'accepted' where id = ${requestId} and receiver_id = ${session.id} and status = 'pending' returning sender_id, receiver_id`)[0];
      if (!request) return res.status(404).json({ error: 'Friend request not found.' });
      await sql`insert into public.friendships (user_id,friend_id) values (${request.receiver_id},${request.sender_id}),(${request.sender_id},${request.receiver_id}) on conflict do nothing`;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const friendId = typeof body.friendId === 'string' ? body.friendId : '';
      await sql`delete from public.friendships where (user_id = ${session.id} and friend_id = ${friendId}) or (user_id = ${friendId} and friend_id = ${session.id})`;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ error: 'A friend request already exists.' });
    console.error('Friends request failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'Friends are temporarily unavailable.' });
  }
}
