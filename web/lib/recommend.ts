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

const uppers = ITEMS.filter((i) => i.category === "upper");
const bottoms = ITEMS.filter((i) => i.category === "bottom");
const bases = uppers.filter((i) => i.layer === "base");
const mids = uppers.filter((i) => i.layer === "mid");
const outers = uppers.filter((i) => i.layer === "outer");
const soloUppers = uppers.filter((i) => i.layer === "base" || i.layer === "mid");

type SlotSpec = { role: string; pool: Item[] };
type Formula = { name: string; slots: SlotSpec[] };

// 3 formulas that fit a capsule with no true tee/shoes; extend when those slots exist.
const FORMULAS: Formula[] = [
  { name: "Layered", slots: [{ role: "base", pool: bases }, { role: "overshirt", pool: mids }, { role: "bottom", pool: bottoms }] },
  { name: "Simple", slots: [{ role: "top", pool: soloUppers }, { role: "bottom", pool: bottoms }] },
  { name: "With layer", slots: [{ role: "base", pool: [...bases, ...mids] }, { role: "outer", pool: outers }, { role: "bottom", pool: bottoms }] },
];

function cartesian(pools: Item[][]): Item[][] {
  return pools.reduce<Item[][]>((acc, pool) => acc.flatMap((prev) => pool.map((it) => [...prev, it])), [[]]);
}

export type Look = { formula: string; items: Item[]; roles: string[]; score: number; cohesion: number; reason: string };

function scoreOutfit(items: Item[]): { score: number; cohesion: number } {
  const ids = items.map((i) => i.id);
  let sum = 0, n = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { sum += compat(ids[i]!, ids[j]!); n++; }
  const cohesion = n ? sum / n : 0;
  let score = cohesion;
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

/** Top-k distinct complete outfits, optionally forced to include an anchor item. */
export function recommend(anchorId?: string, k = 3): Look[] {
  const looks: Look[] = [];
  for (const f of FORMULAS) {
    for (const combo of cartesian(f.slots.map((s) => s.pool))) {
      const ids = combo.map((c) => c.id);
      if (new Set(ids).size !== ids.length) continue;          // distinct pieces
      if (anchorId && !ids.includes(anchorId)) continue;        // must include the picked item
      const roles = f.slots.map((s) => s.role);
      const { score, cohesion } = scoreOutfit(combo);
      looks.push({ formula: f.name, items: combo, roles, score, cohesion, reason: buildReason(f.name, combo, roles) });
    }
  }
  looks.sort((a, b) => b.score - a.score);

  // diversify: no two results share the same (main upper, bottom) pair
  const chosen: Look[] = [];
  const seen = new Set<string>();
  for (const L of looks) {
    const mainUpper = L.items.find((i) => i.category === "upper")?.id ?? "";
    const bottom = L.items.find((i) => i.category === "bottom")?.id ?? "";
    const sig = `${mainUpper}|${bottom}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    chosen.push(L);
    if (chosen.length >= k) break;
  }
  return chosen;
}
