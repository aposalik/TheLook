# TheLook — Development Phases (v1, clothes-only)

Go phase by phase. Don't start a phase until the previous one's **Done bar** is met.
Deadline: **2026-11-02**. Today: 2026-10-02 (~4 weeks). Credit budget: 1,000 (spend only where noted).

Legend: 🧱 build-time/local (free) · 🌐 app · 💳 spends YouCam credits · 🔑 needs API key

---

## Phase 0 — Spike: prove the risky unknown  🔑💳 ✅ DONE
- YouCam Cloth-v4 key confirmed working.
- Multi-garment strategy resolved: sequential renders (upper collage → upper_body render → chain lower_body). Implemented in `/api/tryon-look`.
- Latency ~5–15s per render. Credits: ~15 spent in spike.

## Phase 1 — Catalog pipeline  🧱 ✅ DONE
- Curated capsule catalog assembled (men + women, tops/bottoms/shoes/accessories).
- `catalog_pipeline.py`: rembg cutouts → OpenCLIP embeds → Polyvore MLP compat scores → `catalog.json` + `compat_matrix.json` + `/public/cutouts`.
- Slot logic fixed (top+bottom OR dress, never both).
- Compat threshold calibrated on real catalog.

## Phase 2 — App skeleton (walking skeleton)  🌐💳🔑 ✅ DONE
- Next.js 16 App Router application scaffolded; production deployment and durable storage remain Phase 5 work.
- `/api/tryon` + `/api/tryon-look` proxy with dev mock mode + SHA1 result cache.
- Full UI shell: FittingRoom, AvatarStage, WearingPanel, WardrobeCatalog, BagDrawer, Lookbook, LookDetail.

## Phase 3 — Recommender + Complete-the-Look screen  🌐 ✅ DONE
- `lib/recommend.ts`: weighted pairwise CLIP compat + 3 outfit formulas (Simple/Layered/With layer/Dress) + diversity rules + `StylePreferences` (occasion, goal).
- `metadataCompat()` for uploaded items (color distance, palette, formality, seasons, styles).
- `/api/recommend` POST: accepts `wardrobeItems` + `preferences`, returns 5 candidates.
- `/api/stylist/rerank`: Gemini Vision reranks candidates with item images, returns reasons + stylist titles. Falls back to deterministic silently.
- `/api/wardrobe/analyze`: Gemini Vision tags uploaded garments (title, category, layer, color, fit, formality, styles, seasons). Falls back to placeholder.
- `/api/wardrobe/fetch`: secure server-side image fetcher (SSRF-safe).
- AddItemModal: client-side bg removal (@imgly/background-removal WASM) + Gemini analyze + AI/fallback badge.
- WardrobeCatalog: Manage drawer replaces inline remove buttons. Pendulum spring physics on hanger hover.
- **Bug fixed:** GEMINI_MODEL default was `gemini-3.5-flash-lite` (404) → changed to `gemini-2.5-flash`.

## Phase 4 — Try-on viewer + cart  🌐💳 ✅ DONE
- `/api/tryon-look`: upper collage → upper_body render → chain lower_body. Dress = single full_body. Result cached by SHA1(photo+items).
- AvatarStage: multi-avatar switcher, photo upload, try-on trigger, save to lookbook.
- BagDrawer: multi-item cart + mock checkout.
- Lookbook: saved looks persisted to localStorage, detail view.
- **Reliability fixes:** Show On Me strips catalog image blobs from the request, opts external YouCam/Gemini calls out of Next.js fetch caching, reports the failing API stage, and safely retries pre-connection timeouts without duplicating billable tasks.

## Phase 5 — Polish + submit  🌐 ← CURRENT
- [ ] UX polish, responsive, loading/empty/error states, mobile check.
- [ ] Private durable storage + render cache and public-API credit protection.
- [x] CI workflow for lint, typecheck, and production build.
- [x] README + setup instructions.
- [ ] Screenshots.
- [ ] 1–3 min demo video (script the end-to-end flow).
- [ ] Devpost write-up (tie features to retail value + name APIs used).
- [ ] Final deploy + submit before Nov 2.
- **Credits remaining:** ~965 (most dev done in mock mode).

---

### Actual timeline
- **Wk1 (Oct 2–8):** Phase 0 + Phase 1 ✅
- **Wk2 (Oct 9–15):** Phase 2 + Phase 3 core ✅
- **Wk3 (Oct 16–22):** Phase 3 Gemini layer + Phase 4 ✅
- **Wk4 (Oct 23–Nov 2):** Phase 5 — polish + submit ← NOW

### Key risks
- **Multi-garment rendering** (resolved in Phase 0) — may force "one hero garment + recommended cards" instead
  of a fully layered outfit. Design degrades gracefully either way.
- **Credit burn** — always dev against mock + cache; only real-render on demand.
- **Catalog quality** — a weak/incoherent catalog makes the recommender look bad; invest in Phase 1 curation.
