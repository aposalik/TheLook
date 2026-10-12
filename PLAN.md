# TheLook — Plan

## Product concept
A web PWA mini-storefront (working name **TheLook**). Small catalog: a few makeup items + a few apparel items. A shopper can:
1. **Try makeup live** — real-time AR mirror (lipstick / foundation / eyeshadow shade swaps)
2. **Try clothes on their photo** — upload/capture → generative render wearing the garment
3. **Get recommendations** — skin undertone analysis → "these shades + these colors suit you" (the non-obvious idea that ties makeup + apparel into one story; satisfies the rubric's "decision/recommendation" expectation)
4. **Add to cart** — mock checkout

## Open decision (lock in Week 1)
Niche / audience. Candidates: K-beauty shop, menswear capsule brand, "get-ready-for-an-event" concierge, etc.
Write one sentence: "For ___, TheLook lets them ___."

## Methodology — Kanban
- Tool: **GitHub Projects** (board lives next to the repo; judges see an organized repo).
- Columns: `Backlog → To Do (this week) → In Progress (WIP max 2) → Review/Test → Done` + a `Blocked` tag.
- Two rules: **WIP limit 2** (finish before starting), **pull don't push** (take top of To Do, no jumping to fun UI early).
- **Walking-skeleton first**: thinnest end-to-end path before any polish. De-risks the API on day 2, not day 25.
- Weekly 10-min self-review (Sunday): what works, what's next, cut scope if behind.
- Meta-principle: **reduce uncertainty earliest** — do the scariest unknown (API integration) first.

## Backlog (Kanban cards)

### Epic 0 — Spike / Walking skeleton (DO FIRST)
- [ ] Register on Devpost, claim API key + 1,000 credits
- [ ] Lock the niche/audience (one sentence)
- [ ] Scaffold Next.js app + deploy empty shell to Vercel
- [ ] Thin backend proxy: one API route holding the secret key
- [ ] Walking skeleton: upload photo → apparel VTO via proxy → show returned image (ugly OK)
- [ ] Get makeup AR SDK loading + live camera feed on one page

### Epic 1 — Makeup live AR
- [ ] Live camera mirror with one lipstick shade applied
- [ ] Shade picker (swap colors live)
- [ ] 2–3 categories (lip, foundation, eye)

### Epic 2 — Apparel generative try-on
- [ ] Photo capture (camera) + upload fallback
- [ ] Garment select → generate → reveal (loading animation makes the ~seconds feel intentional)
- [ ] Credit-guard: cache results, rate-limit, never re-render the same combo

### Epic 3 — Recommendation layer (differentiator)
- [ ] Skin undertone analysis from selfie
- [ ] Map undertone → recommended makeup shades + apparel colors
- [ ] "Your matches" strip in the store

### Epic 4 — Storefront / UX
- [ ] Product catalog (hardcoded JSON fine)
- [ ] Product page with "Try it on" entry points
- [ ] Add-to-cart / mock checkout
- [ ] Mobile polish (PWA — test on phone)

### Epic 5 — Submission (start Week 4)
- [ ] README + setup instructions
- [ ] Screenshots
- [ ] 1–3 min demo video (script the end-to-end flow)
- [ ] Devpost write-up (tie every feature to retail value + name APIs used)
- [ ] Submit early, then keep polishing (Devpost allows edits)

## Schedule (~4.5 weeks to Nov 2)
| Week | Dates (approx) | Focus | "Done" looks like |
|------|----------------|-------|-------------------|
| 1 | Sep 30 – Oct 6 | Epic 0 | Both API paths proven end-to-end. Zero polish. |
| 2 | Oct 7 – Oct 13 | Epic 1 + 2 | Makeup live + apparel upload both work in the app |
| 3 | Oct 14 – Oct 20 | Epic 3 + 4 | Recommendation layer + real storefront UX |
| 4 | Oct 21 – Oct 27 | Polish + Epic 5 | Feels like a product; video + write-up drafted; SUBMIT |
| Buffer | Oct 28 – Nov 2 | Fix + re-record | Final polish, better demo take |

## Session log

### Wardrobe UX + Gemini fix
- Installed `@imgly/background-removal` (client-side WASM, free)
- AddItemModal: bg removal before preview, Gemini Vision auto-names garment, shows AI/fallback badge
- WardrobeCatalog: removed inline × buttons, added ⚙ Manage drawer for user items, pendulum spring physics on hanger hover
- Fixed `GEMINI_MODEL` default from `gemini-3.5-flash-lite` (404) → `gemini-2.5-flash`

### Show On Me fetch failed
- Root cause: Next.js 15/16 cancels outgoing fetches with "Request was cancelled"
- Fix: added `cache: "no-store"` to every fetch in `lib/youcam.ts` and `lib/gemini.ts`
- Also raised `bodySizeLimit` to `12mb` in `next.config.ts` for image payloads
- FittingRoom strips `item.image` from catalog items before sending to `/api/tryon-look`

### Demo clothes toggle
- Demo items (catalog) show by default with a subtle grey "Demo" badge on each card
- ⚙ Manage drawer (always visible now) has a toggle switch at the top: "Demo clothes" on/off
- When hidden, catalog items are filtered from the visual wardrobe but still used by the recommender (outfit generation still works)
- Toggle persisted to localStorage (`thelook_demo_hidden`), reversible at any time
- User-uploaded items always visible regardless of toggle

### Phase E — YouCam credit protection
- `supabase/migrations/20261023000000_quota.sql`: atomic `reserve_render_quota()`, `complete_render_job()`, `fail_render_job()` PostgreSQL functions
- `lib/quota.ts`: server-side helpers — `reserveQuota`, `completeJob`, `failJob`, `hashIp`, `trustedIp`
- `tryon-look/route.ts`: quota reservation before any YouCam work; refund via `failJob` on pipeline error; `completeJob` records actual units; cache hits return signed URL without consuming quota; 429/503/409 on limit/budget/in-flight
- `RATE_LIMIT_HASH_SECRET` generated and added to `.env.local`; documented in `.env.local.example`
- TypeScript: 0 errors. Production build: clean.
- **Action required**: apply migration in Supabase SQL Editor → paste contents of `supabase/migrations/20261023000000_quota.sql` and run

- `lib/db.ts`: typed query helpers for all 4 tables (avatars, wardrobe_items, user_preferences, saved_looks + items)
- `avatar/upload` + `wardrobe/upload`: now insert DB rows after Storage upload
- New DELETE routes: `/api/avatar/[id]`, `/api/wardrobe/[id]`, `/api/looks/[id]` — remove DB row + Storage file
- New signed-URL routes: `/api/avatar/[id]/url`, `/api/wardrobe/[id]/url`, `/api/renders/[path]/url`
- New `/api/looks` (GET + POST) and `/api/preferences` (POST)
- `FittingRoom.tsx`: `loadFromDb()` loads from DB on mount with localStorage fallback; all mutations write to DB
- `AddItemModal.tsx`: passes full item metadata to wardrobe upload so DB row is inserted
- TypeScript: 0 errors. Production build: clean.

- Created `lib/storage.ts`: service-role helper (`uploadToStorage`, `signedUrl`, `deleteFromStorage`)
- New route `/api/avatar/upload`: avatar JPEG → `avatars/{userId}/{avatarId}.jpg` → signed URL
- New route `/api/wardrobe/upload`: PNG cutout → `wardrobe/{userId}/{itemId}.png` → signed URL
- `tryon-look/route.ts`: renders now saved to `renders/{userId}/{key}.jpg` in private Storage; cache check via `signedUrl`; removed all `public/results` local writes
- `FittingRoom.tsx`: avatar upload fires background Storage upload after local save
- `AddItemModal.tsx`: wardrobe cutout fires background Storage upload after item save
- Added `SUPABASE_SERVICE_ROLE_KEY` to `.env.local.example`
- TypeScript: 0 errors
- **Action required**: add `SUPABASE_SERVICE_ROLE_KEY` to `web/.env.local` (Supabase → Project Settings → API → service_role key)

- Root cause: Supabase project has no SMTP configured → rejects all email signups with "Email address is invalid"
- Google OAuth also not enabled in Supabase dashboard (`google: false` in /auth/v1/settings)
- Code fixes applied:
  - AuthDialog: maps raw GoTrue errors to friendly messages
  - AuthProvider: detects duplicate-email fake-success (identities[] empty)
  - Google button now hidden unless `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` in env
- **Action required in Supabase dashboard** (`https://supabase.com/dashboard/project/otmdhnjvzqtwzhlyioqs`):
  1. Authentication → Providers → Email → turn OFF "Confirm email" (auto-confirm) for dev testing
  2. OR Project Settings → Authentication → SMTP → configure a real SMTP provider (Resend free tier recommended)
  3. Authentication → Providers → Google → add OAuth credentials when ready, then set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` in `.env.local`
