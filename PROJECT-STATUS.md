# TheLook — HackTown Submission Status

**Audit date:** 2026-10-29
**Repository:** `github.com/aposalik/TheLook`
**Branch audited:** `main`
**HEAD:** `66dc82d` — merged rolling-rack stylist, weather integration, three-layer try-on, and professional docs
**Hackathon:** Perfect Corp YouCam eCommerce VTO Hackathon, deadline 2026-11-02

## Executive status

TheLook is a working Next.js 16 wardrobe-styling and virtual try-on prototype. The strongest submission story is:

> TheLook turns a user's own wardrobe into physically viable, weather-aware outfits and previews the selected look on their avatar through YouCam Cloth-v4.

The local engineering gates are green. The remaining submission work is operational and presentation-focused: hosted-environment verification, one clean end-to-end demo run, screenshots, a 1–3 minute video, and Devpost copy.

## Implemented product surface

- Wardrobe upload with client-side background removal and AI/fallback garment analysis.
- User-facing wardrobe categories: Tops, Outerwear, Bottoms, Dresses, Shoes, Accessories.
- Internal garment grammar: garment type, neckline/collar, closure, fabric, weight, silhouette volume, layer role, loungewear, and substantial-layer capability.
- Deterministic outfit construction with hard constraints, explainable score breakdowns, named archetypes, diversity selection, weather context, ownership checks, and gender-aware anchor filtering.
- Gemini Vision candidate judging with strict structured output validation; deterministic fallback remains available when Gemini is unavailable or returns malformed output.
- Style Assistant chat with occasion and Open-Meteo weather context.
- Feedback controls: Wear this, Not my style, item locks, and role-level swaps.
- Avatar management, saved looks, lookbook, bag/cart flow, and manual Show On Me intent.
- Three-layer try-on synthesis: upper-layer collage, optional lower-body chaining, cache versioning, render diagnostics, and omission checks.
- Supabase Auth, private Storage/Postgres integration, RLS-oriented ownership checks, render quota protection, and signed URL routes.

## Verification completed on this audit

Run from `web/` with `MOCK=1`:

- `npm run test:recommend` — **30 passed, 0 failed**
- `npm run eval:recommend` — **11/11 fixtures passed**
- `npx tsc --noEmit` — **passed**
- `npm run lint` — **0 errors, 30 warnings**
- `npm run build` — **passed**

The warnings are existing image-optimization and unused-code warnings; they do not fail CI.

## Known limitations and blockers

1. **Gemini availability is external.** Gemini may return HTTP 503 during high demand, or the local protected egress proxy may fail TLS. The product correctly falls back to deterministic ranking and labels that state. A live Gemini call is not a reliable local acceptance gate.
2. **Supabase migrations need hosted verification.** The repository contains foundation, quota, wardrobe semantics, and outfit-feedback migrations. The linked Supabase CLI previously failed with a transport error; confirm migration state in the dashboard/CLI before public deployment.
3. **YouCam credentials/runtime need one controlled hosted test.** The repository has a documented successful Cloth-v4 upper-body render in prior progress notes, but the final main-branch flow should be tested once with the real environment and credits protected.
4. **Guest/permanent account behavior needs browser smoke testing.** Verify guest isolation, permanent sign-in, no guest-data merge, private Storage access, and paid-render rejection for anonymous users.
5. **Documentation claims must remain honest.** Gemini is a judge/fallback layer, not the sole outfit generator; deterministic generation is intentional and should be described as a safety feature.

## HackTown submission checklist

- [x] Integrate at least one YouCam API: Cloth-v4 is integrated.
- [x] Provide source and setup instructions.
- [x] Explain consumer value and technical differentiation.
- [ ] Confirm deployed/demo URL.
- [ ] Perform one clean demo flow: upload/choose wardrobe → Generate Outfit → select look → Show On Me → save look.
- [ ] Capture 4–6 product screenshots.
- [ ] Record a 1–3 minute demo video.
- [ ] Write Devpost description, architecture, APIs, limitations, and privacy notes.
- [ ] Confirm Supabase migrations, environment variables, and authentication providers in the deployment.
- [ ] Submit before 2026-11-02.

## Recommended demo narrative

1. Start with a wardrobe containing a shirt, V-neck knit, trousers, and shoes.
2. Show the wardrobe's familiar categories, not internal layer taxonomy.
3. Lock or select an anchor garment and choose an occasion/weather context.
4. Generate three distinct, explainable outfits.
5. Point out the physical grammar: the V-neck intentionally frames the shirt collar; bulky hoodie-under-pullover combinations are rejected.
6. Choose a look, click Show On Me, and show the YouCam result.
7. Save the look and demonstrate feedback or a role-level swap.

## Source of truth

- Product and setup overview: `README.md`
- Current phase checklist: `PHASES.md`
- Production/hosting contract: `PRODUCTION-ARCHITECTURE.md`
- Hackathon facts: `HACKATHON.md`
- Implementation checkpoints: `_progress/`
