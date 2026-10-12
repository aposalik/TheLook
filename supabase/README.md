# TheLook Supabase foundation

This directory contains versioned database and Storage migrations for the production architecture described in [`../PRODUCTION-ARCHITECTURE.md`](../PRODUCTION-ARCHITECTURE.md).

## Phase A outputs

`migrations/20261011231000_foundation.sql` creates:

- User-owned profiles and preferences
- Avatars and wardrobe metadata
- Saved looks and their items
- Render jobs and cache fingerprints
- Per-IP, per-user, and global usage counters
- Server-controlled render settings
- Private `avatars`, `wardrobe`, and `renders` Storage buckets
- Database and Storage Row-Level Security policies
- Automatic profile/preferences provisioning for anonymous and permanent auth users

## Ownership rule

Every private row has a `user_id`. Every private object path starts with the same user ID:

```text
avatars/{user_id}/{avatar_id}.jpg
wardrobe/{user_id}/{item_id}.png
renders/{user_id}/{render_job_id}.jpg
```

RLS compares that owner to `auth.uid()`.

Anonymous Supabase users and permanent users both use the `authenticated` PostgreSQL role, so the same ownership policies protect both.

## Local validation

The repository now includes `supabase/config.toml` and a pgTAP suite at `tests/database/rls.sql`. Do not commit access tokens, project credentials, or generated local secrets.

Typical validation flow from the repository root:

```bash
supabase start
supabase db reset
supabase db lint
supabase test db
```

`tests/database/rls.sql` verifies that two authenticated users cannot read, insert, or delete each other's wardrobe rows, and that browser clients cannot read server-owned usage/settings tables.

If Docker reports a read-only filesystem while extracting Supabase images, restart Docker Desktop and retry; this is a Docker VM/storage issue, not a migration result. Hosted linking requires the Supabase project reference and an authenticated local CLI session; never put an access token in the repository or chat.

## Dashboard configuration required later

- Enable Anonymous Sign-Ins.
- Configure Google OAuth.
- Configure verified-email authentication.
- Keep all three Storage buckets private.
- Add the Vercel production and preview callback URLs.
- Enable CAPTCHA/Turnstile before public launch.

## Secret boundaries

Safe in browser:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Server-only:

```text
SUPABASE_SERVICE_ROLE_KEY
PERFECTCORP_KEY
GEMINI_API_KEY
RATE_LIMIT_HASH_SECRET
```

The service-role key bypasses RLS. Server code using it must verify the user's Supabase session and confirm ownership before reading or writing user data.
