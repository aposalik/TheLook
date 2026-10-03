# TheLook — Design & Frontend Track (owner: @MFahadFaisal)

Fahad owns **design + the UI**. Backend (recommender + try-on API) is already built and stays owned by @aposalik — Fahad's UI calls those APIs. Work **web first**, mobile after. Design first, then build.

## The product in one line
Pick clothes from a store → hit **Generate** → the app builds the best complete outfit and shows it **on a model/your photo**, add the pieces to the bag.

## North-star layout (inspired by the "RUSH / AI Fitting Room" reference)
A single **Fitting Room** screen, 3 zones:

```
┌───────────────────────────────────────────────────────────────┐
│  [logo] TheLook                                   Bag(2)   ◑   │   top bar
├───────────────────────────────┬───────────────────────────────┤
│                               │  YOU ARE WEARING               │
│        AVATAR / PREVIEW        │   - Oversize jacket  [x]       │
│     (switch avatar ◀ ▶,        │     color ● ●   size S M L     │   right panel
│      zoom, rotate)             │   - Wide trousers    [x]       │
│                               │   - Boots            [x]       │
│                               │  ───────────────────────────   │
│   ┌─ GENERATE BEST OUTFIT ─┐  │   [ Add all to bag ]           │
│   └────────────────────────┘  │                                │
├───────────────────────────────┴───────────────────────────────┤
│  CATALOG (categorized: Tops · Bottoms · Outerwear · Shoes …)   │   bottom/side
│  [img][img][img][img][img]  → click to select / add            │
└───────────────────────────────────────────────────────────────┘
```

- **Center — Avatar/Preview:** a model wearing the current outfit. Support **switchable avatars** (a few preset model photos) **and** "upload your own photo." Rotate/zoom nice-to-have.
- **Right — "You are wearing":** the selected pieces (remove each), then the big **Generate best outfit** action and **Add to bag**.
- **Bottom/side — Catalog:** all items, **categorized** (Tops / Bottoms / Outerwear / Shoes / Accessories), click to select+add.
- **Top bar:** logo, Bag(count), account.

### Adapt the reference to OUR product (important)
- **Drop the body-measurements panel** ("Chest/Waist/Hips/Height"). We do **not** do size/fit prediction — it's styling only. Replace that space with **photo upload / avatar switch**.
- Keep the vibe **premium + neutral** (matches our earthy capsule): lots of whitespace, soft shadows, rounded cards, one accent color.

### Clarified interaction flow (from Salik, 2026-10-03) — build to THIS
1. **Multi-select, not single-pick.** Clicking a catalog item **adds it to the "You are wearing" tray** (as a small thumbnail, basket-style). The user can add **several** items (e.g. a shirt + shoes) before doing anything. Each tray item has a remove [x]. (The current placeholder page recommends on a single click — that's the throwaway UI, not this.)
2. **Suggest button.** After selecting, the user hits **Suggest outfits** → the app returns **3 complete outfit suggestions** that **include the selected items** and fill in the rest (bottom/layer/shoe/accessory).
3. **Pick one → SEE ON ME.** The user selects one of the 3 suggestions and hits **See on me** → renders that outfit on the current avatar (`/api/tryon-look`).
- **API shapes:** Suggest → recommender with **multiple selected items** (multi-anchor — backend updated by @aposalik; see below). See on me → `/api/tryon-look` with the chosen look's item ids.

### Avatar persistence (explicit requirement)
- Uploaded photos must be **saved and switchable** — the user uploads once, and can **switch between stored avatars** on the main screen without re-uploading. Persist client-side (localStorage/IndexedDB; store a few photos + which is active). Plus the preset model avatars.

## Phases (do in order; each = a GitHub issue assigned to Fahad)

### UI-D1 · Design the Fitting Room (mockups) 🎨
Figma **or** Google Stitch. Desktop web first. Screens: Fitting Room (the 3-zone layout above), empty/loading states, the bag. Deliver a shareable link + exported PNGs. **Done:** desktop mockups approved by @aposalik.

### UI-D2 · Logo + brand style guide 🎨
A **TheLook** logo (wordmark + simple mark — hanger / outfit / sparkle), as **SVG + PNG (transparent)**. Plus a 1-page style guide: colors (hex), fonts, spacing, button styles. (A draft logo is in `web/public/brand/` to react to — replace or refine.) **Done:** logo assets + style guide committed.

### UI-B1 · Build the web UI shell (static, mock data) 🌐
Implement the Fitting Room in **Next.js + Tailwind** using the existing `data/catalog.json` (no live API yet). Components: `FittingRoom`, `AvatarStage`, `CatalogPanel` (categorized, selectable), `WearingPanel`, `GenerateButton`, `BagButton`. **Done:** matches the mockups, runs via `npm run dev`, uses real catalog images.

### UI-B2 · Wire UI → backend 🔌
Hook **Generate** to `/api/recommend` and **Show on me** to `/api/tryon` (coordinate exact shapes with @aposalik). Loading/empty/error states. **Done:** generate + render work through the real UI.

### UI-B3 · Responsive / mobile 📱
Make it work beautifully on phone widths (stacked layout). **Done:** usable + clean on mobile.

## Working rules (same as CONTRIBUTING.md)
Branch → PR → review by @aposalik → merge. Use your **own** YouCam key in your **own** `web/.env.local` (never commit it), and dev with `MOCK=1` so you don't spend credits on UI work.
