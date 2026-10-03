# FitRoom — YouCam API Skin AI & eCommerce VTO Hackathon

Solo hackathon project by Salik (0xALTHOR). Web PWA mini-storefront built on Perfect Corp / YouCam APIs.

## The one-liner
A web storefront where a shopper can **try makeup live (real-time AR)**, **try clothes on their photo (generative render)**, and **get shade/color recommendations** from skin undertone analysis — turning "will this look good on me?" into a confident purchase.

## Status
- Created: 2026-09-30
- Deadline: **2026-11-02 (~11:45 EST)** — hackathon edition 2 "eCommerce VTO", Devpost ID 31400
- Phase: PLANNING (no code yet)

## Docs in this folder
- `HACKATHON.md` — all hackathon facts (prizes, rules, judging, deadlines, links)
- `PLAN.md` — product concept, Kanban board, backlog, week-by-week schedule
- `TECH-NOTES.md` — architecture, the real-time reality check, API security, key decisions
- `_progress/` — checkpoint files as the build progresses

## Locked decisions
- Track: **eCommerce VTO** (not pure Skin AI)
- Makeup = **real-time on-device AR** (YouCam SDK, runs in browser)
- Clothes = **upload photo → generative render** (YouCam GenAI Clothes API, ~seconds, 1 credit/render). NOT live video.
- Platform: **Web first** (Next.js PWA on Vercel). Mobile only if time allows.
- Secret REST API key lives **server-side only** (thin backend proxy). SDK license key is domain-locked, OK client-side.
- Process: **Kanban** (GitHub Projects), WIP limit 2, walking-skeleton-first.

## Open decision
- Niche / target audience — the first card to lock in Week 1.
