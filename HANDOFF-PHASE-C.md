# TheLook Phase C Handoff — Private Supabase Storage

Use this file as context when continuing Phase C. The project is in `/Users/abdullahsalik/.openclaw/workspace/FitRoom-YouCam`.

## Current state

- Phase A / production foundation is complete on hosted Supabase Free.
- Phase B / authentication build is locally implemented and verified by typecheck, production build, ESLint with 0 errors, secret scan, diff check, and HTTP smoke test.
- Phase B branch: `feat/supabase-auth`.
- Latest local Phase B commits: `ea657b2`, `880603e`, `a1d87eb`.
- Phase A foundation branch/commits remain in history, including `5f938a1`.
- Hosted Supabase project reference: `otmdhnjvzqtwzhlyioqs`.
- Hosted migration was applied manually through Supabase SQL Editor.
- Verified hosted tables include `wardrobe_items`; all 11 application tables have RLS enabled; private buckets exist: `avatars`, `wardrobe`, `renders`.
- Local Docker/Supabase is intentionally skipped because the Mac has limited disk and Docker image extraction hit a read-only filesystem.
- GitHub pushes may fail through the OpenClaw gateway because its TLS certificate has been invalid. Never bypass TLS verification.

## Product decisions — do not change

- Guests receive anonymous Supabase identities.
- Guests may upload avatars/clothes and generate recommendations.
- Guest avatar/wardrobe data remains browser-local for now.
- Creating or signing into a permanent account never merges guest data.
- A permanent account starts with an empty wardrobe and must upload again.
- Paid YouCam `Show On Me` requires a verified Google or email account.
- Verified accounts receive two new uncached renders per UTC day.
- IP is only a broad high-threshold abuse signal, never a hard two-render shared-IP quota.
- Supabase Free is the current plan: keep image sizes/storage/egress low.
- Never expose or commit secrets, API keys, service-role keys, `.env.local`, or authentication tokens.

## Phase C objective

Move permanent-account image bytes from browser/local filesystem behavior to private Supabase Storage. Keep guest data browser-local. Do not fully migrate metadata/localStorage to Postgres yet; that is Phase D.

## Phase C build scope

1. Add typed browser Storage helpers using the existing Supabase client.
2. For permanent users only, upload processed wardrobe images to:
   `wardrobe/{user_id}/{item_id}.png`
3. Upload permanent-user avatars to:
   `avatars/{user_id}/{avatar_id}.jpg`
4. Upload generated permanent-user renders to:
   `renders/{user_id}/{render_job_id}.jpg` when the render path is ready.
5. Store storage paths and safe metadata in the already-created tables where appropriate; avoid duplicating large base64 images in Postgres.
6. Use authenticated downloads or short-lived signed URLs; never make buckets public.
7. Add delete operations for avatars/items and clean up Storage if the database insert fails.
8. Keep guests on browser-local storage with an explicit clear explanation.
9. Do not modify the no-merge behavior.
10. Avoid spending YouCam credits; use mock mode and cached results for development.

## Required verification

- TypeScript passes.
- ESLint has 0 errors.
- Production build passes.
- `git diff --check` passes.
- No secrets are added.
- Permanent-user upload writes only inside that user's UUID folder.
- Guest flow does not upload to Supabase Storage.
- A second user cannot list/read/download/delete the first user's objects.
- Failed database metadata writes remove any just-uploaded object.
- No production route writes durable renders to `public/results` after Phase C.
- Explain exactly what was verified manually in the hosted Dashboard and what remains unverified.

## Progress/memory discipline

Before work, read:

- `AGENTS.md`
- `PRODUCTION-ARCHITECTURE.md`
- `PHASES.md`
- `README.md`
- this file
- `_progress/current-session-summary.md` if present
- `_progress/supabase-auth.json`

During work:

- Maintain `_progress/phase-c-storage.json` as valid JSON.
- After each major step, update `completedSteps`, `nextStep`, `outputFiles`, `blocker`, and `updatedAt`.
- Update the repository's `MEMORY.md` if it exists; otherwise update `memory/YYYY-MM-DD.md` in the OpenClaw workspace with durable decisions only.
- Update `PRODUCTION-ARCHITECTURE.md`, `PHASES.md`, `README.md`, and relevant `supabase/README.md` sections when behavior or setup changes.
- Do not claim Phase C complete until its Done bar is met.
- Commit focused changes on a branch such as `feat/supabase-storage`.
- Try to push normally. If TLS blocks push, report the exact blocker and never disable TLS.

## Phase C completion report format

At the end, report:

- What was built
- Why it was built
- Guest flow versus permanent-account flow
- Files changed
- Database/Storage security model
- Tests and manual checks that passed
- What was not tested and why
- Commit and branch
- Any push blocker
- What Phase D will build
