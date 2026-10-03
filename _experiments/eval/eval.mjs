// Recommender evaluation harness.
// Snapshots the CURRENT top-3 for a fixed anchor set + computes objective proxy
// metrics, so every future scorer change can be measured instead of guessed.
//
// Usage: node _experiments/eval/eval.mjs   (dev server must be running on :3000)
// Writes: baseline.json (full dump) + REPORT.md (human-readable + rating blanks)
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "web", "data");
const catalog = JSON.parse(readFileSync(join(DATA, "catalog.json"), "utf8"));
const M = JSON.parse(readFileSync(join(DATA, "compat_matrix.json"), "utf8"));
const title = (id) => catalog.find((c) => c.id === id)?.title ?? id;
const isAcc = (id) => { const i = catalog.find((c) => c.id === id); return i?.category === "accessory" || i?.slot === "accessory"; };

// same compatibility lookup the recommender uses
const compat = (a, b) => (a === b ? 1 : (M[a]?.[b] ?? M[b]?.[a] ?? 0.3));

// Fixed anchor set: every item as a single pick + representative pairs + 1 conflict.
const ANCHORS = [
  ["top_shirt-blue"], ["top_shirt-gray"], ["top_polo-cream"], ["top_sweater-navy"], ["top_vest-brown"],
  ["outerwear_cardigan-brown"],
  ["bottom_trousers-brown"], ["bottom_jeans-lightblue"], ["bottom_corduroy-gray"], ["bottom_baggy-jeans"],
  ["shoe_sneakers-red"], ["accessory_sunglasses-brown"],
  ["top_shirt-blue", "bottom_baggy-jeans"],
  ["top_polo-cream", "bottom_trousers-brown"],
  ["top_vest-brown", "bottom_corduroy-gray"],
  ["top_sweater-navy", "shoe_sneakers-red"],
  ["bottom_trousers-brown", "bottom_baggy-jeans"],   // conflict: two bottoms
];

// metrics over one look
function lookMetrics(look) {
  const worn = look.items.filter((it) => !isAcc(it.id)).map((it) => it.id); // rendered pieces
  let min = 1, sum = 0, n = 0;
  for (let i = 0; i < worn.length; i++)
    for (let j = i + 1; j < worn.length; j++) {
      const c = compat(worn[i], worn[j]);
      min = Math.min(min, c); sum += c; n++;
    }
  return { meanPair: n ? sum / n : 0, minPair: n ? min : 0, formula: look.formula };
}

// diversity across the 3 looks = 1 - average Jaccard overlap of item sets
function diversity(looks) {
  const sets = looks.map((L) => new Set(L.items.map((i) => i.id)));
  let sum = 0, n = 0;
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i], b = sets[j];
      const inter = [...a].filter((x) => b.has(x)).length;
      const uni = new Set([...a, ...b]).size;
      sum += inter / uni; n++;
    }
  return n ? 1 - sum / n : 0;
}

const out = [];
for (const anchors of ANCHORS) {
  const r = await fetch(`http://localhost:3000/api/recommend?anchors=${encodeURIComponent(anchors.join(","))}`);
  const j = await r.json();
  const looks = j.looks ?? [];
  out.push({
    anchors,
    diversity: diversity(looks),
    formulaVariety: new Set(looks.map((L) => L.formula)).size,
    looks: looks.map((L) => ({ ...lookMetrics(L), itemIds: L.items.map((i) => i.id), reason: L.reason, cohesion: L.cohesion })),
  });
}

// aggregates
const allLooks = out.flatMap((a) => a.looks);
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const agg = {
  anchors: out.length,
  avgCohesion: avg(allLooks.map((l) => l.cohesion)),
  avgMeanPair: avg(allLooks.map((l) => l.meanPair)),
  avgMinPair: avg(allLooks.map((l) => l.minPair)),
  weakLookShare: allLooks.filter((l) => l.minPair < 0.30).length / allLooks.length, // looks with a clashing pair
  avgDiversity: avg(out.map((a) => a.diversity)),
  avgFormulaVariety: avg(out.map((a) => a.formulaVariety)),
};

// baseline.json is the FROZEN reference (committed once). Each run writes latest.json
// and, if a baseline exists, prints a before/after diff so changes are measured.
writeFileSync(join(HERE, "latest.json"), JSON.stringify({ agg, anchors: out }, null, 2));
try {
  const base = JSON.parse(readFileSync(join(HERE, "baseline.json"), "utf8")).agg;
  console.log("\nbefore → after (baseline → this run):");
  for (const k of Object.keys(agg)) {
    if (k === "anchors") continue;
    const b = base[k], a = agg[k];
    const arrow = a > b ? "↑" : a < b ? "↓" : "=";
    console.log(`  ${k.padEnd(18)} ${(b).toFixed(3)} → ${(a).toFixed(3)}  ${arrow}`);
  }
} catch { /* no baseline yet */ }

// ---- markdown report ----
const pct = (x) => `${(x * 100).toFixed(0)}%`;
let md = `# Recommender eval — baseline\n\n`;
md += `Objective proxy metrics (higher = better, except weakLookShare).\n\n`;
md += `| metric | value | what it tells us |\n|---|---|---|\n`;
md += `| avg cohesion | ${pct(agg.avgCohesion)} | mean pairwise compat (the raw signal; note it's squeezed) |\n`;
md += `| avg **min-pair** | ${pct(agg.avgMinPair)} | the *weakest* pair per look — the "one bad piece" the mean hides |\n`;
md += `| **weak-look share** | ${pct(agg.weakLookShare)} | looks containing a pair below 30% compat (a visible clash) |\n`;
md += `| avg diversity | ${pct(agg.avgDiversity)} | how different the 3 looks are (1 − item overlap) |\n`;
md += `| avg formula variety | ${agg.avgFormulaVariety.toFixed(2)} / 3 | distinct formulas among the 3 looks |\n\n`;
md += `_Rate each look 1–5 (fill the blanks), then re-run after a change and compare._\n\n`;

for (const a of out) {
  md += `### Anchor: ${a.anchors.map(title).join(" + ")}\n`;
  md += `diversity ${pct(a.diversity)} · formula variety ${a.formulaVariety}/3\n\n`;
  a.looks.forEach((l, i) => {
    const flag = l.minPair < 0.30 ? " ⚠️ weak pair" : "";
    md += `- **#${i + 1} [${l.formula}]** cohesion ${pct(l.cohesion)} · min-pair ${pct(l.minPair)}${flag} — rating: __\n`;
    md += `  - ${l.itemIds.map(title).join(", ")}\n`;
  });
  md += `\n`;
}
writeFileSync(join(HERE, "REPORT.md"), md);
console.log(JSON.stringify(agg, null, 2));
console.log("\nwrote latest.json + REPORT.md (baseline.json left frozen)");
