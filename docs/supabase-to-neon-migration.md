# Ventorea Studios: Supabase to Neon migration

## Status

- Work branch: `migration/replace-supabase-auth`
- Production `main` is unchanged.
- Supabase remains the active authentication and data provider.
- No Supabase data has been deleted or modified.
- Replacement database: Neon Postgres, pending account connection and provisioning.
- Google OAuth credentials: pending confirmation/configuration for the Vercel callback.

## Live source inventory

Audited against Supabase project `ncmthgqsrkasesfqvuzk` on 2026-11-12.

| Resource | Live state |
| --- | ---: |
| Supabase Auth users | 5 |
| Google identities | 5 |
| `public.profiles` rows | 3 |
| `public.friend_requests` rows | 0 |
| `public.friendships` rows | 0 |
| Profile avatar URLs populated | 0 |
| `public.ai_abuse_status` table | Not present |
| `feedback` / `feedback_attachments` tables | Not present |
| `feedback-attachments` storage objects | 0 |
| `ventorea-avatars` storage objects | 0 |

The live `profiles` table has an `avatar_url` column. Preserve it even though the checked-in original schema file does not include it.

The five Supabase users are Google-authenticated. Their Google provider subject IDs must be exported from `auth.identities.provider_id` and mapped to the new account rows. Existing Supabase UUIDs are retained as the new `app.users.id` values so profile and friendship foreign keys remain stable.

## New database model

See [database/neon-schema.sql](../database/neon-schema.sql).

- `app.users`: Google subject, verified email, public account name, legacy Supabase UUID.
- `app.sessions`: hashed opaque session tokens. Raw tokens exist only in secure HttpOnly cookies.
- `app.profiles`: display name, bio, friend code and avatar URL.
- `app.friend_requests` and `app.friendships`: preserve the existing social model.
- `app.ai_abuse_status`: create a durable moderation counter table because the current API references it, but the live Supabase project does not contain it.

The Neon `app` schema is private. Only Vercel server functions should connect to it. Do not expose it through a browser-side database API.

## Required Vercel environment variables

Set only after the Neon database and Google OAuth client exist:

- `DATABASE_URL`: Neon pooled connection string.
- `GOOGLE_CLIENT_ID`: Google OAuth web client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth web client secret.
- `GOOGLE_REDIRECT_URI`: `https://ventoreastudios.online/api/auth/google/callback`.
- `SESSION_SECRET`: random secret of at least 32 bytes, used to sign session cookies.
- `APP_ORIGIN`: `https://ventoreastudios.online`.

Existing `GEMINI_API_KEY` and `RESEND_API_KEY` must remain untouched.

## Migration and identity continuity

1. Back up the Supabase database before export.
2. Create the Neon schema.
3. Export `auth.users`, Google identities, profiles, friend requests and friendships from Supabase.
4. Import all five existing accounts with their original UUIDs and Google subject IDs.
5. Import profiles and social records. The current friend request and friendship tables are empty.
6. Do not migrate Supabase refresh tokens or active sessions. Everyone signs in again once through Google. The new callback matches by Google subject and returns the same account UUID.
7. Validate row counts and foreign keys in Neon before switching the application.
8. Test Google sign-in, account settings, profile edits, friends, AI authentication, AI moderation and logout on a preview deployment.
9. Switch production only after those tests pass.
10. Keep Supabase active and backed up until the owner confirms the replacement works. Only then remove Supabase dependencies and disable the old project.

## Important blockers

- Neon is not yet connected to this ChatGPT workspace, so the replacement database cannot be provisioned or queried here yet.
- The Google OAuth client ID and secret are not present in the Vercel project environment. The owner must configure or provide the Google OAuth web credentials through a secure secret-setting flow.
- No user passwords or Supabase sessions are migrated. Google sign-in is the account recovery path.
