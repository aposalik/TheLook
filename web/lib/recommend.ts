// Formula-based outfit recommender. Pure data logic (no torch): reads the precomputed
// catalog + symmetrized compatibility matrix and assembles whole outfits, scored as a set.
import catalogData from "@/data/catalog.json";
import matrixData from "@/data/compat_matrix.json";

export type Item = {
  id: string; slot: string; title: string; color: string; palette: string; image: string;
  category?: string; layer?: string | null; formality?: number; fit?: string; color_role?: string;
};

const ITEMS = catalogData as Item[];
const M = matrixData as Record<string, Record<string, number>>;

export function getCatalog(): Item[] { return ITEMS; }

function compat(a: string, b: string): number {
  if (a === b) return 1;
  return M[a]?.[b] ?? M[b]?.[a] ?? 0.3;
}

// The Polyvore MLP squeezes compat into a narrow band (~0.30–0.45 on this
// catalog), so raw cohesion differences are tiny and the ±0.05 style-rule
// bonuses would silently dominate ranking. Rescale each pair against the
// catalog's own 5th–95th percentile so cohesion spans ~0–1 and the rules
// become proportional tie-breakers, not deciders.
const CVALS = Object.values(M).flatMap((row) => Object.values(row)).sort((a, b) => a - b);
const pctl = (p: number) => CVALS.length ? CVALS[Math.min(CVALS.length - 1, Math.max(0, Math.round(p * (CVALS.length - 1))))]! : 0;
const CLO = pctl(0.05), CHI = pctl(0.95);
const normC = (c: number) => (CHI > CLO ? Math.max(0, Math.min(1, (c - CLO) / (CHI - CLO))) : c);

// Not every pairing matters equally: the top↔bottom relationship is the
// backbone of an outfit, shoes-to-bottom next, the rest incidental.
function pairWeight(a: Item, b: Item): number {
  const key = [a.category ?? a.slot, b.category ?? b.slot].sort().join("|");
  if (key === "bottom|upper") return 2;
  if (key === "bottom|shoe") return 1.5;
  return 1;
}

const uppers = ITEMS.filter((i) => i.category === "upper");
const bottoms = ITEMS.filter((i) => i.category === "bottom");
const shoes = ITEMS.filter((i) => i.category === "shoe" || i.slot === "shoe");
const accessories = ITEMS.filter((i) => i.category === "accessory" || i.slot === "accessory");
const bases = uppers.filter((i) => i.layer === "base");
const mids = uppers.filter((i) => i.layer === "mid");
const outers = uppers.filter((i) => i.layer === "outer");
const soloUppers = uppers.filter((i) => i.layer === "base" || i.layer === "mid");
const isAccessory = (id: string) => accessories.some((a) => a.id === id);

type SlotSpec = { role: string; pool: Item[] };
type Formula = { name: string; slots: SlotSpec[] };

// Shoes complete every outfit, so they're a required scored slot (guarded: if the
// catalog has none, the slot is omitted rather than zeroing the cartesian product).
// Accessories are optional and appended post-scoring as enrichment cards (they can't
// be rendered by Cloth-v4 anyway), so they never constrain the core outfit.
const shoeSlot: SlotSpec[] = shoes.length ? [{ role: "shoes", pool: shoes }] : [];

const FORMULAS: Formula[] = [
  { name: "Layered", slots: [{ role: "base", pool: bases }, { role: "overshirt", pool: mids }, { role: "bottom", pool: bottoms }, ...shoeSlot] },
  { name: "Simple", slots: [{ role: "top", pool: soloUppers }, { role: "bottom", pool: bottoms }, ...shoeSlot] },
  { name: "With layer", slots: [{ role: "base", pool: [...bases, ...mids] }, { role: "outer", pool: outers }, { role: "bottom", pool: bottoms }, ...shoeSlot] },
];

function cartesian(pools: Item[][]): Item[][] {
  return pools.reduce<Item[][]>((acc, pool) => acc.flatMap((prev) => pool.map((it) => [...prev, it])), [[]]);
}

export type Look = { formula: string; items: Item[]; roles: string[]; score: number; cohesion: number; reason: string };

function scoreOutfit(items: Item[]): { score: number; cohesion: number } {
  // Rescaled, weighted pairwise compat + a weakest-pair term so one clashing
  // piece can't be averaged away (a bad pair ruins an outfit in real life).
  let wsum = 0, wtot = 0, min = 1, n = 0;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const c = normC(compat(items[i]!.id, items[j]!.id));
      const w = pairWeight(items[i]!, items[j]!);
      wsum += w * c; wtot += w; min = Math.min(min, c); n++;
    }
  const weightedMean = wtot ? wsum / wtot : 0;
  const cohesion = n ? 0.7 * weightedMean + 0.3 * min : 0;                 // 70% overall, 30% weakest link
  let score = cohesion;
  // Style rules — now proportional tie-breakers on a ~0–1 cohesion, not deciders.
  const accents = items.filter((i) => i.color_role === "accent").length;
  score += accents <= 1 ? 0.05 : -0.12;                                   // color rule: ≤1 accent
  const fs = items.map((i) => i.formality).filter((x): x is number => typeof x === "number");
  const range = fs.length ? Math.max(...fs) - Math.min(...fs) : 0;
  score += range <= 1 ? 0.05 : range >= 3 ? -0.1 : 0;                      // consistent formality
  const baggy = items.filter((i) => i.fit === "baggy").length;
  score += baggy >= 2 ? -0.06 : 0.03;                                      // avoid baggy-on-baggy
  return { score, cohesion };
}

function buildReason(f: string, items: Item[], roles: string[]): string {
  const name = (r: string) => items[roles.indexOf(r)]?.title ?? "";
  let core: string;
  if (f === "Layered") core = `${name("base")} with the ${name("overshirt")} worn open on top, ${name("bottom")}`;
  else if (f === "With layer") core = `${name("base")} under the ${name("outer")}, ${name("bottom")}`;
  else core = `${name("top")} with ${name("bottom")}`;
  const why: string[] = [];
  if (items.every((i) => i.color_role !== "accent")) why.push("an all-neutral palette");
  const fs = items.map((i) => i.formality).filter((x): x is number => typeof x === "number");
  if (fs.length && Math.max(...fs) - Math.min(...fs) <= 1) why.push("one consistent smart-casual level");
  if (items.some((i) => i.fit === "baggy") && items.some((i) => i.fit !== "baggy")) why.push("a relaxed piece balanced by a neater one");
  if (!why.length) return `${core}.`;
  const whyStr = why.join(", ");
  return `${core}. ${whyStr.charAt(0).toUpperCase()}${whyStr.slice(1)} — looks clean and intentional.`;
}

/** Best accessory for a look: the one with the highest mean compatibility to its pieces. */
function bestAccessory(items: Item[]): Item | null {
  let best: Item | null = null, bestScore = -1;
  for (const acc of accessories) {
    const mean = items.reduce((s, it) => s + compat(it.id, acc.id), 0) / items.length;
    if (mean > bestScore) { bestScore = mean; best = acc; }
  }
  return best;                                                  // low scores still show (styling suggestion)
}

/**
 * Top-k distinct complete outfits built around one OR MORE selected items.
 * Accepts a single id (back-compat) or an array of selected ids. Non-accessory
 * picks are locked into every suggestion; accessory picks are forced into the
 * enrichment slot. If the picks can't all coexist (e.g. two bottoms), we fall
 * back to suggestions that include as many of them as possible.
 */
export function recommend(anchors?: string | string[], k = 3): Look[] {
  const anchorIds = (Array.isArray(anchors) ? anchors : anchors ? [anchors] : []).filter(Boolean);
  const accessoryAnchors = anchorIds.filter(isAccessory);
  const coreAnchors = anchorIds.filter((id) => !isAccessory(id));
  const coreIncluded = (ids: string[]) => coreAnchors.filter((a) => ids.includes(a)).length;

  const built: Look[] = [];
  for (const f of FORMULAS) {
    for (const combo of cartesian(f.slots.map((s) => s.pool))) {
      const ids = combo.map((c) => c.id);
      if (new Set(ids).size !== ids.length) continue;          // distinct pieces
      const roles = f.slots.map((s) => s.role);
      const { score, cohesion } = scoreOutfit(combo);
      built.push({ formula: f.name, items: combo, roles, score, cohesion, reason: buildReason(f.name, combo, roles) });
    }
  }
  // Prefer outfits that include ALL core picks; if none can (conflicting slots),
  // relax to those including the most. With no picks, everything is eligible.
  const maxInc = coreAnchors.length ? Math.max(0, ...built.map((L) => coreIncluded(L.items.map((i) => i.id)))) : 0;
  const looks = (coreAnchors.length ? built.filter((L) => coreIncluded(L.items.map((i) => i.id)) === maxInc) : built);
  looks.sort((a, b) => b.score - a.score);

  // Selection. Two diversity rules:
  //  1) no two results share the same set of *chosen* pieces, and
  //  2) reserve one slot for the best Layered look. Layered outfits have more
  //     pieces -> more scored pairs -> a lower *average* cohesion, so without a
  //     quota they get crowded out of the top-k by 2-piece "Simple" looks even
  //     though layering is the hero capability. (Guard: only when a Layered look
  //     actually exists under the current anchor/pools, and k > 1.)
  // The signature excludes the user's pinned picks + accessories, so diversity is
  // judged on what the recommender ADDED. (Keying on (upper,bottom) collapsed to a
  // single result whenever the user pinned both an upper and a bottom.)
  const anchorSet = new Set(anchorIds);
  const sigOf = (L: Look) =>
    L.items.filter((i) => !anchorSet.has(i.id) && !isAccessory(i.id)).map((i) => i.id).sort().join("|");
  const chosen: Look[] = [];
  const seen = new Set<string>();
  const take = (L: Look) => { chosen.push(L); seen.add(sigOf(L)); };

  const bestLayered = looks.find((L) => L.formula === "Layered");   // looks is score-sorted
  if (bestLayered && k > 1) take(bestLayered);

  for (const L of looks) {
    if (chosen.includes(L) || seen.has(sigOf(L))) continue;
    take(L);
    if (chosen.length >= k) break;
  }
  chosen.sort((a, b) => b.score - a.score);                        // display in score order

  // enrich each look with accessory cards (can't be rendered, so appended after
  // scoring; don't affect cohesion). Force every picked accessory; if none were
  // picked, suggest the single best-matching one.
  if (accessories.length) {
    for (const L of chosen) {
      for (const accId of accessoryAnchors) {
        const acc = accessories.find((a) => a.id === accId);
        if (acc && !L.items.some((i) => i.id === acc.id)) { L.items.push(acc); L.roles.push("accessory"); }
      }
      if (!L.items.some((i) => isAccessory(i.id))) {
        const acc = bestAccessory(L.items);
        if (acc) { L.items.push(acc); L.roles.push("accessory"); }
      }
    }
  }
  return chosen;
}
