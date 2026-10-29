# TheLook — Development and Submission Phases

**Audit date:** 2026-10-29
**HackTown deadline:** 2026-11-02
**Credit policy:** use `MOCK=1` for local development; spend YouCam credits only during one controlled acceptance run.

Legend: 🧱 local/free · 🌐 app/hosted · 💳 may spend YouCam credits · 🔑 credential required

## Completed engineering phases

### Phase 0 — Risk spike 🔑💳 ✅

- Confirmed YouCam Cloth-v4 integration.
- Resolved multi-garment strategy: upper collage → upper-body render → lower-body chaining.
- Measured render latency and protected later development with mock/cache paths.

### Phase 1 — Catalog and compatibility pipeline 🧱 ✅

- Built the curated catalog, cutouts, embeddings, compatibility matrix, and slot logic.
- Added catalog footwear/accessories and calibrated compatibility thresholds.

### Phase 2 — Application skeleton 🌐 ✅

- Built the Next.js 16 App Router application and fitting-room UI.
- Added avatar stage, wardrobe, wearing panel, bag, lookbook, authentication surfaces, and API route structure.

### Phase 3 — Hybrid outfit intelligence 🌐🔑 ✅

- Deterministic formulas: Simple, Layered, With layer, Three layer, and Dress.
- Hard constraints for ownership, duplicate garments, gender consistency, formality, collars, patterns, loungewear, bulk, neckline, and layer geometry.
- Rich semantic garment analysis and legacy inference.
- Explainable scores, archetypes, diversity selection, weather-aware scoring, feedback adjustment, item locks, and role-level swaps.
- Gemini Vision structured judging with strict validation and deterministic fallback.
- Rolling Rack curation and Style Assistant weather/chat flow.

### Phase 4 — Try-on, persistence, and protection 🌐💳🔑 ✅ locally

- Three-layer collage/synthesis and YouCam Cloth-v4 route.
- Cache fingerprinting/versioning, signed render URLs, diagnostics, and omission checks.
- Supabase Auth, private Storage/Postgres routes, RLS-oriented ownership checks, saved looks, feedback persistence, and quota protection.
- Guest/permanent-account separation documented and implemented in the application.

## Current phase — Phase 5: freeze, verify, submit 🌐💳🔑

### Done locally

- [x] User-facing wardrobe categories and UX polish.
- [x] Responsive loading, error, fallback, and empty states in the main fitting-room flow.
- [x] CI workflow for lint, typecheck, and build.
- [x] README, architecture, setup, privacy, and current-status documentation.
- [x] Deterministic test suite and golden evaluation suite.

### Remaining before submission

- [ ] Confirm Supabase migration state and hosted environment variables.
- [ ] Browser smoke test guest session, permanent account, private Storage, and no-merge behavior.
- [ ] Run one controlled real YouCam Show On Me test on the final deployment.
- [ ] Verify Gemini from the deployed environment; HTTP 503 is a temporary provider-capacity condition and must remain a graceful fallback, not a submission blocker.
- [ ] Confirm production/demo URL and reset any stale local cached suggestions before recording.
- [ ] Capture screenshots.
- [ ] Record the 1–3 minute demo video.
- [ ] Write and submit Devpost entry before 2026-11-02.

## Verified on 2026-10-29

From `web/` with `MOCK=1`:

```text
30 recommendation/grammar/try-on/feedback tests passed
11/11 recommendation fixtures passed
TypeScript passed
ESLint passed with 0 errors and 30 existing warnings
Production build passed
```

## Operational blockers

- The local protected egress proxy has previously produced expired-certificate/TLS and transport failures for Gemini and Supabase CLI calls.
- Gemini can independently return HTTP 503 during model demand spikes; the UI reports deterministic fallback rather than pretending Gemini judged the outfit.
- Real YouCam acceptance consumes credits and must be performed once, deliberately, after deployment configuration is confirmed.

See [`PROJECT-STATUS.md`](PROJECT-STATUS.md) for the single current submission checklist and demo narrative.
