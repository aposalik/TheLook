# TheLook — Production Architecture & Learning Roadmap

This document is the build contract for moving TheLook from a local hackathon demo to a private, deployable Vercel application using Supabase Auth, PostgreSQL, and private Supabase Storage.

Work phase by phase. Do not start the next phase until the current phase's **Done bar** and **Learning checkpoint** are complete.

## Locked product decisions

1. **Hosting:** Vercel hosts the Next.js application and server routes.
2. **Database:** Supabase PostgreSQL stores metadata, ownership, render jobs, and usage counters.
3. **Supabase plan:** Start on Supabase Free. It is sufficient for development, testing, and an early demo; production usage must stay within its database, Storage, egress, and inactivity-pause limits.
4. **Files:** Private Supabase Storage buckets store avatars, wardrobe cutouts, and rendered looks.
5. **Guest access:** A first-time visitor is signed in anonymously without seeing a login page.
6. **Permanent accounts:** Google and verified email are offered for returning users and cross-device use.
7. **No guest/account merge:** Guest and permanent accounts intentionally use different user IDs. Creating or signing into an account does not copy guest avatars or wardrobe items. The user uploads them again after signing in.
8. **Privacy:** Every file and row belongs to one `user_id`; no visitor can read another visitor's data.
9. **Guest capability:** Anonymous guests may upload clothes and receive recommendations, but paid YouCam **Show On Me** rendering requires a verified Google or email account.
10. **Try-on quota:** Only new, uncached **Show On Me** renders count. Outfit recommendations, uploads, cache hits, and saved-result views do not count.
11. **Initial public limit:** Each verified account receives at most two new try-ons per UTC day. IP data is a high-threshold abuse/velocity signal, not a two-render hard quota, so a home, office, or university does not unfairly share two renders. Global safety budgets cap total cost.
12. **Cleanup:** Expired anonymous accounts and their files are removed automatically after the retention period.
13. **Submission assets:** Screenshots, video, Devpost copy, and final submission happen after the hosted product flow is frozen.
3. **Files:** Private Supabase Storage buckets store avatars, wardrobe cutouts, and rendered looks.
4. **Guest access:** A first-time visitor is signed in anonymously without seeing a login page.
5. **Permanent accounts:** Google and verified email are offered for returning users and cross-device use.
6. **No guest/account merge:** Guest and permanent accounts intentionally use different user IDs. Creating or signing into an account does not copy guest avatars or wardrobe items. The user uploads them again after signing in.
7. **Privacy:** Every file and row belongs to one `user_id`; no visitor can read another visitor's data.
8. **Guest capability:** Anonymous guests may upload clothes and receive recommendations, but paid YouCam **Show On Me** rendering requires a verified Google or email account.
9. **Try-on quota:** Only new, uncached **Show On Me** renders count. Outfit recommendations, uploads, cache hits, and saved-result views do not count.
10. **Initial public limit:** Each verified account receives at most two new try-ons per UTC day. IP data is a high-threshold abuse/velocity signal, not a two-render hard quota, so a home, office, or university does not unfairly share two renders. Global safety budgets cap total cost.
11. **Cleanup:** Expired anonymous accounts and their files are removed automatically after the retention period.
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

The initial Free plan has practical limits: 500 MB database size, 1 GB file storage, 5 GB egress, 50,000 monthly active users, two active projects, and possible pausing after one week of inactivity. We will store compressed/cropped images, enforce upload limits, delete abandoned guest data, and monitor usage. Supabase Free is appropriate for development and an early demo, not a high-traffic public launch.

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
2026-10-11  ACCOUNT-456  1              2
2026-10-11  ACCOUNT-789  2              6
```

Anonymous users never receive a paid-render reservation. The next UTC day uses a new row, so the account allowance resets naturally. We do not edit yesterday's counter back to zero.

## Why IP is a signal, not the customer's allowance

### A hard IP quota is unfair

A family, office, university, café, carrier-grade mobile network, or privacy relay may put many legitimate people behind one public IP. A two-render IP cap would make unrelated users consume one shared allowance.

### IP identity is easy to rotate

A VPN, proxy pool, privacy relay, or mobile-network change can give an attacker another IP. Therefore, an IP address is neither a person nor a reliable device identifier.

### No perfect anonymous free-credit identity exists

A guest can clear cookies/local storage, create another anonymous user, and change IP. Browser fingerprinting is privacy-sensitive and still produces false positives. The reliable product boundary is therefore:

```text
guests: private wardrobe + recommendations
verified Google/email accounts: paid Show On Me rendering
```

### Layered protection

```text
verified account: hard limit of 2 new renders/day
+ IP: broad velocity/anomaly signal, never a shared 2-render allowance
+ Turnstile: anonymous signup and paid-render human check
+ Vercel WAF: short-window burst/loop protection
+ render fingerprint: cache and duplicate in-flight lock
+ global daily and total-credit circuit breakers
```

No single layer proves that requests come from one human. Together they make abuse expensive while placing an absolute ceiling on financial damage.

Start IP rules in log/observe or managed-challenge mode with conservative, high thresholds. Tune them from real traffic; do not invent a low hard threshold before measuring shared-network behavior. If Enterprise Turnstile is purchased later, its short-lived Ephemeral ID can help detect high-volume IP rotation, but Cloudflare explicitly warns that it is not guaranteed unique and should not identify individual users.

### Research basis

- [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous): anonymous users are real authenticated users, but Supabase recommends CAPTCHA/Turnstile because fake anonymous accounts can inflate database usage; its built-in anonymous-signup protection is IP-based.
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits): Auth uses token buckets for IP-limited endpoints. These protect Auth itself; they do not replace TheLook's paid-operation quota.
- [Cloudflare Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): server verification is mandatory; tokens expire after five minutes and are single-use.
- [Cloudflare Ephemeral IDs](https://developers.cloudflare.com/turnstile/additional-configuration/ephemeral-id/): they can recognize high-volume IP rotation without cookies, but are Enterprise-only and not guaranteed unique.
- [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting): all plans can apply short-window edge limits; Hobby/Pro can count by IP or JA4 digest, and counters are regional.
- [OWASP DoS guidance](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html): use layered defenses, perform cheap validation before expensive work, apply graceful degradation, cache results, and cap resource-intensive operations.

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
1. Browser sends avatar ID, garment IDs, and a fresh Turnstile token.
2. Vercel verifies the Supabase access token.
3. Vercel derives user ID from the verified token; it never trusts a body user_id.
4. Vercel rejects anonymous or unverified users before any paid work.
5. Vercel confirms all selected rows belong to that user.
6. Vercel calculates the render fingerprint.
7. A successful cached render returns immediately and consumes no allowance.
8. Vercel validates the single-use Turnstile token server-side, including hostname/action checks.
9. Vercel HMAC-hashes the trusted x-forwarded-for IP for aggregate velocity analysis; raw IP is not stored.
10. PostgreSQL atomically reserves the verified user's and global quota.
11. A unique in-flight fingerprint prevents duplicate clicks.
12. Vercel downloads private avatar/garment files.
13. Vercel calls YouCam and polls for completion.
14. Vercel uploads the result to private renders Storage.
15. PostgreSQL marks the job completed.
16. The browser receives a short-lived result URL and remaining allowance.
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
- Add Turnstile to anonymous signup and permanent registration/sign-in as supported by Supabase Auth.
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

- Require a non-anonymous, verified Google/email account for paid rendering.
- Read Vercel's trusted `x-forwarded-for` header and HMAC-hash IPs with a server-only secret.
- Record IP aggregates only for broad velocity/anomaly detection; do not enforce a shared two-render IP allowance.
- Add an atomic PostgreSQL quota-reservation function.
- Enforce two new renders per verified user/day.
- Add configurable global daily and total budgets.
- Add fingerprint cache and duplicate in-flight lock.
- Add refund behavior for pre-YouCam failures.
- Validate a fresh, single-use Turnstile token server-side before expensive renders.
- Add a Vercel WAF short-window burst rule in log mode, then tune/challenge from observed traffic.
- Show remaining daily renders and reset time.
- Add an emergency real-render kill switch.

**Done bar**

- Guest Show On Me requests are rejected before YouCam; recommendations remain available.
- A verified account's third uncached render receives HTTP 429.
- Multiple legitimate accounts on one shared IP retain their own allowance.
- Cache hits remain available without consuming quota.
- Parallel double-clicks create one YouCam job.
- Raw IP addresses never enter PostgreSQL or logs.

**Learning checkpoint**

- Walk through the atomic transaction and race condition it prevents.
- Explain why the verified-user quota is hard, IP is only a broad risk signal, and global budgets are the financial circuit breaker.

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
- Private-data isolation, account-only rendering, shared-IP fairness, and two-per-verified-user limits pass production tests.
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
