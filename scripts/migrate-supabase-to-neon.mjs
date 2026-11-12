import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

const sourceUrl = process.env.SUPABASE_DB_URL;
const targetUrl = process.env.DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error('Set SUPABASE_DB_URL and DATABASE_URL in your local environment. Do not commit either value.');
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error('Source and target database URLs must be different.');
  process.exit(1);
}

const source = new Pool({ connectionString: sourceUrl, max: 2, ssl: { rejectUnauthorized: true } });
const target = new Pool({ connectionString: targetUrl, max: 2, ssl: { rejectUnauthorized: true } });

function displayName(user) {
  const meta = user.raw_user_meta_data || {};
  return String(meta.display_name || meta.full_name || meta.name || user.email?.split('@')[0] || 'Ventorea member')
    .trim().slice(0, 80) || 'Ventorea member';
}

function makeFriendCode() {
  return 'VENT-' + randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

async function main() {
  const schema = await readFile(new URL('../database/neon-schema.sql', import.meta.url), 'utf8');
  await target.query(schema);

  const [usersResult, identitiesResult, profilesResult, requestsResult, friendshipsResult, abuseTableResult] = await Promise.all([
    source.query(`select id::text as id, email, email_confirmed_at, created_at, updated_at,
                         last_sign_in_at, raw_user_meta_data, raw_app_meta_data
                  from auth.users where deleted_at is null order by created_at`),
    source.query(`select user_id::text as user_id, provider_id
                  from auth.identities where provider = 'google'`),
    source.query(`select user_id::text as user_id, display_name, bio, friend_code, updated_at, avatar_url
                  from public.profiles`),
    source.query(`select id::text as id, sender_id::text as sender_id,
                         receiver_id::text as receiver_id, status, created_at
                  from public.friend_requests`),
    source.query(`select user_id::text as user_id, friend_id::text as friend_id, created_at
                  from public.friendships`),
    source.query(`select to_regclass('public.ai_abuse_status') is not null as exists`)
  ]);

  const identityByUser = new Map();
  for (const identity of identitiesResult.rows) {
    if (identityByUser.has(identity.user_id)) {
      throw new Error('More than one Google identity was found for a Supabase user. Resolve identity mapping before migration.');
    }
    identityByUser.set(identity.user_id, identity.provider_id);
  }

  const profilesByUser = new Map(profilesResult.rows.map(row => [row.user_id, row]));
  const users = usersResult.rows.map(user => {
    const googleSub = identityByUser.get(user.id);
    if (!googleSub) throw new Error('A Supabase account has no Google provider subject. Migration stopped before import.');
    if (!user.email) throw new Error('A Supabase account has no email address. Migration stopped before import.');
    const profile = profilesByUser.get(user.id);
    const meta = user.raw_user_meta_data || {};
    return {
      id: user.id,
      googleSub,
      email: user.email,
      emailVerified: Boolean(user.email_confirmed_at),
      displayName: String(profile?.display_name || displayName(user)).trim().slice(0, 80) || 'Ventorea member',
      avatarUrl: profile?.avatar_url || meta.avatar_url || meta.picture || null,
      phoneNumber: String(meta.phone_number || '').slice(0, 32),
      bio: String(profile?.bio ?? meta.bio ?? '').slice(0, 280),
      createdAt: user.created_at,
      updatedAt: user.updated_at || user.created_at,
      lastLoginAt: user.last_sign_in_at || null,
      friendCode: profile?.friend_code || null,
      profileUpdatedAt: profile?.updated_at || user.updated_at || user.created_at
    };
  });

  const client = await target.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    // Refuse to merge two different legacy accounts into one Google identity.
    for (const user of users) {
      const collision = await client.query(
        'select id::text as id from app.users where google_sub = $1 and id <> $2',
        [user.googleSub, user.id]
      );
      if (collision.rowCount) {
        throw new Error('A Google identity is already linked to a different target account. Resolve the collision before importing.');
      }
    }

    for (const user of users) {
      await client.query(
        `insert into app.users
          (id, google_sub, email, email_verified, display_name, avatar_url, created_at,
           updated_at, last_login_at, legacy_supabase_user_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$1)
         on conflict (id) do update set
           google_sub = excluded.google_sub,
           email = excluded.email,
           email_verified = excluded.email_verified,
           display_name = excluded.display_name,
           avatar_url = excluded.avatar_url,
           updated_at = excluded.updated_at,
           last_login_at = excluded.last_login_at,
           legacy_supabase_user_id = excluded.legacy_supabase_user_id`,
        [user.id,user.googleSub,user.email,user.emailVerified,user.displayName,user.avatarUrl,user.createdAt,user.updatedAt,user.lastLoginAt]
      );

      let friendCode = user.friendCode;
      if (!friendCode) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const candidate = makeFriendCode();
          const exists = await client.query('select 1 from app.profiles where friend_code = $1', [candidate]);
          if (!exists.rowCount) { friendCode = candidate; break; }
        }
        if (!friendCode) throw new Error('Could not generate a unique friend code. Retry the migration.');
      }

      await client.query(
        `insert into app.profiles
          (user_id, display_name, bio, phone_number, friend_code, avatar_url, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (user_id) do update set
           display_name = excluded.display_name,
           bio = excluded.bio,
           phone_number = excluded.phone_number,
           friend_code = excluded.friend_code,
           avatar_url = excluded.avatar_url,
           updated_at = excluded.updated_at`,
        [user.id,user.displayName,user.bio,user.phoneNumber,friendCode,user.avatarUrl,user.profileUpdatedAt]
      );
    }

    for (const row of requestsResult.rows) {
      await client.query(
        `insert into app.friend_requests (id,sender_id,receiver_id,status,created_at)
         values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
        [row.id,row.sender_id,row.receiver_id,row.status,row.created_at]
      );
    }

    for (const row of friendshipsResult.rows) {
      await client.query(
        `insert into app.friendships (user_id,friend_id,created_at)
         values ($1,$2,$3) on conflict (user_id,friend_id) do nothing`,
        [row.user_id,row.friend_id,row.created_at]
      );
    }

    if (abuseTableResult.rows[0]?.exists) {
      const abuse = await source.query(
        `select user_id::text as user_id, swear_count, suspension_level, suspended_until
         from public.ai_abuse_status`
      );
      for (const row of abuse.rows) {
        await client.query(
          `insert into app.ai_abuse_status (user_id,swear_count,suspension_level,suspended_until)
           values ($1,$2,$3,$4)
           on conflict (user_id) do update set
             swear_count = excluded.swear_count,
             suspension_level = excluded.suspension_level,
             suspended_until = excluded.suspended_until,
             updated_at = now()`,
          [row.user_id,row.swear_count,row.suspension_level,row.suspended_until]
        );
      }
    }

    const counts = await client.query(`
      select
        (select count(*)::int from app.users) as users,
        (select count(*)::int from app.profiles) as profiles,
        (select count(*)::int from app.friend_requests) as friend_requests,
        (select count(*)::int from app.friendships) as friendships,
        (select count(*)::int from app.ai_abuse_status) as ai_abuse_records
    `);
    await client.query('COMMIT');
    committed = true;
    console.log(JSON.stringify({
      importedUsers: users.length,
      sourceProfiles: profilesResult.rowCount,
      sourceFriendRequests: requestsResult.rowCount,
      sourceFriendships: friendshipsResult.rowCount,
      sourceHadAiAbuseTable: Boolean(abuseTableResult.rows[0]?.exists),
      targetCounts: counts.rows[0],
      note: 'Sessions were intentionally not migrated. All users must sign in again with Google.'
    }, null, 2));
  } catch (error) {
    if (!committed) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch(error => {
    console.error('Migration stopped:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([source.end(), target.end()]);
  });
