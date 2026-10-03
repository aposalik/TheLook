# FitRoom — Requirements

Product direction: **"Complete the Look"** — shopper picks one item from a curated store, the app
recommends the other **clothing** items that complete the outfit and proves the look on *their own photo*,
then lets them buy the set.
Roadmap: **v1 = clothes try-on + outfit recommender** (Western fitted, men + women).
**v2 = modest/hijab** (gated on a VTO test). **v3 = undertone analysis + makeup try-on.**

---

## 1. Hackathon requirements (hard constraints)
- **Deadline:** 2026-11-02, ~11:45 EST (edition 2, "eCommerce VTO", Devpost ID 31400).
- **Must submit:** working web/mobile prototype using **≥1 YouCam API**; public repo + setup instructions;
  text description; screenshots; **1–3 min demo video**.
- **Judging (4 equal weights):** Technical Implementation · Design · Potential Impact · Quality of Idea
  (creative / non-obvious). → the *recommendation decision*, not the raw render, is what scores.
- **Budget:** 1,000 free API credits, total. No more.
- Solo build. Turkey eligible.

## 2. Functional requirements (what the app does)
- **FR1 — Storefront:** curated catalog of real product items, tagged by slot (top / bottom / dress /
  shoe / outerwear / accessory) and attributes (color, style). Men + women.
- **FR2 — Anchor pick:** user chooses one starting item ("I want to wear this").
- **FR3 — Complete the look:** recommend complementary catalog items (fill the other outfit slots) that go
  with the anchor, each with a short human reason. Must be grounded in real catalog SKUs (no invented items).
- **FR4 — Virtual try-on:** the assembled outfit rendered on the user's uploaded photo (generative, Cloth-v4).
- **FR5 — Full-look view:** show the complete outfit on the user; let them swap any piece and re-render.
- **FR6 — Cart:** multi-item basket + mock checkout (bigger basket = the commerce story).
- **FR7 — Credit efficiency:** render only the *chosen* look; never render to decide.

### Deferred functional requirements
- **(v3) Skin analysis + undertone** → YouCam Skin Analysis + Facial Color Tones; bias outfit colors to undertone.
- **(v3) Makeup try-on** → YouCam Makeup AR, shade suggestion matched to the look.
- **(v2) Modest-fashion** rendering (hijab/abaya) once the VTO quality test passes.

## 3. Non-functional / technical requirements
- **NFR1 — Stack:** Next.js PWA on Vercel, web-first. Mobile only if time permits.
- **NFR2 — Key security:** secret REST key **server-side only** behind a thin `/api/*` proxy.
  AR SDK license key is domain-locked → OK client-side. Never call REST from the browser.
- **NFR3 — Credit discipline:** everything that can be free is free (see §4); mock the apparel API in dev;
  cache every (photo, garment) → result; lean on on-device makeup AR (free per use).
- **NFR4 — Recommender is precomputed:** because the catalog is a fixed store, compute the full
  item×item compatibility matrix **offline** and ship it as JSON. **No PyTorch/CLIP at runtime** — runtime
  recommendation is a pure JS lookup + filter. Instant and free.
- **NFR5 — Performance:** recommendations instant (lookup); VTO render ~seconds (expected, shown with a
  spinner). Makeup AR ~30fps on-device.
- **NFR6 — Privacy:** the selfie goes to YouCam only. The LLM (reasoning text) sees garment tags/images
  only, never the user's face.
- **NFR7 — Resilience & tone:** graceful fallbacks (VTO fail → cached/mock result); all styling copy is
  positive/confidence-framed; body attributes are self-reported or analyzed, never shamed.

## 4. External dependencies
| Need | Tool | Cost | Where |
|---|---|---|---|
| Apparel try-on | YouCam Clothes / Cloth-v4 (generative) | 1 credit / render | server |
| ~~Makeup try-on~~ (v3) | YouCam Makeup VTO (AR SDK) | free per use | client |
| ~~Skin undertone~~ (v3) | YouCam Skin Analysis + Facial Color Tones | credit (metered) | server |
| Catalog cleanup | `rembg` (U²-Net) | free, local | build-time |
| Item tagging | FashionCLIP (`patrickjohncyh/fashion-clip`) OR LLM-vision | free | build-time |
| Compatibility | OpenCLIP ViT-B-32 + Polyvore-trained MLP (`EESHAK02/style-recommender`) | free, local | build-time |
| Reasoning text | Gemini / Groq free tier | free (rate-limited) | server, optional |

## 5. Explicit non-goals (v1)
- No real-time video clothes try-on (YouCam apparel is single-image generative; infeasible).
- No personal wardrobe upload (catalog = the store, not the user's closet).
- No size/fit prediction (styling only; state this honestly).
- No undertone analysis or makeup try-on in v1 (→ v3).
- No modest-fashion rendering until the hijab/abaya VTO quality test passes (→ v2).
