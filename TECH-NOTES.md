# FitRoom — Tech Notes & Key Decisions

## The real-time reality (the core constraint)
Two try-on technologies, fundamentally different:

| | Makeup VTO | Apparel VTO (YouCam GenAI Clothes) |
|---|---|---|
| How | On-device AR, tracks face live | Generative AI, renders a new image |
| Real-time? | YES — ~30fps live mirror | NO — upload → ~seconds → one image |
| Runs | Client-side (WebGL/WASM in browser) | Server-side (their GPUs) |
| Cost | Cheap once loaded | 1 credit PER generated image |

**Why clothes can't be naive real-time:** generative try-on *creates a new image* of you in the garment. ~30 multi-second GPU renders/sec = impossible + insane credit burn. So clothes = upload photo → render. The "magic moment" is the *reveal*, not live tracking. UX trick: live camera to CAPTURE instantly, slick 3–5s generating animation, then reveal → reads as real-time to a shopper.

## Decart Anywear — the exception (researched, understood)
Anywear (anywear.decart.ai) DOES do live-video clothing try-on. It's powered by **Decart's Lucy V-TON** model — a **real-time video-to-video diffusion model** that regenerates the camera feed frame-by-frame with true drape simulation (~1.5s to lock on, then tracks live). It does NOT spend a credit per frame — it amortizes one continuous model over the stream.
- Why only they can: real-time generative video IS their whole company (Oasis, Mirage, Lucy) — bespoke model + heavily optimized GPU inference. Frontier-lab-level, not an integration.
- What it means for us: **YouCam's apparel API is the single-image kind, NOT Lucy.** Live-video clothing is off the menu for this hackathon. (To chase live clothes you'd drop the hackathon and integrate Decart's API instead — different project, no prize. Noted, not now.)

## Architecture
```
Browser (Next.js PWA)
  ├─ Makeup: YouCam AR SDK (client-side, domain-locked license key — OK in browser)
  └─ Everything server-side → YOUR backend proxy → YouCam REST API (secret key server-side)
```

### API key security — WHY never call REST from the browser
- REST APIs (GenAI Clothes, Skin Analysis) auth with a **secret key**. In browser JS it's visible in DevTools → Network / the JS bundle. Anyone copies it → burns your 1,000 credits or bills your account. Like publishing a password.
- Fix: thin backend proxy. Browser → `/api/tryon` (your server, holds key in env) → YouCam. Browser never sees the key.
- Backend also does rate-limit + cache so a bug/loop can't drain all credits.
- EXCEPTION: the AR makeup SDK license key is **domain-locked** → useless off your domain → fine client-side.

## Stack
- Next.js (App Router) + React, deploy on **Vercel**
- Secret in `process.env.PERFECTCORP_SECRET` (server only)
- API routes: `/api/tryon` (apparel generate), `/api/analyze` (skin/undertone)
- PWA config so it installs on phone + camera via `getUserMedia`
- Catalog: hardcoded JSON (no DB needed for a hackathon)

## Credit discipline (only 1,000 units)
- Mock the apparel API in dev; only hit live when needed.
- Cache every (photo, garment) → result. Never re-render the same combo.
- Makeup AR is on-device → doesn't burn REST credits, lean on it for the "wow".

## Platform decision: web first
Web PWA = judged on demo video anyway, IS mobile (phone browser + camera), AR runs in browser, fastest iteration. Native only if time remains. Don't split 4.5 solo weeks across two platforms.
