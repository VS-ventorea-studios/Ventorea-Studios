# Ventorea account migration: Supabase to Neon

This branch is a migration candidate. It is not the production release. Keep the current Supabase project active until the replacement is configured, imported, tested, and explicitly approved.

## Architecture

- Google remains the identity provider.
- Vercel API routes handle the OAuth authorization-code flow and issue an opaque, HttpOnly session cookie.
- Neon Postgres stores Ventorea users, profiles, sessions, friend requests, friendships, and AI moderation counters.
- The browser never receives database credentials or session tokens.
- The legacy Supabase user UUID is preserved as the new Ventorea user UUID so friend relationships keep their references.

## 1. Create the Neon database

1. Create a dedicated Neon project for Ventorea.
2. Run `database/neon-schema.sql` in the Neon SQL editor.
3. Keep the connection string private. Do not commit it or paste it into source files.

## 2. Configure Google OAuth

In Google Cloud Console, add this exact authorized redirect URI:

`https://ventoreastudios.online/api/auth/google/callback`

For a Vercel preview deployment, add a separate preview callback URI only if you plan to test OAuth on that preview domain.

## 3. Configure Vercel environment variables

Set these for the deployment environment you intend to test:

- `DATABASE_URL`: Neon connection string.
- `APP_ORIGIN`: `https://ventoreastudios.online`.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret.
- `GOOGLE_REDIRECT_URI`: `https://ventoreastudios.online/api/auth/google/callback`.
- `GEMINI_API_KEY`: existing Gemini key.
- `RESEND_API_KEY`: existing Resend key, if AI email notifications should continue.
- `SUPPORT_FROM_EMAIL`: verified Resend sender, if configured.

Never put any secret in GitHub files or frontend JavaScript. Redeploy after setting environment variables.

## 4. Back up and migrate existing data

The migration script reads directly from the Supabase Postgres database and writes to Neon.

1. Take a fresh Supabase backup first.
2. Set `SUPABASE_DB_URL` and `DATABASE_URL` in a local terminal environment. Do not commit a .env file.
3. Install dependencies with `npm install`.
4. Run `npm run migrate:supabase-to-neon`.
5. Save the printed source and target counts and compare them.
6. Run the migration again after any new source data arrives. The script uses upserts for the main account records and preserves friend request and friendship IDs.

The script deliberately stops if any Supabase user lacks a Google identity or if an identity collision exists. Resolve those records before retrying. Passwords and active Supabase sessions are not migrated. Users will sign in again with Google.

The migration script also checks for the legacy `public.ai_abuse_status` table. If it exists, moderation counters and suspension dates are copied. If it does not exist, the new table starts empty.

## 5. Test on a preview deployment first

Verify all of the following using a test account before changing production:

- Google sign-in, callback state validation, and session restoration.
- Sign-out revokes the session and clears the cookie.
- Profile name, phone, and bio save and reload.
- Friend code lookup, request, acceptance, and removal work in both directions.
- AI chat requires a signed-in session and returns a response.
- AI moderation counters and timed suspensions persist across requests.
- AI email alerts still arrive when Resend is configured.
- Account and homepage pages work on mobile and desktop.
- Existing Supabase data counts match the Neon import.

Check Vercel function logs and browser console for errors. Do not switch the production domain until all tests pass.

## 6. Production cutover and rollback

Only after preview tests pass:

1. Announce a short account-data write freeze.
2. Run a final Supabase-to-Neon migration.
3. Update production Vercel environment variables.
4. Deploy the approved migration branch.
5. Test sign-in, profile, friends, and AI immediately.
6. Keep the Supabase project and backup intact during the rollback window.

If a critical test fails, roll the Vercel deployment back and restore the previous environment variables. Do not delete Supabase until the new system has operated successfully and the owner approves permanent removal.

## Current limitations to resolve before production

- New Google sign-ins create a fresh account. Legacy account UUIDs are preserved only after the migration script imports them. A user who signs in before the import could create a duplicate identity collision, so do not enable production sign-in until the data import is complete.
- The AI moderation table was not present in the checked-in legacy schema. The migration script checks whether it exists in the source database.
- The migration branch has not been connected to a live Neon database or Google OAuth client in this workspace. Runtime verification is still required.
