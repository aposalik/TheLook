#!/usr/bin/env bash
#
# TheLook — one-shot GitHub setup: repo + labels + milestones + issues + (optional) Project board.
#
# PREREQS
#   - gh CLI authed:            gh auth status
#   - For the Project board:    gh auth refresh -s project    (adds the 'project' scope you're missing)
#     Issues/labels/milestones work with your current 'repo' scope — the Project step is optional.
#
# USAGE
#   bash scripts/setup-github.sh            # creates everything
#   REPO=my-name VISIBILITY=public bash scripts/setup-github.sh
#
set -euo pipefail

REPO="${REPO:-TheLook}"
VISIBILITY="${VISIBILITY:-private}"        # private | public
OWNER="$(gh api user --jq .login)"
PROJECT_TITLE="TheLook VTO"

echo "==> Owner: $OWNER   Repo: $REPO   Visibility: $VISIBILITY"

# 1) Repo ----------------------------------------------------------------------
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  echo "==> Repo already exists, skipping create."
else
  gh repo create "$OWNER/$REPO" --"$VISIBILITY" \
    --description "TheLook — YouCam API Skin AI & eCommerce VTO Hackathon (Perfect Corp, Devpost #31400)"
fi

# 2) Labels --------------------------------------------------------------------
label() { gh label create "$1" --color "$2" --description "$3" --force --repo "$OWNER/$REPO" >/dev/null; }
echo "==> Labels"
label "epic-0-spike"   "5319e7" "Spike / walking skeleton"
label "epic-1-makeup"  "e11d48" "Makeup live AR"
label "epic-2-apparel" "2563eb" "Apparel generative try-on"
label "epic-3-reco"    "059669" "Recommendation layer"
label "epic-4-store"   "d97706" "Storefront / UX"
label "epic-5-submit"  "6b7280" "Submission assets"
label "blocked"        "b91c1c" "Waiting on API / external"
label "priority-high"  "000000" "Do first"

# 3) Milestones ----------------------------------------------------------------
milestone() { # title, due (YYYY-MM-DD)
  gh api "repos/$OWNER/$REPO/milestones" -f title="$1" -f due_on="${2}T23:59:59Z" >/dev/null 2>&1 \
    || echo "    (milestone '$1' may already exist)"
}
echo "==> Milestones"
milestone "Week 1 — Walking skeleton"            "2026-10-06"
milestone "Week 2 — Makeup + Apparel working"    "2026-10-13"
milestone "Week 3 — Recommendation + Storefront" "2026-10-20"
milestone "Week 4 — Polish + Submit"             "2026-10-27"

# 4) Issues --------------------------------------------------------------------
# format: "label|milestone|title|extra-label"
issue() {
  local label="$1" ms="$2" title="$3" extra="${4:-}"
  local args=(--repo "$OWNER/$REPO" --title "$title" --label "$label" --milestone "$ms" --body "Part of $label.")
  [ -n "$extra" ] && args+=(--label "$extra")
  gh issue create "${args[@]}" >/dev/null
  echo "    + $title"
}
echo "==> Issues"
W1="Week 1 — Walking skeleton"
W2="Week 2 — Makeup + Apparel working"
W3="Week 3 — Recommendation + Storefront"
W4="Week 4 — Polish + Submit"

issue epic-0-spike "$W1" "Register on Devpost, claim API key + 1,000 credits" priority-high
issue epic-0-spike "$W1" "Lock the niche/audience (one sentence)" priority-high
issue epic-0-spike "$W1" "Scaffold Next.js app + deploy empty shell to Vercel"
issue epic-0-spike "$W1" "Thin backend proxy: API route holding the secret key"
issue epic-0-spike "$W1" "Walking skeleton: upload photo -> apparel VTO -> show image" priority-high
issue epic-0-spike "$W1" "Makeup AR SDK loading + live camera feed on one page"

issue epic-1-makeup "$W2" "Live camera mirror with one lipstick shade applied"
issue epic-1-makeup "$W2" "Shade picker — swap colors live"
issue epic-1-makeup "$W2" "2-3 makeup categories (lip, foundation, eye)"

issue epic-2-apparel "$W2" "Photo capture (camera) + upload fallback"
issue epic-2-apparel "$W2" "Garment select -> generate -> reveal (loading animation)"
issue epic-2-apparel "$W2" "Credit-guard: cache results, rate-limit, no duplicate renders"

issue epic-3-reco "$W3" "Skin undertone analysis from selfie"
issue epic-3-reco "$W3" "Map undertone -> recommended shades + apparel colors"
issue epic-3-reco "$W3" "'Your matches' strip in the store"

issue epic-4-store "$W3" "Product catalog (hardcoded JSON)"
issue epic-4-store "$W3" "Product page with 'Try it on' entry points"
issue epic-4-store "$W3" "Add-to-cart / mock checkout"
issue epic-4-store "$W3" "Mobile PWA polish — test on phone"

issue epic-5-submit "$W4" "README + setup instructions"
issue epic-5-submit "$W4" "Screenshots"
issue epic-5-submit "$W4" "1-3 min demo video (script end-to-end flow)"
issue epic-5-submit "$W4" "Devpost write-up (retail value + name APIs)"
issue epic-5-submit "$W4" "Submit early on Devpost, then keep polishing" priority-high

# 5) Project board (optional — needs 'project' scope) --------------------------
echo "==> Project board"
if gh project list --owner "$OWNER" >/dev/null 2>&1; then
  PNUM="$(gh project create --owner "$OWNER" --title "$PROJECT_TITLE" --format json --jq .number)"
  echo "    Created project #$PNUM ($PROJECT_TITLE)"
  # Add every repo issue to the project
  gh issue list --repo "$OWNER/$REPO" --limit 100 --json url --jq '.[].url' | while read -r url; do
    gh project item-add "$PNUM" --owner "$OWNER" --url "$url" >/dev/null && echo "    linked $url"
  done
  echo "    Open the project, switch to Board view, group by Status. Set WIP limit on 'In Progress'."
else
  echo "    SKIPPED — run 'gh auth refresh -s project' first, then re-run this script (repo/issues already exist, it'll skip them)."
fi

echo "==> Done. Repo: https://github.com/$OWNER/$REPO/issues"
