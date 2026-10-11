# TheLook — Production Architecture & Learning Roadmap

This document is the build contract for moving TheLook from a local hackathon demo to a private, deployable Vercel application using Supabase Auth, PostgreSQL, and private Supabase Storage.

Work phase by phase. Do not start the next phase until the current phase's **Done bar** and **Learning checkpoint** are complete.

## Locked product decisions

1. **Hosting:** Vercel hosts the Next.js application and server routes.
2. **Database:** Supabase PostgreSQL stores metadata, ownership, render jobs, and usage counters.
3. **Files:** Private Supabase Storage buckets store avatars, wardrobe cutouts, and rendered looks.
4. **Guest access:** A first-time visitor is signed in anonymously without seeing a login page.
5. **Permanent accounts:** Google and verified email are offered for returning users and cross-device use.
6. **No guest/account merge:** Guest and permanent accounts intentionally use different user IDs. Creating or signing into an account does not copy guest avatars or wardrobe items. The user uploads them again after signing in.
7. **Privacy:** Every file and row belongs to one `user_id`; no visitor can read another visitor's data.
8. **Try-on quota:** Only new, uncached **Show On Me** renders count. Outfit recommendations, uploads, cache hits, and saved-result views do not count.
9. **Initial public limit:** At most two new try-ons per IP per UTC day and two per Supabase user per UTC day, plus global safety budgets.
10. **Cleanup:** Expired anonymous accounts and their files are removed automatically after the retention period.
11. **Submission assets:** Screenshots, video, Devpost copy, and final submission happen after the hosted product flow is frozen.

## Mental model

- **Supabase Auth** is the passport office: it tells us who is making a request.
- **PostgreSQL** is the index: it stores metadata and ownership, not large image bytes.
- **Supabase Storage** is the private warehouse: it stores actual images.
- **Row-Level Security (RLS)** is the guard: it rejects attempts to access another user's rows/files.
- **Vercel** runs the website and trusted server operations.
- **Gemini** analyzes garments and reranks valid outfits.
- **YouCam** creates the virtual try-on image.

## System architecture

```text
Browser / Next.js UI
  ├── Supabase Auth (anonymous, Google, verified email)
  ├── PostgreSQL through RLS (user-owned metadata)
  ├── Private Storage through RLS (user-owned images)
  └── Vercel route handlers
        ├── verify Supabase session
        ├── enforce ownership and quotas
        ├── call Gemini
        ├── call YouCam
        └── write private render results to Supabase
```

The browser may use the Supabase publishable key. It must never receive:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PERFECTCORP_KEY`
- `GEMINI_API_KEY`
- `RATE_LIMIT_HASH_SECRET`

Those values live only in Vercel's protected environment configuration and local ignored `.env.local` files.

## Guest and permanent account behavior

### First visit

```text
No session
  → signInAnonymously()
  → Supabase creates guest user ID GUEST-123
  → all guest data belongs to GUEST-123
```

### User creates or signs into a permanent account

Per the product decision, TheLook does **not** merge guest data:

```text
Guest user GUEST-123
  → choose Create account / Sign in
  → show warning: guest wardrobe will not transfer
  → confirm
  → create/sign into permanent user ACCOUNT-456
  → account wardrobe starts empty
  → user uploads account images again
```

The old guest data remains private under `GUEST-123` until the anonymous cleanup job deletes it. The interface must communicate this before switching sessions.

### Why this is simpler

- No data-conflict rules.
- No dangerous ownership reassignment.
- No need to prove two sessions belong to the same human.
- Much smaller hackathon implementation.

The tradeoff is that users must upload their images again after creating/signing into an account.

## PostgreSQL tables

### User-owned product data

```text
profiles
  id                  uuid, same as auth user ID
  display_name        text
  created_at          timestamp

avatars
  id                  uuid
  user_id             uuid
  storage_path        text
  width               integer
  height              integer
  created_at          timestamp

wardrobe_items
  id                  uuid
  user_id             uuid
  storage_path        text
  title               text
  category            text
  subcategory         text
  layer               text
  dominant_color      text
  palette             text
  color_role          text
  fit                 text
  formality           integer
  styles              text[]
  seasons             text[]
  material            text
  created_at          timestamp

saved_looks
  id                  uuid
  user_id             uuid
  render_path         text
  stylist_title       text
  formula             text
  cohesion            numeric
  created_at          timestamp

saved_look_items
  look_id             uuid
  wardrobe_item_id    uuid
  role                text
  position            integer
```

### Render and protection data

```text
render_jobs
  id                  uuid
  user_id             uuid
  avatar_id           uuid
  fingerprint         text
  status              text
  result_path         text
  youcam_units        integer
  error_code          text
  created_at          timestamp
  completed_at        timestamp

daily_ip_usage
  day                 date
  ip_hash             text
  try_on_count        integer
  youcam_units        integer

daily_user_usage
  day                 date
  user_id             uuid
  try_on_count        integer
  youcam_units        integer

global_usage
  day                 date
  try_on_count        integer
  youcam_units        integer
```

## Usage counters in plain language

A usage table is a daily notebook. Each row answers: “How many new renders has this identity used today?”

Example IP rows:

```text
day         ip_hash     try_on_count   youcam_units
2026-10-11  HOME-AAA    1              4
2026-10-11  OFFICE-BBB  2              6
2026-10-12  HOME-AAA    0              0
```

- `day`: which UTC calendar day the counter belongs to.
- `ip_hash`: a one-way HMAC of the public IP. The raw IP is never stored.
- `try_on_count`: number of new uncached Show On Me requests accepted that day.
- `youcam_units`: estimated/actual YouCam units consumed by those requests.

Example user rows:

```text
day         user_id      try_on_count   youcam_units
2026-10-11  GUEST-123    2              6
2026-10-11  ACCOUNT-456  1              2
```

The next UTC day uses a new row, so the daily allowance resets naturally. We do not need to edit yesterday's counter back to zero.

## Why both IP and user counters exist

### User-only limit is easy to bypass

A person could clear browser storage or create multiple accounts, producing new user IDs and receiving more renders.

### IP-only limit is imperfect

- A family, office, university, or café may share one public IP, so legitimate users share the allowance.
- A VPN or mobile-network change gives an attacker a different IP.

### Layered protection

```text
user daily limit
+ IP daily limit
+ global daily limit
+ global total budget
+ duplicate-render lock
+ Cloudflare Turnstile
```

No single layer is perfect. Together they make abuse expensive and cap the maximum damage.

The initial strict policy is two per IP and two per user daily. During QA, review whether shared-network fairness requires raising only the IP ceiling while keeping the user ceiling at two.

## What counts as a try-on

Counts:

- A new uncached Show On Me request that is accepted for YouCam processing.

Does not count:

- Generate Outfit.
- Gemini reranking.
- Uploading wardrobe items.
- Opening a saved result.
- Returning an identical cached result.
- A failure before any YouCam task is created.

If YouCam accepted a task, keep the reservation because units may have been consumed even if the final result fails.

## Private Storage layout

Use three private buckets:

```text
avatars/{user_id}/{avatar_id}.jpg
wardrobe/{user_id}/{wardrobe_item_id}.png
renders/{user_id}/{render_job_id}.jpg
```

Storage policies verify that the first folder equals the authenticated user's ID. Images are displayed through authenticated downloads or short-lived signed URLs, never public bucket URLs.

## Row-Level Security rule

Every user-owned table follows the same rule:

```text
auth.uid() must equal row.user_id
```

For example, User A cannot read User B's wardrobe even if User A manually calls the Supabase API with User B's row ID.

The Supabase service-role key bypasses RLS. Server code using it must first verify the caller's session and explicitly confirm row ownership.

## Vercel render flow

```text
1. Browser sends avatar ID and garment IDs.
2. Vercel verifies the Supabase access token.
3. Vercel derives user ID from the verified token; it never trusts a body user_id.
4. Vercel confirms all rows belong to that user.
5. Vercel calculates the render fingerprint.
6. A successful cached render returns immediately and consumes no allowance.
7. Vercel HMAC-hashes the trusted x-forwarded-for IP.
8. PostgreSQL atomically reserves IP, user, and global quota.
9. A unique in-flight fingerprint prevents duplicate clicks.
10. Vercel downloads private avatar/garment files.
11. Vercel calls YouCam and polls for completion.
12. Vercel uploads the result to private renders Storage.
13. PostgreSQL marks the job completed.
14. The browser receives a short-lived result URL and remaining allowance.
```

Vercel Functions are stateless. Do not use local files or in-memory counters for production persistence.

## Cleanup and retention

Supabase does not automatically delete abandoned anonymous users. A scheduled cleanup job will:

1. Find anonymous users older than the retention period (initially 30 days).
2. Delete their private Storage objects.
3. Delete their PostgreSQL rows.
4. Delete the anonymous auth user.
5. Delete expired render jobs and old failed-job diagnostics.

Permanent accounts retain data until the user deletes it. The UI must provide:

- Delete avatar.
- Delete wardrobe item.
- Delete saved look.
- Delete all my data/account.

## Implementation phases

### Phase A — Supabase foundation

**Build**

- Create `supabase/` project configuration and versioned SQL migrations.
- Define tables, foreign keys, constraints, indexes, and enums/check constraints.
- Create private `avatars`, `wardrobe`, and `renders` buckets.
- Enable RLS on all private tables.
- Add ownership policies for database rows and Storage paths.
- Add generated profile creation for new auth users.
- Add local type-generation instructions.

**Done bar**

- SQL migration applies cleanly to a fresh Supabase project.
- Two test users cannot access each other's rows or files.
- Service-role usage is documented and server-only.

**Learning checkpoint**

- Explain Auth versus PostgreSQL versus Storage.
- Explain primary keys, foreign keys, indexes, and RLS.
- Show one allowed and one rejected ownership query.

### Phase B — Authentication integration

**Build**

- Install Supabase browser/server libraries.
- Add browser and server clients.
- Create an anonymous session on first visit.
- Add account menu and session state.
- Add Google and verified-email registration/sign-in.
- Add explicit no-merge warning before leaving a guest session.
- Ensure account creation/sign-in starts an empty account wardrobe.
- Add sign-out and session-refresh handling.

**Done bar**

- New visitors enter as anonymous users with no login wall.
- Permanent account users can register, sign in, sign out, and return.
- Guest data is not visible in the permanent account.

**Learning checkpoint**

- Inspect an anonymous JWT and permanent session conceptually.
- Explain cookies/session refresh and why user IDs come from verified sessions.

### Phase C — Private Storage migration

**Build**

- Upload processed wardrobe cutouts to the user's private folder.
- Upload avatars to the user's private folder.
- Upload generated renders to private Storage.
- Replace base64/local file references with storage paths.
- Add authenticated downloads/signed URLs.
- Add delete operations and rollback on partial upload failure.

**Done bar**

- Images persist across refresh and devices for permanent accounts.
- One user cannot list or download another user's images.
- No production route writes to `public/results`.

**Learning checkpoint**

- Explain why PostgreSQL stores paths/metadata while Storage stores bytes.
- Trace an upload from browser to bucket to database row.

### Phase D — PostgreSQL application migration

**Build**

- Persist avatars, wardrobe metadata, preferences, saved looks, and look items.
- Replace image-heavy localStorage state with database queries.
- Keep only harmless UI preferences locally where appropriate.
- Add a safe one-time migration for existing browser-local data within the same guest identity.
- Add loading, offline, empty, and database-error states.

**Done bar**

- Refreshing the app reconstructs state from Supabase.
- Permanent users see their data on another device.
- Browser storage no longer contains large base64 images.

**Learning checkpoint**

- Explain CRUD, joins, transactions, and optimistic UI.
- Inspect the queries used by each screen.

### Phase E — YouCam credit protection

**Build**

- Read Vercel's trusted `x-forwarded-for` header.
- HMAC-hash IPs with a server-only secret.
- Add atomic PostgreSQL quota-reservation function.
- Enforce two new renders per IP/day and user/day.
- Add configurable global daily and total budgets.
- Add fingerprint cache and duplicate in-flight lock.
- Add refund behavior for pre-YouCam failures.
- Add Turnstile before expensive public renders.
- Show remaining daily renders and reset time.
- Add an emergency real-render kill switch.

**Done bar**

- Third uncached render receives HTTP 429.
- Cache hits remain available without consuming quota.
- Parallel double-clicks create one YouCam job.
- Raw IP addresses never enter PostgreSQL or logs.

**Learning checkpoint**

- Walk through the atomic transaction and race condition it prevents.
- Explain user, IP, and global limits with concrete rows.

### Phase F — Vercel deployment and production validation

**Build**

- Configure protected environment variables in Vercel.
- Configure Supabase site/callback URLs and OAuth redirects.
- Align Vercel/Supabase regions where practical.
- Configure function duration for the existing YouCam polling ceiling.
- Deploy preview, then production.
- Test two-browser privacy, auth, quota, cache, and real-render paths.
- Add production monitoring without logging images, raw IPs, or secrets.

**Done bar**

- The public production URL completes the full user journey.
- Private-data isolation and two-per-day limits pass production tests.
- No persistent behavior depends on Vercel's local filesystem.

**Learning checkpoint**

- Explain build-time versus runtime environment variables.
- Trace one production request across Vercel, Supabase, and YouCam.

### Phase G — Cleanup and operations

**Build**

- Schedule anonymous-user cleanup after 30 days.
- Remove orphaned Storage objects and failed render jobs.
- Add Delete my data/account.
- Add admin-only aggregate usage view with no private images/raw IPs.
- Add storage/usage alerts and document incident controls.
- Confirm backups and migration rollback procedure.

**Done bar**

- Cleanup is idempotent and tested in dry-run mode.
- User deletion removes database and Storage data.
- Admin can disable new paid renders without redeploying.

**Learning checkpoint**

- Explain retention, cascading deletion, idempotency, and operational runbooks.

### Phase H — Final QA and submission assets

**Build**

- Mobile acceptance testing.
- Accessibility and privacy review.
- Final README architecture update.
- Screenshots.
- 1–3 minute demo video.
- Devpost write-up and final submission.

**Done bar**

- Hosted demo, repository, screenshots, video, and submission text are complete.

## Educational reporting format

At the end of every phase, record:

1. **What we built** — user-visible and backend behavior.
2. **Why it exists** — the problem it solves.
3. **Architecture flow** — one request traced end to end.
4. **Files changed** — migrations, routes, components, and configuration.
5. **Security lesson** — ownership, secrets, validation, or abuse prevention.
6. **Verification evidence** — tests and commands that passed.
7. **Known limitations** — intentionally deferred work.
8. **Next phase** — prerequisites and exact goal.

## Build order

```text
A. Schema + RLS
B. Auth
C. Private Storage
D. App data migration
E. Credit protection
F. Vercel deployment
G. Cleanup/operations
H. Final submission assets
```

This order is deliberate: identity and ownership must exist before storing private files, and durable storage must exist before production rendering and deployment.
