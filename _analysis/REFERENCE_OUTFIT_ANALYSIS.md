# TheLook reference-outfit analysis — 2026-10-28

## Scope and method

- Source: 12 men's and 8 women's supplied reference boards in `~/Downloads/outfits-for-men` and `~/Downloads/outfits-for-womens`.
- The boards contain roughly **220–240 outfit examples**. This is a qualitative visual analysis: derived garment, color, layering, silhouette, and styling rules are retained; source images are not copied into the product or committed.
- These examples define the target *casual / contemporary streetwear / smart-casual* aesthetic. They are not universal fashion truth and should never override the user's own preferences, climate, modesty, fit, or accessibility needs.

## Per-board observations

| Ref | Visual family | Repeated formulae | Palette / proportion lessons |
| --- | --- | --- | --- |
| M01 | relaxed minimal outerwear | tee or knit + short jacket/overshirt + straight or wide trouser + low-profile sneaker | One neutral outer layer, one neutral trouser, and either a light tee reveal or light shoe keeps a dark outfit from becoming heavy. Jacket ends near hip; trouser has relaxed straight volume. |
| M02 | tonal smart casual | knit or polo, sometimes overshirt; relaxed tailored trouser/jean; clean sneaker or loafer | Brown, cream, olive, black, and navy work through value contrast rather than exact hue matching. A white tee hem is a deliberate bridge layer. |
| M03 | oversized summer casual | oversized tee or short-sleeve overshirt + wide denim/trouser + skate sneaker | One graphic/stripe is enough. Wide bottoms are balanced by an equally relaxed top, not a fitted one. |
| M04 | red-check street layer | white long sleeve base + open checked short-sleeve shirt + washed-black baggy jean + black sneaker | Repeat an accent once only: red check and cap echo each other while black bag/shoe/denim form the base. |
| M05 | color-block casual | brown half-zip tee + light-blue wide jean + grey/navy chunky sneaker | A warm top and cool denim are unified by neutral shoes and a small bag with both warm tones. |
| M06 | modern baggy streetwear | sweatshirt, polo, tee, hoodie, or overshirt + wide jean/cargo + white sneaker | Shared silhouette matters more than matching every color: relaxed top + wide leg, visible white base layer, and one utilitarian accessory recur. |
| M07 | seasonal layered streetwear | sweatshirt or tee over long-sleeve; jacket/overshirt when needed; cargo/jean; sneaker or work shoe | Layer counts rise with outerwear; all layers remain relaxed. Strong plaid is paired with quiet black/blue bottoms. |
| M08 | clean casual | white tee base + plaid overshirt, hoodie, knit, or lightweight jacket + jeans/trousers + white sneaker | White is used as a recurring anchor at neck/hem/shoe. Outerwear has the visual weight; trousers are quiet. |
| M09 | weekend chill | olive overshirt + white tee + cream wide trouser + white/black sneaker | The most reusable three-tone formula: muted color outer + white base + light neutral bottom. |
| M10 | burgundy smart casual | white shirt base + burgundy cardigan + beige wide trouser + black leather shoe | Accent knit becomes the focal point; white and beige soften it, while black shoe/watch give a formal endpoint. |
| M11 | layered graphic streetwear | dark oversized graphic tee over white long sleeve + washed-grey wide jean + beige work boot | The tee and jeans are low-saturation; tan boots are the single warm accent. The white sleeves prevent a top-heavy dark block. |
| M12 | preppy utility streetwear | rugby/knit/hoodie/shirt under jacket or vest + relaxed jean/cargo | Strong top pattern is paired with calm trouser. Outer layers usually echo a color already present in the base layer. |
| W01 | shirt-over-base casual | fitted crop/tank base + open shirt/jacket + wide light denim or wide dark trouser + sneaker | Same base/bottom can support different mood through a single colored shirt. This is a controlled “one swap changes the outfit” system. |
| W02 | compact autumn capsule | leather jacket, trench, cardigan, knit, white shirt + tailored trouser/jean/skirt + coordinated bag/shoe | Brown, cream, burgundy, black, and faded denim repeat across layers. Shoes/bag are usually in the same dark neutral family. |
| W03 | easy collegiate casual | knit/cardigan/sweatshirt or tee + wide jean/trouser/skirt + sneaker/loafer/boot | Outfit interest comes from one structural element: vest, collar, stripe, plaid, skirt, or cardigan. Do not stack all of them. |
| W04 | western-inspired smart casual | oversized button-up + high-waist wide trouser/jean + sneaker or pointed shoe + shoulder bag | Contrast comes from warm/cool or dark/light top-to-bottom. The partially tucked shirt establishes waist and prevents wide-on-wide from looking shapeless. |
| W05 | burgundy, beige, denim autumn capsule | burgundy knit/coat/cardigan + cream knit/shirt + light denim or beige trouser + burgundy/brown accessory | Burgundy is a capsule accent, not random decoration: it appears in one garment and sometimes one accessory, against cream/denim. |
| W06 | jeans color-combination matrix | dark, white, or grey jean + a deliberately matched single top color + simple light sneaker | Value contrast is the rule: light top with dark jean; black/camel/light-blue/grey with white jean; white/olive/black/pink with grey jean. |
| W07 | everyday casual streetwear | crop/fitted top, tee, sweatshirt, or layer + cargo/denim/wide sweatpant + sneaker | Volume is typically placed in the bottom; when both pieces are loose, a cropped/short base, fitted tank, or visible waist restores a silhouette. |
| W08 | named everyday archetypes | graphic sweatshirt, polo/stripe knit, crop top, hoodie, shirt, or jacket + cargo/jean/wide pant | Each outfit has one clear role: sporty, preppy, street, soft/pastel, smart-casual, edgy. Footwear stays simple so the role remains legible. |

## High-confidence rules shared by the references

### 1. Build a silhouette, not a list of garments

The strongest recurring silhouettes are:

```text
RELAXED_COLUMN:  relaxed top + relaxed straight/wide bottom + low-profile shoe
RELAXED_LAYERED: base tee/tank + open mid/outer layer + relaxed bottom
TOP_FOCAL:       statement knit/shirt/jacket + quiet neutral bottom
BOTTOM_FOCAL:    quiet fitted/cropped/short top + cargo/wide/statement bottom
WAIST_DEFINED:   tucked/partially tucked top + high-rise wide bottom
```

A recommendation must choose one silhouette intentionally. It should reject conflicting silhouette signals, e.g. oversized outer + bulky top + extremely wide bottom unless the user explicitly selects an avant-garde/baggy preference.

### 2. Layers have an order and a visual job

```text
base:  tee, tank, long-sleeve, fitted shirt, light knit
mid:   open overshirt, cardigan, vest, hoodie, short-sleeve shirt
outer: jacket, trench, blazer, coat
```

- A visible base (neck, hem, sleeve) often bridges the palette and separates dark layers.
- Open mid-layers are more compatible with a simple base than a second busy pattern.
- The outer/mid layer should be the dominant visual role; the base supports it.
- Layer count must be climate-aware and material-aware, not just category-aware.

### 3. Use a palette hierarchy

The boards repeatedly use **2–3 garment color families** plus neutral shoes/accessories:

```text
60% base neutral:  cream, white, black, charcoal, navy, denim, beige
30% support tone:  olive, brown, grey, faded blue, camel
10% accent:        burgundy, red, forest green, pink, mustard, a graphic/plaid
```

Rules:

- Match **value** (light / mid / dark) and **temperature** (warm / cool) before literal RGB closeness.
- Repeating an accent once is useful; repeating it three times becomes costume-like.
- If the top has a graphic, stripe, plaid, or strong texture, keep the bottom quiet.
- Shoes are a palette bridge: white/cream sneakers lighten an outfit; black/brown leather shoes deliberately raise formality.

### 4. Formality and footwear must agree

- White low-profile sneakers: casual and clean smart-casual.
- Chunky/work boots: utility/streetwear; need denim/cargo weight.
- Loafers, pointed shoes, leather derbies: smart-casual/formal; need tailored or polished counterparts.
- A recommendation should strongly penalize formal footwear with athletic/cargo styling unless a declared style profile permits the contrast.

### 5. One focal element is enough

A focal element can be a colored outer layer, plaid/stripe, texture, graphic, leather jacket, striking skirt, or unusual silhouette. Give it quiet companions. This must be a hard ranking penalty rather than only an explanation rule.

### 6. Repetition is good only when it has a job

Legible repetition includes a white tee hem + white sneaker, burgundy cardigan + burgundy bag, black shoe + black bag. The engine should reward 1–2 deliberate echoes, not generic color duplication.

## Current-generator gaps revealed by the corpus

`web/lib/recommend.ts` has valid formula construction and basic color/formality/style checks, but it does not model:

1. visual role (base / support / focal),
2. palette value, temperature, or deliberate color echoes,
3. silhouette volume distribution and waist/length balance,
4. pattern/texture intensity,
5. footwear-to-formality/style compatibility,
6. layer visibility/order and material/season warmth,
7. outfit archetypes or a strict diversity strategy,
8. calibrated quality thresholds grounded in a reference corpus.

Gemini reranking cannot recover a great outfit that was excluded by candidate generation.

## Non-negotiable product implication

Do not present a heuristic as a “cohesion percentage.” Until calibrated against labeled examples, show transparent style labels such as **Balanced**, **Relaxed layered**, **Polished**, or **Bold**. The number implies false precision.
