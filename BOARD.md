# FitRoom — Kanban Board Reference

Board columns (GitHub Projects → Board view, "Status" field):
`Backlog → To Do → In Progress (WIP max 2) → Review/Test → Done`  + `Blocked` tag

Everything below is created automatically by `scripts/setup-github.sh` as GitHub Issues,
labelled by epic and assigned to a weekly milestone. Add them to a Project board and
group by Status.

## Labels
- `epic-0-spike` · `epic-1-makeup` · `epic-2-apparel` · `epic-3-reco` · `epic-4-store` · `epic-5-submit`
- `blocked` · `priority-high`

## Milestones (weeks)
- Week 1 — Walking skeleton (due Oct 6)
- Week 2 — Makeup + Apparel working (due Oct 13)
- Week 3 — Recommendation + Storefront (due Oct 20)
- Week 4 — Polish + Submit (due Oct 27)

## Cards

### Epic 0 — Spike / Walking skeleton (Week 1) [priority-high]
1. Register on Devpost, claim API key + 1,000 credits
2. Lock the niche/audience — one sentence: "For ___, FitRoom lets them ___"
3. Scaffold Next.js app + deploy empty shell to Vercel
4. Thin backend proxy: one API route holding the secret key
5. Walking skeleton: upload photo → apparel VTO via proxy → show image (ugly OK)
6. Get makeup AR SDK loading + live camera feed on one page

### Epic 1 — Makeup live AR (Week 2)
7. Live camera mirror with one lipstick shade applied
8. Shade picker — swap colors live
9. 2–3 makeup categories (lip, foundation, eye)

### Epic 2 — Apparel generative try-on (Week 2)
10. Photo capture (camera) + upload fallback
11. Garment select → generate → reveal (loading animation)
12. Credit-guard: cache (photo,garment)→result, rate-limit, no duplicate renders

### Epic 3 — Recommendation layer (Week 3)
13. Skin undertone analysis from selfie
14. Map undertone → recommended makeup shades + apparel colors
15. "Your matches" strip in the store

### Epic 4 — Storefront / UX (Week 3)
16. Product catalog (hardcoded JSON)
17. Product page with "Try it on" entry points
18. Add-to-cart / mock checkout
19. Mobile PWA polish — test on phone

### Epic 5 — Submission (Week 4)
20. README + setup instructions
21. Screenshots
22. 1–3 min demo video (script the end-to-end flow)
23. Devpost write-up (tie features to retail value + name APIs)
24. Submit early on Devpost, then keep polishing
