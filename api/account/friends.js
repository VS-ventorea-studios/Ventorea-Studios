import { assertSameOrigin, getSessionUser, noStore } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req, res) {
  noStore(res);
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in with Google to use friends.' });
    if (req.method !== 'GET' && !assertSameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
    const db = getDb();

    if (req.method === 'GET') {
      const [requests, friends, ownProfile] = await Promise.all([
        db.query(
          `select r.id::text as id, r.sender_id::text as sender_id, u.display_name as sender_name,
                  p.friend_code as sender_code, r.created_at
           from app.friend_requests r
           join app.users u on u.id = r.sender_id
           left join app.profiles p on p.user_id = u.id
           where r.receiver_id = $1 and r.status = 'pending'
           order by r.created_at desc`,
          [user.id]
        ),
        db.query(
          `select f.friend_id::text as friend_id, u.display_name, p.friend_code, p.bio, f.created_at
           from app.friendships f
           join app.users u on u.id = f.friend_id
           left join app.profiles p on p.user_id = u.id
           where f.user_id = $1
           order by f.created_at desc`,
          [user.id]
        ),
        db.query('select friend_code from app.profiles where user_id = $1', [user.id])
      ]);
      return res.status(200).json({
        requests: requests.rows,
        friends: friends.rows,
        friendCode: ownProfile.rows[0]?.friend_code || ''
      });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');
      if (action !== 'send') return res.status(400).json({ error: 'Unknown friends action.' });
      const code = String(req.body?.friendCode || '').trim().toUpperCase().slice(0, 16);
      if (!code) return res.status(400).json({ error: 'Enter a friend code.' });
      const target = await db.query(
        `select p.user_id::text as user_id, p.display_name
         from app.profiles p where upper(p.friend_code) = $1 limit 1`,
        [code]
      );
      if (!target.rowCount) return res.status(404).json({ error: 'That friend code was not found.' });
      if (target.rows[0].user_id === user.id) return res.status(400).json({ error: 'You cannot add yourself.' });
      const alreadyFriends = await db.query(
        'select 1 from app.friendships where user_id = $1 and friend_id = $2',
        [user.id, target.rows[0].user_id]
      );
      if (alreadyFriends.rowCount) return res.status(409).json({ error: 'You are already friends.' });
      try {
        await db.query(
          `insert into app.friend_requests (sender_id, receiver_id, status)
           values ($1, $2, 'pending')`,
          [user.id, target.rows[0].user_id]
        );
      } catch (error) {
        if (error?.code === '23505') return res.status(409).json({ error: 'You already sent a request to this person.' });
        throw error;
      }
      return res.status(201).json({ ok: true, message: 'Friend request sent.' });
    }

    if (req.method === 'PATCH') {
      const requestId = String(req.body?.requestId || '');
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return res.status(400).json({ error: 'Invalid friend request.' });
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const updated = await client.query(
          `update app.friend_requests set status = 'accepted'
           where id = $1 and receiver_id = $2 and status = 'pending'
           returning sender_id::text as sender_id`,
          [requestId, user.id]
        );
        if (!updated.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'This friend request is no longer available.' });
        }
        const senderId = updated.rows[0].sender_id;
        await client.query(
          `insert into app.friendships (user_id, friend_id)
           values ($1,$2),($2,$1) on conflict (user_id,friend_id) do nothing`,
          [user.id, senderId]
        );
        await client.query('COMMIT');
        return res.status(200).json({ ok: true });
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }

    const friendId = String(req.body?.friendId || '');
    if (!/^[0-9a-f-]{36}$/i.test(friendId)) return res.status(400).json({ error: 'Invalid friend account.' });
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'delete from app.friendships where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)',
        [user.id, friendId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Friends API failed:', error?.message || 'database error');
    return res.status(503).json({ error: 'The friends service is temporarily unavailable.' });
  }
}
