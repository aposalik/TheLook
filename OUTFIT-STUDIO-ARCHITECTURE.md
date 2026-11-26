# TheLook Outfit Studio — Product & Engineering Architecture

**Status:** Proposed architecture
**Date:** 2026-11-26
**Working product name:** **Outfit Studio**

## 1. Executive decision

Add a new primary route, `/studio`, exposed in the header as **Outfit Studio**.

Outfit Studio is a constrained fashion-collage editor: users drag garments from their wardrobe into a central artboard, resize and arrange them, change visual stacking, assign wearing roles, analyze the result, and save it into Looks.

The critical architectural decision is to model three different things separately:

1. **Canvas document** — where an image is placed, how large it is, and which image visually sits on top.
2. **Outfit semantics** — which garment is the base, mid, outer, bottom, shoe, or accessory and whether the combination is physically valid.
3. **Learning evidence** — what the user created, saved, wore, rejected, or later deleted, with a confidence weight.

Canvas overlap is not physical layering. A shoe placed above a shirt in a collage does not mean the shoe is worn over the shirt. Never infer garment role directly from canvas `zIndex`.

## 2. What existing products show

### Whering

Whering emphasizes styling from existing clothes, wardrobe shuffle, filters for season/color/lookbooks, and saved Lookbooks. Its product lesson is that rapid experimentation and reusable collections matter.

### Combyne

Combyne combines outfit creation, a personal wardrobe, branded pieces, shopping, discovery, challenges, and community. Its lesson is that a canvas becomes more engaging when creation has a destination: save, share, shop, or participate.

### GetWardrobe

GetWardrobe combines wardrobe ingestion, automatic background removal and categorization, AI generation, an interactive AI Studio, calendar/weather planning, statistics, cross-device sync, family wardrobes, and stylist workflows. Its lesson is that manual and automatic creation should coexist rather than compete.

### TheLook opportunity

Most products present a visual collage or recommendation. TheLook can differentiate with:

- Physical garment grammar before AI judgment.
- Explicit base/mid/outer wearing roles.
- Explainable deterministic analysis.
- Gemini as a bounded visual critic, not an untrusted generator.
- Manual creations as weighted preference evidence.
- Direct transition from collage to YouCam virtual try-on.

## 3. Recommended editor technology

### Recommendation: React Konva

Use a version of `react-konva` compatible with the project's React 19.2 runtime and Konva 10+.

Why it fits:

- React-oriented scene graph.
- Built-in pointer events, dragging, groups, layers, hit detection, and animation.
- `Transformer` supports resize/rotate handles.
- Works as a Next.js Client Component.
- Suitable for a constrained image editor without adopting a full whiteboard product.
- Canvas export can produce a preview image.

### Alternatives considered

| Option | Strength | Problem for TheLook | Decision |
|---|---|---|---|
| React Konva | React scene graph, performant images/transforms, precise control | We must implement history, snapping, and persistence | **Use** |
| Fabric.js | Mature transforms, grouping, filters, JSON/SVG/PNG I/O | Imperative integration and state synchronization are less natural in this React app | Reserve as fallback |
| tldraw | Excellent history, persistence, schema migrations, export, multiplayer foundations | Large general-purpose whiteboard surface; difficult to make the product feel like a focused fashion tool | Learn from its architecture, do not adopt initially |
| Polotno | Ready-made commercial design editor | Cost, vendor coupling, generic editor UX | Do not use for v1 |

## 4. Product information architecture

### Header

```text
TheLook | Fitting Room | Outfit Studio | Looks | Bag | Account
```

On mobile, Fitting Room and Outfit Studio move into a compact product switcher.

### Desktop layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Global header: TheLook · Fitting Room · Outfit Studio · Looks     │
├────────────────────────────────────────────────────────────────────┤
│ Studio toolbar: Undo Redo | Zoom | Background | Analyze | Save    │
├──────────────┬───────────────────────────────────┬─────────────────┤
│ Layers       │                                   │ Inspector       │
│              │          Outfit artboard          │                 │
│  4 Necklace │       free positioning + guides   │ Position        │
│  3 Jacket   │                                   │ Size            │
│  2 Shirt    │                                   │ Wearing role    │
│  1 Trouser  │                                   │ Layer order     │
│              │                                   │ Delete/lock     │
├──────────────┴───────────────────────────────────┴─────────────────┤
│ Wardrobe dock: Search | category filters | horizontal item rail    │
└────────────────────────────────────────────────────────────────────┘
```

The reference image's bottom-picker concept is correct. The wardrobe must remain visible while composing.

### Mobile layout

- Full-width artboard.
- Compact top toolbar.
- Bottom wardrobe sheet with two heights: collapsed rail and expanded browser.
- Inspector opens as a contextual bottom sheet.
- Layers opens as a separate sheet.
- Two-finger pinch zoom affects the camera, not the selected garment.

## 5. Core interactions

### Add garments

- Tap a wardrobe item to auto-place it.
- Drag a wardrobe item onto the artboard for precise placement.
- New nodes use category-aware defaults:
  - upper garments: upper center;
  - bottoms: lower center;
  - shoes: lower corners/center;
  - bags/accessories: open side region.
- Prevent accidental duplicates by default; allow duplication only for accessories when explicitly selected.

### Select and transform

A selected garment shows:

- Four corner resize handles.
- Rotation handle, optional by product setting.
- Delete control.
- Lock control.
- Bring forward / send backward controls.
- Flip horizontally.
- Reset transform.

Rules:

- Preserve image aspect ratio by default.
- No skew in v1.
- Minimum visible size: 24 canvas units.
- Keep at least 20% of a garment inside the artboard.
- Commit one history command at `dragEnd` or `transformEnd`, not on every pointer movement.

### Snapping

Snap when an edge or center is within 5 screen pixels of:

- artboard edges;
- artboard horizontal/vertical center;
- another object's edges;
- another object's center.

Show temporary alignment guides. Convert the screen threshold into world units using the current zoom.

### Visual order versus wearing role

Expose both concepts explicitly:

```text
Canvas order: Bring forward / Send backward
Wearing role: Base / Mid / Outer / Bottom / Shoe / Accessory
```

Canvas order affects only the collage preview. Wearing role feeds the fashion grammar and try-on plan.

### Undo and redo

Use immutable commands:

```ts
type StudioCommand =
  | { type: "node.add"; node: CanvasNode }
  | { type: "node.remove"; node: CanvasNode }
  | { type: "node.transform"; id: string; before: Transform; after: Transform }
  | { type: "node.reorder"; id: string; before: number; after: number }
  | { type: "node.role"; id: string; before: OutfitRole; after: OutfitRole }
  | { type: "document.background"; before: Background; after: Background };
```

Store `past`, `present`, and `future`. Coalesce continuous transforms into one command. Cap history at 100 commands.

### Autosave

- Write draft snapshots to IndexedDB after 750 ms of inactivity.
- Sync a draft to Supabase after 2–3 seconds of inactivity for permanent accounts.
- Explicit **Save to Looks** creates a stable saved look.
- Never put image bytes or large canvas exports in localStorage.

## 6. Canvas document model

Use normalized artboard coordinates so documents survive responsive resizing.

```ts
type OutfitStudioDocument = {
  schemaVersion: 1;
  id: string;
  ownerId: string;
  title: string;
  aspectRatio: "4:5" | "3:4" | "1:1" | "9:16";
  background: {
    type: "solid" | "gradient" | "transparent";
    value: string;
  };
  nodes: CanvasNode[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type CanvasNode = {
  id: string;
  wardrobeItemId: string;
  x: number;        // normalized 0..1 relative to artboard
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  flipX: boolean;
  locked: boolean;
  wearingRole: "base" | "mid" | "outer" | "bottom" | "shoe" | "accessory";
};
```

Do not persist signed URLs. Persist wardrobe item IDs and resolve fresh private URLs when loading.

## 7. Database architecture

Do not overload the current `saved_looks` row with every editor concern. Extend it carefully and introduce first-class canvas records.

### Proposed tables

```text
outfit_documents
  id                  uuid PK
  user_id             uuid FK auth.users
  title               text
  schema_version      integer
  aspect_ratio        text
  background          jsonb
  revision            integer
  status              draft | saved | archived
  created_at          timestamptz
  updated_at          timestamptz

outfit_document_nodes
  id                  uuid PK
  document_id         uuid FK outfit_documents
  user_id             uuid
  wardrobe_item_id    uuid FK wardrobe_items
  wearing_role        text
  transform           jsonb
  z_index             integer
  item_snapshot       jsonb
  created_at          timestamptz
  updated_at          timestamptz

look_analyses
  id                  uuid PK
  look_id             uuid FK saved_looks
  user_id             uuid
  engine_version      text
  prompt_version      text nullable
  deterministic       jsonb
  ai_critique         jsonb nullable
  status              queued | deterministic_complete | ai_complete | failed
  created_at          timestamptz
  completed_at        timestamptz nullable

style_learning_events
  id                  uuid PK
  user_id             uuid
  look_id              uuid nullable
  document_id          uuid nullable
  event_type           text
  item_ids              uuid[]
  roles                 jsonb
  context               jsonb
  weight                 numeric
  created_at             timestamptz
```

### Extend `saved_looks`

```text
origin               generated | manual | assistant
preview_path         private Storage path for collage preview
outfit_document_id   nullable FK
analysis_status      pending | complete | failed
analysis_version     nullable text
```

Keep `render_path` for YouCam output. A manual collage preview is not a YouCam render and must not pretend to be one.

### Storage

Add a private bucket or explicit namespace:

```text
look-previews/{user_id}/{look_id}.webp
```

Use WebP at approximately 1600×2000 for the canonical 4:5 preview. Continue using `renders/` only for YouCam outputs.

### Security

- RLS: `auth.uid() = user_id` on every document, node, analysis, and event row.
- Server derives `user_id`; never trust a request-body user ID.
- Server validates ownership of every wardrobe item before saving.
- Maximum 12 nodes per look in v1.
- Validate transform ranges and JSON shape.
- Use optimistic concurrency with `revision`:

```sql
update outfit_documents
set ..., revision = revision + 1
where id = :id and user_id = auth.uid() and revision = :expected_revision;
```

A zero-row update means another tab saved first; return HTTP 409.

## 8. Save and analysis pipeline

```text
User clicks Save to Looks
  ↓
Client freezes one editor snapshot
  ↓
Client exports clean preview (no selection handles/guides)
  ↓
POST /api/studio/looks
  ↓
Server verifies session + ownership + revision + node count
  ↓
Server normalizes item semantics and roles
  ↓
Deterministic outfit analysis runs synchronously
  ↓
Transaction saves document, nodes, look, look items, analysis, learning event
  ↓
Preview uploads to private look-previews storage
  ↓
Response returns saved look immediately
  ↓
Optional AI analysis job is queued
  ↓
Gemini critiques canonical preview + structured item data
  ↓
Strict schema validation stores versioned critique
```

### Why deterministic analysis comes first

- It is fast and free.
- It can reuse TheLook's physical grammar.
- It remains available during Gemini outages.
- It provides a trustworthy baseline for learning.
- It prevents a visual model from redefining item ownership or physical constraints.

### Why Gemini should be asynchronous

Do not call Gemini on every drag, resize, or autosave.

Analyze when:

- the user explicitly clicks **Analyze**;
- the user saves a new stable revision;
- the user requests **Improve this look**.

The UI should save immediately, show deterministic feedback, then update when Gemini finishes. For v1, a synchronous user-triggered `/api/studio/analyze` route is acceptable. The target architecture should use a durable job table plus a worker/queue rather than relying on work after an HTTP response.

## 9. Deterministic analysis contract

Create a pure function:

```ts
analyzeManualLook(items, roles, context): ManualLookAnalysis
```

Output:

```ts
type ManualLookAnalysis = {
  hardValid: boolean;
  issues: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    itemIds: string[];
    message: string;
  }>;
  scores: {
    compatibility: number;
    palette: number;
    silhouette: number;
    formality: number;
    layering: number;
    footwear: number;
    total: number;
  };
  archetype: OutfitArchetype | "custom";
  tags: string[];
  explanation: string;
};
```

Reuse existing garment semantics, `validateOutfitCandidate`, scoring primitives, and feedback boundaries. Refactor private functions only when tests prove identical recommendation behavior.

Manual creativity should not be blocked. If a look violates physical rules:

- allow saving;
- show a clear warning;
- do not mark it as positive physical-compatibility training data;
- still learn non-physical preferences such as color, brands, and item affinity.

## 10. Gemini analysis contract

Gemini receives:

1. Clean exported collage preview.
2. Item contact sheet/cutouts.
3. Immutable item IDs.
4. Structured semantics and wearing roles.
5. Deterministic warnings and scores.
6. Optional occasion/weather supplied by the user.

Gemini returns strict JSON:

```json
{
  "summary": "...",
  "visualScores": {
    "color": 0.0,
    "silhouette": 0.0,
    "composition": 0.0,
    "occasion": 0.0
  },
  "strengths": ["..."],
  "issues": [{ "code": "...", "itemIds": ["..."], "message": "..." }],
  "suggestions": [{ "role": "shoe", "reason": "..." }],
  "styleTags": ["..."],
  "confidence": 0.0
}
```

Validation rules:

- No unknown item IDs.
- No item mutation.
- Scores bounded to `[0,1]`.
- Limited issue/tag counts.
- Prompt and model versions stored.
- Invalid output becomes a deterministic-only analysis, not a save failure.

## 11. Learning architecture

### The main rule

A manually saved outfit is **evidence of taste**, not automatically evidence of universal compatibility.

### Event weights

Suggested initial weights:

| Event | Weight | Meaning |
|---|---:|---|
| Item placed then removed | 0.05 | Weak exploration signal |
| Draft autosaved | 0.10 | Weak intent |
| Manual look saved | 0.60 | Positive taste signal |
| AI warning explicitly accepted | 0.20 | User knowingly prefers it |
| Saved look marked “Wear this” | 1.00 | Strong positive signal |
| Look worn repeatedly | 1.25 | Strongest behavioral evidence |
| Look deleted within 10 minutes | -0.25 | Likely accidental/unsatisfying |
| “Not my style” | -1.00 | Strong negative signal |

Weights must be configurable and evaluated—not hardcoded forever.

### Personalized co-occurrence graph

Maintain a derived user graph:

```text
node = wardrobe item
edge(A,B,roleA,roleB) = weighted times the user intentionally used A and B together
```

Apply time decay:

$$w_{effective} = w_{event} \times e^{-\lambda \Delta t}$$

Do not update this graph on every drag. Update from durable events.

### Personalized scoring

For an automatically generated candidate:

$$S_{final} = S_{grammar} + \alpha S_{visual} + \beta S_{preference} + \gamma S_{cooccurrence}$$

Subject to:

```text
hard physical failure → candidate excluded from automatic recommendations
```

Manual looks with a hard failure can still influence `S_preference`, but not the physical-compatibility model.

### Later ML path

Do not train a custom neural model with a handful of users.

Progression:

1. Weighted event rules.
2. User-specific attribute affinities.
3. Role-aware item co-occurrence graph.
4. Type-aware embedding reranker when enough data exists.
5. Outfit-level transformer only after there is a large, cleaned dataset and offline evaluation.

Research supports this sequence: type-aware embeddings distinguish similarity from cross-type compatibility, while outfit-level attention captures higher-order relationships beyond pairwise matching. These are future model options, not v1 dependencies.

## 12. API boundaries

```text
GET    /api/studio/documents/:id
POST   /api/studio/documents
PATCH  /api/studio/documents/:id     optimistic revision update
DELETE /api/studio/documents/:id

POST   /api/studio/looks             save stable manual look
POST   /api/studio/looks/:id/analyze deterministic + optional AI
GET    /api/studio/looks/:id/analysis
POST   /api/studio/looks/:id/tryon   reuse existing YouCam pipeline

GET    /api/studio/wardrobe          paginated signed assets + semantics
POST   /api/studio/events            bounded durable learning events
```

Batch node changes in one document request. Do not issue one HTTP request per drag event.

## 13. Frontend module boundaries

```text
web/app/studio/page.tsx
web/app/components/studio/
  OutfitStudio.tsx
  StudioToolbar.tsx
  StudioCanvas.tsx
  GarmentNode.tsx
  SelectionTransformer.tsx
  AlignmentGuides.tsx
  LayersPanel.tsx
  InspectorPanel.tsx
  WardrobeDock.tsx
  AnalysisPanel.tsx
  SaveLookDialog.tsx

web/app/hooks/
  useStudioDocument.ts
  useStudioHistory.ts
  useStudioAutosave.ts
  useStudioKeyboard.ts

web/lib/studio/
  document.ts
  reducer.ts
  commands.ts
  placement.ts
  snapping.ts
  serialization.ts
  analysis.ts
  learning.ts
  validation.ts
```

Keep Konva node references inside canvas components. The source of truth is the serializable studio reducer state, not mutable Konva nodes.

## 14. Keyboard and accessibility contract

- `Delete` / `Backspace`: remove selected node.
- `Cmd/Ctrl + Z`: undo.
- `Cmd/Ctrl + Shift + Z`: redo.
- Arrow keys: move 1 unit.
- `Shift + Arrow`: move 10 units.
- `[` / `]`: send backward / bring forward.
- `Cmd/Ctrl + S`: save.
- Escape: deselect/close context panel.

Canvas-only interfaces are difficult for keyboard and screen-reader users. Provide a DOM Layers panel where every garment can be selected, reordered, renamed, assigned a role, and deleted without pointer interaction.

## 15. Performance design

- Lazy-load the entire editor route and Konva bundle.
- Render wardrobe thumbnails, not original uploads.
- Virtualize the bottom wardrobe rail when there are hundreds of items.
- Use a dedicated static background layer and interactive garment layer.
- Do not update React state on every raw pointer frame; Konva can move visually, then commit at drag end.
- Use `requestAnimationFrame` only for alignment-guide calculation.
- Revoke object URLs after export.
- Limit canonical export dimensions and pixel ratio.
- Measure with 12 garment nodes, 500 wardrobe items, and mobile Safari.

## 16. Failure and conflict behavior

| Failure | User experience |
|---|---|
| Signed URL expires | Refresh asset URL and retry image load |
| Offline during edit | Keep IndexedDB draft; show offline badge |
| Server autosave fails | Preserve local document and retry with backoff |
| Revision conflict | Offer “reload remote” or “save as copy” |
| Preview export fails | Save document/items without preview; retry export |
| Deterministic analysis fails | Save blocked only for malformed/unauthorized data |
| Gemini fails/503 | Save succeeds with deterministic analysis |
| Wardrobe item deleted in another tab | Mark node unavailable; preserve snapshot; request replacement |
| YouCam fails | Manual look remains saved; try-on status fails independently |

## 17. Recommended implementation phases

### Phase 0 — Technical spike

- Install a React 19.2-compatible React Konva release and Konva 10+.
- Render private signed garment images.
- Drag, resize, reorder, and export a 4:5 WebP.
- Verify mobile pointer behavior and Next.js production build.

**Done:** five garments can be transformed and exported without taint/CORS errors.

### Phase 1 — Product shell

- Add Fitting Room / Outfit Studio navigation.
- Build desktop and mobile layouts.
- Add wardrobe dock, categories, search, empty/loading/error states.
- Implement category-aware auto-placement.

**Done:** user can enter from the header and assemble a temporary outfit.

### Phase 2 — Editor engine

- Reducer and versioned document schema.
- Selection, drag, aspect-locked resize, optional rotate.
- z-order, lock, delete, flip, reset.
- snapping and guides.
- keyboard shortcuts, layers panel, undo/redo.

**Done:** all editing commands are deterministic and unit tested.

### Phase 3 — Persistence and Looks integration

- Supabase migration and RLS.
- IndexedDB draft autosave.
- Optimistic server revisions.
- Preview export/private upload.
- Save to Looks with `origin = manual`.
- Reopen/edit/duplicate manual looks.

**Done:** permanent users can continue on another device; guest drafts stay local according to existing guest policy.

### Phase 4 — Deterministic outfit analysis

- Extract reusable grammar/scoring primitives.
- Implement `analyzeManualLook`.
- Show issues, score breakdown, tags, and explanations.
- Allow saving invalid creative looks with warnings.

**Done:** analysis is deterministic, tested, and never blocks creativity unnecessarily.

### Phase 5 — Gemini visual critic

- Strict analysis schema.
- User-triggered Analyze action.
- Versioned analysis records.
- Graceful deterministic fallback.
- “Improve this look” suggestions that reference roles, not invented items.

**Done:** AI failure never loses a look and never changes item ownership.

### Phase 6 — Learning loop

- Durable style events.
- Event weights and temporal decay.
- User attribute affinities.
- Role-aware co-occurrence graph.
- Integrate bounded personalization into recommendation scoring.
- Offline evaluation comparing baseline versus personalized ranking.

**Done:** personalized ranking improves held-out user choices without reducing hard-valid rate.

### Phase 7 — Product expansion

Consider only after core usage is measured:

- Templates: flat lay, editorial board, packing board.
- Calendar and weather planning.
- Shareable read-only look links with explicit privacy controls.
- Collaborative stylist/client boards.
- Notes, occasion, location, and packing tags.
- One-click “Try this look on me.”
- Smart replace: select a role and retrieve compatible alternatives.
- Missing-piece mode for retail: identify a useful category gap without pushing random products.

## 18. Non-goals for v1

- Real-time multiplayer.
- Arbitrary text/design tools like full Canva.
- Custom model training.
- Infinite canvas.
- Video elements.
- Public social feed.
- Automatic Gemini calls on every edit.
- Treating collage z-order as physical layer order.

## 19. Acceptance metrics

### Product

- Time to first manual look under 60 seconds.
- At least 50% of started documents reach Save.
- At least 25% of saved manual looks are reopened, worn, or tried on.
- Undo usage does not correlate with editor errors.

### Engineering

- 60 fps drag on target desktop with 12 nodes.
- At least 45 fps on target mobile.
- Initial Studio JavaScript loaded only on `/studio`.
- Autosave payload under 25 KB excluding images.
- Zero cross-user document or asset access in RLS tests.
- 100% deterministic analysis reproducibility for the same version/input.
- Gemini failure has zero effect on look persistence.

### Learning

- Hard-valid rate never decreases after personalization.
- Personalized top-3 acceptance improves over deterministic baseline.
- Event weights can be disabled or rolled back by version.

## 20. Final recommendation

Build **Outfit Studio** as a focused fashion editor, not a generic Canva clone.

Start with React Konva, a normalized versioned document, clear separation between visual stacking and wearing roles, IndexedDB draft safety, Supabase ownership, and deterministic analysis. Add Gemini only as an asynchronous bounded critic. Learn first through weighted events and role-aware co-occurrence; postpone custom ML until the data volume and evaluation harness justify it.

This approach gives TheLook a coherent loop:

```text
Own clothes → manually compose → understand why it works → save → try on → wear/feedback → improve future recommendations
```

## Sources

- Whering product and styling workflow: https://whering.co.uk/ and https://whering.co.uk/faq/styling-and-outfits
- Combyne creation/wardrobe/community features: https://www.combyne.com/
- GetWardrobe AI Studio, wardrobe, planning, sync, and statistics: https://getwardrobe.com/
- Konva interactive 2D scene graph: https://konvajs.org/docs/
- React Konva integration: https://github.com/konvajs/react-konva
- Konva Transformer: https://konvajs.org/docs/react/Transformer.html
- Konva alignment-guide pattern: https://konvajs.org/docs/sandbox/Objects_Snapping.html
- Fabric.js capabilities: https://github.com/fabricjs/fabric.js
- tldraw editor transactions/history model: https://tldraw.dev/docs/editor
- tldraw persistence and migrations: https://tldraw.dev/sdk-features/persistence
- tldraw export pipeline: https://tldraw.dev/sdk-features/image-export
- Fashion compatibility with Bi-LSTM and visual-semantic embeddings: https://arxiv.org/abs/1707.05691
- Type-aware fashion compatibility embeddings: https://arxiv.org/abs/1803.09196
- Outfit-level self-attention representation: https://arxiv.org/abs/2204.04812
