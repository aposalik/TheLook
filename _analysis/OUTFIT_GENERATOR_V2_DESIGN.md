# TheLook Outfit Generator v2 — reference-driven design

## Goal

Generate a **small set of intentionally different, wardrobe-grounded outfits** that match a user’s occasion, climate, style profile, and silhouette preference. The system must explain why an outfit is viable and permit item-level swaps. It must not claim a single mathematically “perfect” look.

## Architecture

```text
wardrobe images
  -> garment annotation (human-editable; Gemini assists)
  -> normalized style features
  -> hard-constraint candidate builder
  -> explainable feature scorer
  -> quality threshold / reject
  -> diversity selector (safe, balanced, expressive)
  -> Gemini visual critic for finalists only
  -> user feedback + item-swap loop
```

Gemini is a **critic** and copywriter, never the source of ownership, compatibility constraints, or item IDs.

## 1. Metadata the current `Item` model needs

Keep existing fields and add the following human-editable values. Inference can propose them; users must be able to correct them.

```ts
type StyleFeatures = {
  // Palette, not raw RGB alone
  hueFamily: "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "brown" | "grey" | "black" | "white" | "denim";
  value: "light" | "mid" | "dark";
  temperature: "warm" | "cool" | "neutral";
  chroma: "muted" | "medium" | "bright";

  // Visual texture
  pattern: "solid" | "stripe" | "check" | "graphic" | "floral" | "animal" | "other";
  patternScale: "none" | "small" | "medium" | "large";
  texture: "smooth" | "denim" | "knit" | "rugged" | "leather" | "technical";

  // Garment geometry and visual role
  fitVolume: "fitted" | "regular" | "relaxed" | "oversized";
  length: "cropped" | "regular" | "long";
  rise?: "low" | "mid" | "high";
  silhouetteRole: "base" | "support" | "focal" | "neutral";
  layerRole: "base" | "mid" | "outer" | "bottom" | "shoe" | "accessory";

  // Context
  warmth: 1 | 2 | 3 | 4 | 5;
  formality: 1 | 2 | 3 | 4 | 5;
  styleTags: Array<"minimal" | "streetwear" | "preppy" | "utility" | "smart-casual" | "romantic" | "sporty" | "edgy">;
};
```

Important: `slots` describes what a garment *can be*. `layerRole` describes what it is doing in this candidate. A shirt can be a base when buttoned and a mid-layer when open.

## 2. Hard constraints — reject before scoring

```text
STRUCTURE
- one bottom OR one dress, never both
- 1 base maximum; 0–1 mid; 0–1 outer (unless an explicit advanced-layering profile)
- no duplicate garment
- no category collision (two shoes, two competing outer layers)
- selected/locked garments are present

LAYERING
- mid / outer must have an appropriate base unless its garment profile allows solo use
- patterned mid/outer cannot sit over a high-intensity patterned base by default
- total warmth must fit the weather band

CONTEXT
- every item must belong to the user or the configured catalog
- occasion/formality mismatch above two levels is rejected
- formal shoe + athletic/utility outfit, or work boot + delicate formal look, is rejected unless explicitly opted in

IMAGE / DATA CONFIDENCE
- low-confidence garment annotation is not used as a focal or complex-layer piece until confirmed
```

## 3. Candidate construction from archetypes

Replace a flat formula list with named, context-aware archetypes. Each archetype is still constrained by valid slots.

```text
safe-casual:          simple top + bottom + sneaker
relaxed-layered:      simple base + open overshirt/light jacket + bottom + sneaker
polished-smart:       shirt/knit/cardigan + tailored bottom + leather shoe/clean sneaker
utility-street:       relaxed top + cargo/denim + boot/chunky sneaker
soft-casual:          fitted/cropped or simple top + high-rise/wide bottom + sneaker/loafer
structured-autumn:    knit/shirt + cardigan/jacket/coat + tailored bottom + leather shoe
statement-top:        focal top/outer + neutral bottom + quiet shoe
statement-bottom:     quiet top + focal bottom + quiet shoe
```

Archetype selection starts from occasion, weather, and a user-selected style intent. If no intent is supplied, return one candidate each from **safe**, **balanced**, and **expressive**—not three near-duplicates.

## 4. Explainable scoring

Score only candidates that survive hard constraints. Every component must be stored with the candidate for UI explanation and offline evaluation.

```ts
type OutfitScore = {
  structure: number;       // valid layer order + complete formula
  palette: number;         // hue/value/temperature + deliberate echoes
  silhouette: number;      // volume distribution, waist/length balance
  formality: number;       // all pieces and footwear suit the context
  style: number;           // overlap with selected style intent
  weather: number;         // warmth/layer count vs temperature/rain
  focalBalance: number;    // exactly 0–1 strong visual focal point
  footwear: number;        // shoe aligns to outfit family and trousers
  novelty: number;         // differs from recently generated/saved looks
  confidence: number;      // metadata quality; prevents false certainty
  total: number;
};

const total =
  0.18 * structure +
  0.17 * palette +
  0.16 * silhouette +
  0.13 * formality +
  0.10 * style +
  0.10 * weather +
  0.07 * focalBalance +
  0.05 * footwear +
  0.02 * novelty +
  0.02 * confidence;
```

### Palette scorer

Use attributes rather than Euclidean RGB distance:

```text
+ value contrast or intentional tonal continuity
+ compatible warm/cool relationship
+ 0–1 high-intensity pattern/graphic
+ 1–2 deliberate palette echoes (shoe ↔ base, bag ↔ outer, etc.)
- more than one competing accent / high-chroma focal garment
- patterned top + patterned bottom unless explicitly compatible
```

### Silhouette scorer

```text
+ relaxed top + relaxed straight/wide bottom (reference streetwear profile)
+ fitted/cropped or tucked top + high-rise/wide bottom (waist-defined profile)
+ outer layer ends at an appropriate point relative to bottom volume
+ a visible base layer that breaks up a heavy dark stack
- oversized outer + bulky mid + extremely wide bottom without baggy-profile opt-in
- cropped outer + long untucked base when it creates accidental proportions
```

## 5. Quality gates and diversity

```text
1. Reject total < configured threshold.
2. Select first look: highest balanced total.
3. Select second look: high total but different archetype OR focal item.
4. Select third look: high total but different palette value pattern or silhouette.
5. Never return two looks that differ only by shoe/accessory.
```

Return labels instead of fake precision:

```text
Safe choice       = highest confidence, low contrast, predictable
Balanced choice   = best total score
Expressive choice = compatible color / layer / focal variation with bounded risk
```

## 6. Gemini visual critic — structured and bounded

Give Gemini only 5–8 valid candidates, their images, metadata, score breakdown, and the locked context. Ask it to identify visible mismatches and select/rerank, but not to generate new combinations.

```json
{
  "lookId": "candidate_4",
  "verdict": "strong | acceptable | reject",
  "visibleScores": {
    "palette": 0,
    "silhouette": 0,
    "layering": 0,
    "occasion": 0
  },
  "issues": ["..."],
  "preferredSwapRole": "shoe | base | mid | outer | bottom | none",
  "reason": "one concise user-facing explanation"
}
```

If Gemini disagrees with deterministic constraints, constraints win. A Gemini rejection can lower rank; it cannot add an item or bypass validation.

## 7. Product loop: make the user the final optimizer

The result card needs these controls:

```text
Keep this item       -> lock its ID and regenerate remaining roles
Replace shoes        -> regenerate only that role
More polished        -> shift archetype/formality constraints
More relaxed         -> shift volume/formality constraints
More color / simpler -> shift palette/focal constraints
Not my style         -> negative feedback against style tags/archetype
Save                 -> positive feedback for feature weights
```

This is how the system becomes personal without pretending one zero-context output is perfect.

## 8. Test before implementation

Create a fixture corpus before changing weights:

```text
fixture inputs: 20–40 small wardrobes, preference/context, locked items
expected: valid / invalid; must include; must exclude; preferred archetype; 1–2 accepted outputs
```

Examples derived from the supplied references:

```text
olive overshirt + white tee + cream wide trouser + white/black sneaker
  -> must rank as relaxed-layered weekend; palette echo via white base/shoe

burgundy cardigan + white shirt + beige wide trouser + black leather shoe
  -> must rank as polished smart-casual; burgundy is sole focal color

plaid overshirt + white tee + black relaxed trouser + white sneaker
  -> must permit one patterned mid-layer; must reject an added patterned base

black graphic tee + white long sleeve + washed-grey baggy jean + tan work boot
  -> must rank as utility-street; must not call it formal
```

Run tests after every scoring change; use user-facing visual review only after a candidate passes structural tests.

## Implementation order

1. Add a migration and UI editing support for `StyleFeatures`.
2. Create fixture tests and snapshot generated candidates.
3. Extract the current `scoreOutfit()` into named scoring functions, preserving existing output behind a feature flag.
4. Implement hard constraints and archetype builders.
5. Add palette, silhouette, focal, and footwear scores.
6. Add maximal marginal relevance diversity selection.
7. Change Gemini rerank schema to structured criticism.
8. Add item lock/swap and lightweight feedback capture.
9. Tune weights only against fixtures and human visual review.

## Definition of done

- Every displayed look has a stored score breakdown and a clear archetype.
- The generator returns no invalid layer/category combinations.
- Fixtures prove the rules from the reference corpus.
- Three results are recognizably different in silhouette, focal piece, or palette—not only accessories.
- A user can lock an item and regenerate around it.
- Gemini cannot introduce unowned items or overrule hard constraints.
