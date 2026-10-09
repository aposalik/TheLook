// Deterministic outfit constructor. Fixed catalog pairs use the offline CLIP/Polyvore
// matrix; uploaded wardrobe items use Gemini-generated metadata and explicit style rules.
import catalogData from "@/data/catalog.json";
import matrixData from "@/data/compat_matrix.json";

export type Item = {
  id: string;
  slot: string;
  title: string;
  color: string;
  palette: string;
  image: string;
  category?: string;
  layer?: string | null;
  formality?: number;
  fit?: string;
  color_role?: string;
  subcategory?: string;
  seasons?: string[];
  styles?: string[];
  material?: string;
  description?: string;
  source?: "catalog" | "user";
};

export type StylePreferences = {
  occasion?: "any" | "casual" | "work" | "evening";
  goal?: "balanced" | "define-waist" | "vertical-line" | "shoulder-structure";
};

export type Look = {
  formula: string;
  items: Item[];
  roles: string[];
  score: number;
  cohesion: number;
  reason: string;
  deterministicReason?: string;
  aiReason?: string;
};

const FIXED = catalogData as Item[];
const M = matrixData as Record<string, Record<string, number>>;
export function getCatalog(): Item[] { return FIXED; }

const CVALS = Object.values(M).flatMap((row) => Object.values(row)).sort((a, b) => a - b);
const pctl = (p: number) => CVALS.length ? CVALS[Math.min(CVALS.length - 1, Math.max(0, Math.round(p * (CVALS.length - 1))))]! : 0;
const CLO = pctl(0.05), CHI = pctl(0.95);
const normC = (c: number) => CHI > CLO ? Math.max(0, Math.min(1, (c - CLO) / (CHI - CLO))) : c;

function rgb(hex: string): [number, number, number] | null {
  const m = String(hex).match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function metadataCompat(a: Item, b: Item): number {
  let score = 0.55;
  const ar = rgb(a.color), br = rgb(b.color);
  if (ar && br) {
    const distance = Math.sqrt(ar.reduce((sum, value, i) => sum + (value - br[i]!) ** 2, 0)) / 441.67;
    const bothAccent = a.color_role === "accent" && b.color_role === "accent";
    score += bothAccent ? (distance > 0.3 ? -0.1 : -0.18) : 0.12 * (1 - Math.abs(distance - 0.42));
  }
  if (a.palette === "neutral" || b.palette === "neutral" || a.palette === b.palette) score += 0.08;
  const formalityGap = Math.abs((a.formality ?? 2) - (b.formality ?? 2));
  score += formalityGap <= 1 ? 0.1 : formalityGap >= 3 ? -0.14 : 0;
  if (a.fit === "baggy" && b.fit === "baggy") score -= 0.08;
  const seasonsA = new Set(a.seasons ?? []);
  if (seasonsA.size && (b.seasons ?? []).some((s) => seasonsA.has(s) || s === "all-season")) score += 0.06;
  const stylesA = new Set(a.styles ?? []);
  if (stylesA.size && (b.styles ?? []).some((s) => stylesA.has(s))) score += 0.08;
  return Math.max(0, Math.min(1, score));
}

function compatibility(a: Item, b: Item): number {
  if (a.id === b.id) return 1;
  const fixed = M[a.id]?.[b.id] ?? M[b.id]?.[a.id];
  return typeof fixed === "number" ? normC(fixed) : metadataCompat(a, b);
}

function pairWeight(a: Item, b: Item): number {
  const key = [a.category ?? a.slot, b.category ?? b.slot].sort().join("|");
  if (key === "bottom|upper") return 2;
  if (key === "bottom|shoe") return 1.5;
  if (key === "accessory|upper") return 0.65;
  return 1;
}

function prefBonus(items: Item[], prefs: StylePreferences): number {
  let bonus = 0;
  const formality = items.map((i) => i.formality ?? 2);
  const avg = formality.reduce((a, b) => a + b, 0) / Math.max(1, formality.length);
  if (prefs.occasion === "casual") bonus += avg <= 2.5 ? 0.08 : -0.05;
  if (prefs.occasion === "work") bonus += avg >= 2 && avg <= 4 ? 0.08 : -0.05;
  if (prefs.occasion === "evening") bonus += avg >= 3 ? 0.08 : -0.04;
  if (prefs.goal === "vertical-line") bonus += items.some((i) => i.layer === "mid" || i.layer === "outer") ? 0.06 : 0;
  if (prefs.goal === "shoulder-structure") bonus += items.some((i) => i.layer === "outer" || /blazer|jacket/i.test(i.subcategory ?? i.title)) ? 0.07 : 0;
  if (prefs.goal === "define-waist") bonus += items.some((i) => /fitted|belt|cinch/i.test(`${i.fit} ${i.description}`)) ? 0.07 : 0;
  return bonus;
}

function scoreOutfit(items: Item[], prefs: StylePreferences): { score: number; cohesion: number } {
  let weighted = 0, weightTotal = 0, weakest = 1, pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const c = compatibility(items[i]!, items[j]!);
      const w = pairWeight(items[i]!, items[j]!);
      weighted += c * w; weightTotal += w; weakest = Math.min(weakest, c); pairs++;
    }
  }
  const mean = weightTotal ? weighted / weightTotal : 0;
  const cohesion = pairs ? 0.72 * mean + 0.28 * weakest : 0;
  let score = cohesion;
  const accents = items.filter((i) => i.color_role === "accent").length;
  score += accents <= 1 ? 0.05 : -0.12;
  const fs = items.map((i) => i.formality).filter((x): x is number => typeof x === "number");
  const range = fs.length ? Math.max(...fs) - Math.min(...fs) : 0;
  score += range <= 1 ? 0.05 : range >= 3 ? -0.1 : 0;
  score += items.filter((i) => i.fit === "baggy").length >= 2 ? -0.06 : 0.03;
  score += prefBonus(items, prefs);
  return { score, cohesion };
}

function cartesian(pools: Item[][]): Item[][] {
  return pools.reduce<Item[][]>((acc, pool) => acc.flatMap((previous) => pool.map((item) => [...previous, item])), [[]]);
}

function buildReason(formula: string, items: Item[], roles: string[], prefs: StylePreferences): string {
  const name = (role: string) => items[roles.indexOf(role)]?.title ?? "";
  const core = formula === "Layered"
    ? `${name("base")} with ${name("overshirt")} layered over it, ${name("bottom")}`
    : formula === "With layer"
      ? `${name("base")} under ${name("outer")}, ${name("bottom")}`
      : formula === "Dress"
        ? `${name("dress")} with ${name("shoes")}`
        : `${name("top")} with ${name("bottom")}`;
  const why: string[] = [];
  if (items.filter((i) => i.color_role === "accent").length <= 1) why.push("controlled color balance");
  const fs = items.map((i) => i.formality ?? 2);
  if (Math.max(...fs) - Math.min(...fs) <= 1) why.push("consistent formality");
  if (prefs.occasion && prefs.occasion !== "any") why.push(`suited to ${prefs.occasion}`);
  if (prefs.goal && prefs.goal !== "balanced") why.push(`supports your ${prefs.goal.replaceAll("-", " ")} goal`);
  return `${core}. ${why.join(", ") || "The proportions and palette work together"}.`;
}

function bestAccessory(items: Item[], accessories: Item[]): Item | null {
  let best: Item | null = null, bestScore = -1;
  for (const accessory of accessories) {
    const score = items.reduce((sum, item) => sum + compatibility(item, accessory), 0) / Math.max(1, items.length);
    if (score > bestScore) { best = accessory; bestScore = score; }
  }
  return best;
}

export function recommend(
  anchors?: string | string[],
  k = 3,
  options: { extraItems?: Item[]; preferences?: StylePreferences; candidateLimit?: number } = {},
): Look[] {
  const prefs = options.preferences ?? {};
  const all = [...FIXED, ...(options.extraItems ?? []).filter((item, index, values) => values.findIndex((v) => v.id === item.id) === index)];
  const uppers = all.filter((i) => i.category === "upper" || i.slot === "top" || i.slot === "outerwear");
  const bottoms = all.filter((i) => i.category === "bottom" || i.slot === "bottom");
  const shoes = all.filter((i) => i.category === "shoe" || i.slot === "shoe");
  const accessories = all.filter((i) => i.category === "accessory" || i.slot === "accessory");
  const dresses = all.filter((i) => i.category === "dress" || i.slot === "dress");
  const bases = uppers.filter((i) => (i.layer ?? "base") === "base");
  const mids = uppers.filter((i) => i.layer === "mid");
  const outers = uppers.filter((i) => i.layer === "outer");
  const solo = uppers.filter((i) => i.layer !== "outer");
  const shoeSlot = shoes.length ? [{ role: "shoes", pool: shoes }] : [];
  const formulas = [
    ...(bases.length && mids.length && bottoms.length ? [{ name: "Layered", slots: [{ role: "base", pool: bases }, { role: "overshirt", pool: mids }, { role: "bottom", pool: bottoms }, ...shoeSlot] }] : []),
    ...(solo.length && bottoms.length ? [{ name: "Simple", slots: [{ role: "top", pool: solo }, { role: "bottom", pool: bottoms }, ...shoeSlot] }] : []),
    ...(bases.length && outers.length && bottoms.length ? [{ name: "With layer", slots: [{ role: "base", pool: [...bases, ...mids] }, { role: "outer", pool: outers }, { role: "bottom", pool: bottoms }, ...shoeSlot] }] : []),
    ...(dresses.length ? [{ name: "Dress", slots: [{ role: "dress", pool: dresses }, ...shoeSlot] }] : []),
  ];

  const ids = (Array.isArray(anchors) ? anchors : anchors ? [anchors] : []).filter(Boolean);
  const accessoriesById = new Set(accessories.map((a) => a.id));
  const accessoryAnchors = ids.filter((id) => accessoriesById.has(id));
  const coreAnchors = ids.filter((id) => !accessoriesById.has(id));
  const built: Look[] = [];
  for (const formula of formulas) {
    for (const combo of cartesian(formula.slots.map((slot) => slot.pool))) {
      if (new Set(combo.map((i) => i.id)).size !== combo.length) continue;
      const roles = formula.slots.map((slot) => slot.role);
      const { score, cohesion } = scoreOutfit(combo, prefs);
      const reason = buildReason(formula.name, combo, roles, prefs);
      built.push({ formula: formula.name, items: combo, roles, score, cohesion, reason, deterministicReason: reason });
    }
  }

  const included = (look: Look) => coreAnchors.filter((id) => look.items.some((item) => item.id === id)).length;
  const maxIncluded = coreAnchors.length ? Math.max(0, ...built.map(included)) : 0;
  const eligible = coreAnchors.length ? built.filter((look) => included(look) === maxIncluded) : built;
  eligible.sort((a, b) => b.score - a.score);

  const anchorSet = new Set(ids);
  const signature = (look: Look) => look.items.filter((i) => !anchorSet.has(i.id)).map((i) => i.id).sort().join("|");
  const candidateCount = Math.max(k, options.candidateLimit ?? k);
  const chosen: Look[] = [];
  const seen = new Set<string>();
  const layered = eligible.find((look) => look.formula === "Layered");
  if (layered && candidateCount > 1) { chosen.push(layered); seen.add(signature(layered)); }
  for (const look of eligible) {
    const sig = signature(look);
    if (chosen.includes(look) || seen.has(sig)) continue;
    chosen.push(look); seen.add(sig);
    if (chosen.length >= candidateCount) break;
  }
  chosen.sort((a, b) => b.score - a.score);

  for (const look of chosen) {
    for (const id of accessoryAnchors) {
      const item = accessories.find((accessory) => accessory.id === id);
      if (item && !look.items.some((i) => i.id === id)) { look.items.push(item); look.roles.push("accessory"); }
    }
    if (!look.items.some((i) => accessoriesById.has(i.id))) {
      const item = bestAccessory(look.items, accessories);
      if (item) { look.items.push(item); look.roles.push("accessory"); }
    }
  }
  return chosen.slice(0, candidateCount);
}
