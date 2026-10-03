# TheLook — System Design

## 1. Core design insight
The catalog is a **fixed store**, and in "Complete the Look" the user only *picks* from it (never uploads
garments). So the entire expensive ML half can be **precomputed offline**:

- Embeddings + the full item×item **symmetrized** compatibility matrix are computed once, locally, and
  exported as JSON.
- At runtime the app does a **lookup + filter** — pure JS, instant, zero cost, no PyTorch on Vercel.
- The only *live* model calls are YouCam apparel VTO and an optional LLM for the reasoning sentence.

This keeps production light and spends credits only on the final render.
(v1 is clothes-only; skin-undertone + makeup are v3 — see REQUIREMENTS roadmap.)

## 2. Components
```
                         ┌──────────────────────────────────────────┐
  BUILD-TIME (local,     │  catalog_pipeline.py (Python, run once)    │
  Python, free)          │   product imgs → rembg (display cutouts)   │
                         │   → CLIP embed (raw img) → symmetrized     │
                         │     compat matrix → export JSON + images   │
                         └───────────────┬──────────────────────────┘
                                         │  catalog.json, compat_matrix.json, /cutouts
                                         ▼
  RUNTIME                ┌──────────────────────────────────────────┐
  Next.js PWA (Vercel)   │  FRONTEND (React)                          │
                         │   storefront · product · photo upload ·   │
                         │   "complete the look" · try-on viewer ·   │
                         │   cart          (recommender = JS lookup)  │
                         └───────────────┬──────────────────────────┘
                                         │ fetch /api/*
                         ┌───────────────▼──────────────────────────┐
                         │  BACKEND PROXY  (Next.js route handlers)   │
                         │   /api/tryon     → YouCam Cloth-v4         │
                         │   /api/stylist   → Gemini/Groq (reason)    │
                         │   (holds SECRET key; never reaches client) │
                         │   [v3: /api/analyze → Skin + Color Tones]  │
                         └───────────────┬──────────────────────────┘
          secret, server-side only ──────┤
                                         ▼
                 YouCam REST (apparel Cloth-v4)      [v3: Skin REST + Makeup AR SDK]
```

## 3. The hero data flow (one shopper journey)
1. **Upload photo.** User gives one full-body photo (camera or gallery), stored for the session.
2. **Pick anchor.** User taps an item on a product page (FR2).
3. **Complete the look.** JS reads `compat_matrix.json`: for each *other* outfit slot, take the
   highest-compat catalog item. Mutually-exclusive slots resolved (top+bottom **or** dress, never both) (FR3).
4. **Explain.** Top look + 2 alternates sent to `/api/stylist` (LLM, catalog-pinned) → one-sentence reason
   each. Optional; ranking already stands without it.
5. **Prove it.** User confirms → spend **1 credit**: `/api/tryon` renders the assembled outfit on the
   user's photo (Cloth-v4) (FR4–FR5).
6. **Buy the set.** Add all items to cart → mock checkout (FR6).

Credits are only spent at step 5, on the chosen look. Steps 1–4 are free/precomputed.
(v3 adds: step 1 also runs `/api/analyze` for undertone; step 3 biases colors to it; step 5 adds makeup AR.)

## 4. Data model
```jsonc
// catalog.json  (array)
{
  "id": "sku_084",
  "slot": "top",                 // top|bottom|dress|shoe|outerwear|accessory
  "title": "Oxford Shirt",
  "gender": "men",               // men|women|unisex
  "color": "#1f3a5f",            // dominant color (k-means) — for display
  "palette": "cool",             // warm|cool|neutral  (v3: undertone matching)
  "image": "/cutouts/sku_084.png",
  "price": 39.90
}
// compat_matrix.json : { "sku_084": { "sku_311": 0.62, "sku_205": 0.41, ... }, ... }  (symmetrized 0–1)
```

## 5. Module / route breakdown
- `scripts/catalog_pipeline.py` — build-time: ingest → rembg → embed → symmetrized matrix → export.
  (Reuses the verified `_experiments/recommend.py` logic.)
- `lib/recommend.ts` — runtime JS: `completeLook(anchorId)`, `rankComplements(anchorId, slot)`;
  reads the two JSON files; resolves exclusive slots. (v3: add an `undertone` arg + color bias.)
- `app/api/tryon` — proxy → Cloth-v4; caches (photo,garment)→url; mock mode in dev.
- `app/api/stylist` — proxy → Gemini/Groq; prompt pinned to the passed SKU list (no hallucinated items).
- `app/api/analyze` — **(v3)** proxy → Skin Analysis + Facial Color Tones.
- `components/` — StorefrontGrid, ProductCard, PhotoUpload, CompleteLook (hero screen),
  TryOnViewer (apparel render, piece toggles), Cart. (v3: UndertoneBadge, makeup AR canvas.)

## 5b. The user photo (one upload, reused)
The user provides **one full-body photo** (camera or gallery — identical to the app) and it is **reused for
the whole session** for every clothes render. No re-upload per item; picking N outfits re-renders the same
photo N ways (each new render = 1 credit; cached renders are free).
- **Preferred input:** a clear **full-body photo**, plain background, so the apparel render has a clean body
  to dress.
- Stored client-side for the session; sent to YouCam only (never to the LLM).
- (v3) also reads the face region for undertone + makeup → then prefer a photo with the face visible.

## 6. Screens
1. **Storefront** — catalog grid (clean rembg cutouts), filter by gender/slot.
2. **Product** — anchor item + "Complete my look" CTA.
3. **Your photo** — upload/capture one full-body photo.
4. **Complete the Look** *(the decision screen — the thing judges score)* — the assembled outfit,
   each piece with a one-line reason, 2 alternates, overall cohesion.
5. **Try-On viewer** — the outfit rendered on the user's photo; toggle/swap pieces and re-render.
6. **Cart** — the multi-item basket + mock checkout.
(v3 adds an undertone badge on screen 3 and a makeup layer on screens 4–5.)

## 7. Build order (walking-skeleton-first)
1. Skeleton: Next.js + `/api/tryon` proven on one hardcoded (photo, garment) → render on screen.
2. Build-time pipeline → `catalog.json` + `compat_matrix.json` on a **curated** catalog.
3. `lib/recommend.ts` lookup → Complete-the-Look screen renders real recommendations.
4. Try-On viewer renders the assembled outfit on the user's uploaded photo; piece swap + re-render.
5. Cart + storefront polish → demo video → submit.
(v3 later: `/api/analyze` undertone + makeup AR.)

## 8. Open items before build
- Lock the 1-line niche/positioning + assemble the curated catalog (coherent, with bottoms).
- Get the YouCam REST API key (apparel Cloth-v4). (Makeup AR SDK key is a v3 concern.)
- Fix `complete_look()` exclusive-slot logic; calibrate the compat threshold on the real catalog.
