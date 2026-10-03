# FitRoom — Plan

## Product concept
A web PWA mini-storefront (working name **FitRoom**). Small catalog: a few makeup items + a few apparel items. A shopper can:
1. **Try makeup live** — real-time AR mirror (lipstick / foundation / eyeshadow shade swaps)
2. **Try clothes on their photo** — upload/capture → generative render wearing the garment
3. **Get recommendations** — skin undertone analysis → "these shades + these colors suit you" (the non-obvious idea that ties makeup + apparel into one story; satisfies the rubric's "decision/recommendation" expectation)
4. **Add to cart** — mock checkout

## Open decision (lock in Week 1)
Niche / audience. Candidates: K-beauty shop, menswear capsule brand, "get-ready-for-an-event" concierge, etc.
Write one sentence: "For ___, FitRoom lets them ___."

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

## The habit that wins
Finish the walking skeleton (Epic 0) before ANY UI. If YouCam's apparel API misbehaves, find out on day 2 with 4 weeks to adapt — not on day 25 with a pretty shell and no core.
