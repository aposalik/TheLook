# TheLook — Development Phases (v1, clothes-only)

Go phase by phase. Don't start a phase until the previous one's **Done bar** is met.
Deadline: **2026-11-02**. Today: 2026-10-02 (~4 weeks). Credit budget: 1,000 (spend only where noted).

Legend: 🧱 build-time/local (free) · 🌐 app · 💳 spends YouCam credits · 🔑 needs API key

---

## Phase 0 — Spike: prove the risky unknown  🔑💳
The single biggest unknown is whether YouCam Cloth-v4 actually renders our catalog on a real body the way
we expect — and whether we can show a **multi-piece outfit** or only one garment at a time. Attack it first.
- **Tasks**
  - Confirm the YouCam REST key works (auth a trivial call).
  - One throwaway script: 1 full-body photo + 1 garment → Cloth-v4 → save the rendered image.
  - **Resolve the multi-garment question:** can we layer top→bottom→shoes (sequential renders), or do we
    render one "hero" garment and show the rest as recommended cards? Test 2–3 sequential renders, judge quality.
  - Note real latency + credits-per-render.
- **Done bar:** a real rendered try-on image on disk, and a decision on single-vs-multi-garment rendering.
- **Credits:** ~10–20.

## Phase 1 — Catalog pipeline  🧱 (free, no key)
Turn the verified `_experiments/recommend.py` into a real offline pipeline on a **curated** catalog.
- **Tasks**
  - Lock the 1-line niche + assemble the curated catalog: men + women, every slot incl. **bottoms**
    (~6–10 items/slot), coherent style. Real product images.
  - `scripts/catalog_pipeline.py`: rembg cutouts → CLIP embed (raw img) → symmetrized compat matrix →
    export `catalog.json` + `compat_matrix.json` + `/public/cutouts`.
  - Fix `complete_look()` exclusive-slot logic (top+bottom **or** dress, never both).
  - Calibrate the compat threshold on this real catalog (what score = "good match").
- **Done bar:** valid `catalog.json` + `compat_matrix.json`; spot-check 5 anchors → outfits look sensible.
- **Credits:** 0.

## Phase 2 — App skeleton (walking skeleton)  🌐💳🔑
Thinnest end-to-end slice: pipes connected, no styling.
- **Tasks**
  - Next.js PWA scaffold, deploy to Vercel. `.env` with secret key server-side.
  - `/api/tryon` proxy → Cloth-v4, with **dev mock mode** + **result cache** (so dev burns ~0 credits).
  - Hardcoded (photo, garment) → button → render shows on screen.
- **Done bar:** in the browser, click → a real VTO render appears (via the proxy, key never in client).
- **Credits:** ~5 (then cached).

## Phase 3 — Recommender + Complete-the-Look screen  🌐 (mostly free)
The heart of the product — the screen judges score.
- **Tasks**
  - `lib/recommend.ts`: load the two JSON files; `completeLook(anchorId)`, `rankComplements()`.
  - Storefront grid + Product page (pick anchor) + Photo upload.
  - **Complete-the-Look screen:** assembled outfit, one-line reason per piece, 2 alternates, cohesion score.
  - `/api/stylist` (Gemini/Groq) for the reason sentences — optional, pinned to real SKUs.
- **Done bar:** pick an item + upload a photo → see a coherent recommended outfit with reasons. (No render yet.)
- **Credits:** 0 (LLM free tier).

## Phase 4 — Try-on viewer + cart  🌐💳
Prove the look on the user + close the commerce loop.
- **Tasks**
  - Render the chosen outfit on the user's photo (single- or multi-garment per Phase 0 decision); cache results.
  - Piece swap → re-render (cache hits are free).
  - Cart + mock checkout (multi-item basket).
- **Done bar:** full journey works: storefront → anchor → photo → complete look → render on me → cart.
- **Credits:** ~50–100 across testing (cached).

## Phase 5 — Polish + submit  🌐
- **Tasks**
  - UX polish, responsive, loading/empty/error states, positive copy, mobile check.
  - README + setup instructions; screenshots; **1–3 min demo video**; Devpost text description.
  - Final deploy; submit before the deadline (buffer Oct 28–Nov 2).
- **Done bar:** submitted on Devpost with all required artifacts.
- **Credits:** ~20 for clean demo renders.

---

### Rough timeline
- **Wk1 (Oct 2–8):** Phase 0 + Phase 1.
- **Wk2 (Oct 9–15):** Phase 2 + start Phase 3.
- **Wk3 (Oct 16–22):** finish Phase 3 + Phase 4.
- **Wk4 (Oct 23–Nov 2):** Phase 5 + buffer.

### Key risks
- **Multi-garment rendering** (resolved in Phase 0) — may force "one hero garment + recommended cards" instead
  of a fully layered outfit. Design degrades gracefully either way.
- **Credit burn** — always dev against mock + cache; only real-render on demand.
- **Catalog quality** — a weak/incoherent catalog makes the recommender look bad; invest in Phase 1 curation.
