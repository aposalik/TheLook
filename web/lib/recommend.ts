// Deterministic outfit constructor. Fixed catalog pairs use the offline CLIP/Polyvore
// matrix; uploaded wardrobe items use Gemini-generated metadata and explicit style rules.
import catalogData from "../data/catalog.json";
import matrixData from "../data/compat_matrix.json";

export type Item = {
  id: string;
  slot: string;
  slots?: string[];
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
  gender?: "men" | "women";
};

export type StylePreferences = {
  occasion?: "any" | "casual" | "work" | "evening";
  goal?: "balanced" | "define-waist" | "vertical-line" | "shoulder-structure";
  gender?: "all" | "men" | "women";
};

export type OutfitScoreBreakdown = {
  compatibility: number;
  palette: number;
  silhouette: number;
  formality: number;
  style: number;
  footwear: number;
  preference: number;
  total: number;
};

export type OutfitArchetype =
  | "safe-casual"
  | "relaxed-layered"
  | "polished-smart"
  | "utility-street"
  | "soft-casual"
  | "structured-autumn"
  | "statement-top"
  | "statement-bottom"
  | "dress";

export type SelectionMode = "safe" | "balanced" | "expressive" | "alternate";

export type Look = {
  formula: string;
  archetype: OutfitArchetype;
  selectionMode: SelectionMode;
  items: Item[];
  roles: string[];
  score: number;
  cohesion: number;
  scoreBreakdown: OutfitScoreBreakdown;
  reason: string;
  deterministicReason?: string;
  aiReason?: string;
  stylistTitle?: string;
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

function hasSlot(item: Item, s: string): boolean {
  return item.slot === s || (Array.isArray(item.slots) && item.slots.includes(s));
}

function isUpperItem(item: Item): boolean {
  return (
    item.category === "upper" ||
    hasSlot(item, "innerwear") ||
    hasSlot(item, "top") ||
    hasSlot(item, "outerwear")
  );
}

function compatibility(a: Item, b: Item): number {
  if (a.id === b.id) return 1;
  const aIsUpper = isUpperItem(a);
  const bIsUpper = isUpperItem(b);
  if (aIsUpper && bIsUpper) {
    // Two uppers layered together (e.g. innerwear/base + mid/top or base + outer).
    // The Polyvore matrix was trained only on single-piece tops vs bottoms,
    // so raw matrix lookup yields artificially low scores (~0.35).
    // For layering, evaluate style & color synergy plus layering harmony.
    const meta = metadataCompat(a, b);
    const layerSynergy = a.layer && b.layer && a.layer !== b.layer ? 0.15 : 0.1;
    return Math.min(1, Math.max(0.65, meta + layerSynergy));
  }
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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function compatibilityScore(items: Item[]): number {
  let weighted = 0, weightTotal = 0, weakest = 1, pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const c = compatibility(items[i]!, items[j]!);
      const w = pairWeight(items[i]!, items[j]!);
      weighted += c * w; weightTotal += w; weakest = Math.min(weakest, c); pairs++;
    }
  }
  const mean = weightTotal ? weighted / weightTotal : 0;
  return clamp01(pairs ? 0.72 * mean + 0.28 * weakest : 0);
}

function paletteScore(items: Item[]): number {
  const accents = items.filter((item) => item.color_role === "accent").length;
  const accentBalance = accents === 1 ? 1 : accents === 0 ? 0.86 : accents === 2 ? 0.5 : 0.2;
  const neutralRatio = items.filter((item) => item.palette === "neutral" || item.color_role === "neutral").length / Math.max(1, items.length);
  const neutralAnchor = neutralRatio >= 0.5 ? 1 : neutralRatio > 0 ? 0.72 : 0.45;
  return clamp01(0.72 * accentBalance + 0.28 * neutralAnchor);
}

function silhouetteScore(items: Item[]): number {
  const upper = items.find((item) => isUpperItem(item) && item.layer !== "outer");
  const bottom = items.find((item) => item.category === "bottom" || hasSlot(item, "bottom"));
  if (!upper || !bottom) return 0.82;
  const upperFit = upper.fit ?? "regular";
  const bottomFit = bottom.fit ?? "regular";
  if (upperFit === "fitted" && (bottomFit === "relaxed" || bottomFit === "baggy")) return 0.96;
  if (upperFit === "baggy" && bottomFit === "baggy") return 0.72;
  if (upperFit === bottomFit) return upperFit === "regular" ? 0.92 : 0.86;
  return 0.88;
}

function formalityScore(items: Item[], prefs: StylePreferences): number {
  const values = items.map((item) => item.formality).filter((value): value is number => typeof value === "number");
  if (!values.length) return 0.65;
  const range = Math.max(...values) - Math.min(...values);
  const consistency = range === 0 ? 1 : range === 1 ? 0.9 : range === 2 ? 0.62 : 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  let occasionFit = 0.8;
  if (prefs.occasion === "casual") occasionFit = average <= 2.5 ? 1 : average <= 3 ? 0.7 : 0.35;
  if (prefs.occasion === "work") occasionFit = average >= 2 && average <= 4 ? 1 : 0.45;
  if (prefs.occasion === "evening") occasionFit = average >= 3 ? 1 : average >= 2 ? 0.65 : 0.35;
  return clamp01(0.62 * consistency + 0.38 * occasionFit);
}

function styleScore(items: Item[]): number {
  const tagged = items.filter((item) => item.styles?.length);
  if (tagged.length < 2) return 0.65;
  let overlapTotal = 0, pairs = 0;
  for (let i = 0; i < tagged.length; i++) {
    for (let j = i + 1; j < tagged.length; j++) {
      const a = new Set(tagged[i]!.styles);
      const b = new Set(tagged[j]!.styles);
      const intersection = [...a].filter((tag) => b.has(tag)).length;
      const union = new Set([...a, ...b]).size;
      overlapTotal += union ? intersection / union : 0;
      pairs++;
    }
  }
  return clamp01(0.55 + 0.45 * (pairs ? overlapTotal / pairs : 0));
}

function footwearScore(items: Item[]): number {
  const shoe = items.find((item) => item.category === "shoe" || hasSlot(item, "shoe"));
  if (!shoe) return 0.68;
  const core = items.filter((item) => item.id !== shoe.id && item.category !== "accessory");
  const formalities = core.map((item) => item.formality).filter((value): value is number => typeof value === "number");
  const coreFormality = formalities.length ? formalities.reduce((sum, value) => sum + value, 0) / formalities.length : 2;
  const gap = Math.abs((shoe.formality ?? 2) - coreFormality);
  const formalityFit = gap <= 0.5 ? 1 : gap <= 1 ? 0.9 : gap <= 2 ? 0.58 : 0.2;
  const coreStyles = new Set(core.flatMap((item) => item.styles ?? []));
  const styleFit = shoe.styles?.some((style) => coreStyles.has(style)) ? 1 : coreStyles.size && shoe.styles?.length ? 0.55 : 0.72;
  return clamp01(0.78 * formalityFit + 0.22 * styleFit);
}

function preferenceScore(items: Item[], prefs: StylePreferences): number {
  if (!prefs.goal || prefs.goal === "balanced") return 0.86;
  if (prefs.goal === "vertical-line") return items.some((item) => item.layer === "mid" || item.layer === "outer") ? 1 : 0.5;
  if (prefs.goal === "shoulder-structure") {
    return items.some((item) => item.layer === "outer" || /blazer|jacket/i.test(item.subcategory ?? item.title)) ? 1 : 0.5;
  }
  if (prefs.goal === "define-waist") {
    return items.some((item) => /fitted|belt|cinch/i.test(`${item.fit} ${item.description}`)) ? 1 : 0.5;
  }
  return 0.75;
}

export function scoreOutfit(items: Item[], prefs: StylePreferences): OutfitScoreBreakdown {
  const compatibility = compatibilityScore(items);
  const palette = paletteScore(items);
  const silhouette = silhouetteScore(items);
  const formality = formalityScore(items, prefs);
  const style = styleScore(items);
  const footwear = footwearScore(items);
  const preference = preferenceScore(items, prefs);
  const total = clamp01(
    0.28 * compatibility +
    0.16 * palette +
    0.14 * silhouette +
    0.16 * formality +
    0.10 * style +
    0.10 * footwear +
    0.06 * preference,
  );
  return { compatibility, palette, silhouette, formality, style, footwear, preference, total };
}

function inferArchetype(formula: string, items: Item[], prefs: StylePreferences): OutfitArchetype {
  const upper = items.find((item) => isUpperItem(item) && item.layer !== "outer");
  const bottom = items.find((item) => item.category === "bottom" || hasSlot(item, "bottom"));
  const outer = items.find((item) => item.layer === "outer");
  const styles = new Set(items.flatMap((item) => item.styles ?? []));
  const formalities = items.map((item) => item.formality).filter((value): value is number => typeof value === "number");
  const averageFormality = formalities.length ? formalities.reduce((sum, value) => sum + value, 0) / formalities.length : 2;

  if (formula === "Dress") return "dress";
  if (formula === "With layer") {
    if (outer?.styles?.some((style) => style === "smart-casual" || style === "preppy") || averageFormality >= 2.5) return "structured-autumn";
    return "relaxed-layered";
  }
  if (formula === "Layered") return styles.has("utility") || styles.has("streetwear") ? "utility-street" : "relaxed-layered";
  if (upper?.color_role === "accent" || /graphic|stripe|check|plaid/i.test(`${upper?.subcategory} ${upper?.title}`)) return "statement-top";
  if (bottom?.color_role === "accent") return "statement-bottom";
  if (styles.has("utility") || styles.has("streetwear") || styles.has("sporty")) return "utility-street";
  if (prefs.occasion === "work" || prefs.occasion === "evening" || averageFormality >= 2.7) return "polished-smart";
  if (upper?.fit === "fitted" && (bottom?.fit === "relaxed" || bottom?.fit === "baggy")) return "soft-casual";
  return "safe-casual";
}

function occasionStrategyBonus(archetype: OutfitArchetype, occasion: StylePreferences["occasion"]): number {
  if (occasion === "work") return archetype === "polished-smart" || archetype === "structured-autumn" ? 0.06 : archetype === "statement-top" ? 0.015 : 0;
  if (occasion === "evening") return archetype === "dress" ? 0.08 : archetype === "polished-smart" ? 0.06 : archetype === "structured-autumn" ? 0.035 : 0;
  if (occasion === "casual") {
    return archetype === "safe-casual" || archetype === "relaxed-layered" ? 0.05 : archetype === "utility-street" || archetype === "soft-casual" ? 0.04 : 0;
  }
  return 0;
}

function lookDistance(a: Look, b: Look, anchorIds: Set<string>): number {
  const aIds = new Set(a.items.filter((item) => !anchorIds.has(item.id)).map((item) => item.id));
  const bIds = new Set(b.items.filter((item) => !anchorIds.has(item.id)).map((item) => item.id));
  const intersection = [...aIds].filter((id) => bIds.has(id)).length;
  const union = new Set([...aIds, ...bIds]).size;
  const itemDistance = union ? 1 - intersection / union : 0;
  return clamp01(0.45 * itemDistance + 0.35 * Number(a.archetype !== b.archetype) + 0.20 * Number(a.formula !== b.formula));
}

function chooseDistinctCandidate(
  candidates: Look[],
  chosen: Look[],
  anchorIds: Set<string>,
  rank: (look: Look) => number,
): Look | undefined {
  const remaining = candidates.filter((look) => !chosen.includes(look));
  if (!remaining.length) return undefined;
  const unseenArchetypes = remaining.filter((look) => !chosen.some((picked) => picked.archetype === look.archetype));
  const pool = unseenArchetypes.length ? unseenArchetypes : remaining;
  return [...pool].sort((a, b) => {
    const diversityA = chosen.length ? Math.min(...chosen.map((picked) => lookDistance(a, picked, anchorIds))) : 0;
    const diversityB = chosen.length ? Math.min(...chosen.map((picked) => lookDistance(b, picked, anchorIds))) : 0;
    return (rank(b) + 0.22 * diversityB) - (rank(a) + 0.22 * diversityA);
  })[0];
}

function cartesian(pools: Item[][]): Item[][] {
  return pools.reduce<Item[][]>((acc, pool) => acc.flatMap((previous) => pool.map((item) => [...previous, item])), [[]]);
}

type CandidateValidation = { valid: boolean; violations: string[] };

export function validateOutfitCandidate(formula: string, items: Item[], roles: string[]): CandidateValidation {
  const violations: string[] = [];
  if (items.length !== roles.length) violations.push("role-item-count-mismatch");
  if (new Set(items.map((item) => item.id)).size !== items.length) violations.push("duplicate-item");

  const roleItems = new Map(roles.map((role, index) => [role, items[index]]));
  const bottoms = items.filter((item) => item.category === "bottom" || hasSlot(item, "bottom"));
  const dresses = items.filter((item) => item.category === "dress" || hasSlot(item, "dress"));
  const shoes = items.filter((item) => item.category === "shoe" || hasSlot(item, "shoe"));
  if (dresses.length ? bottoms.length > 0 || dresses.length !== 1 : bottoms.length !== 1) violations.push("invalid-outfit-core");
  if (shoes.length > 1) violations.push("multiple-shoes");

  const explicitGenders = new Set(items.map((item) => item.gender).filter(Boolean));
  if (explicitGenders.size > 1) violations.push("mixed-gender-catalog-items");

  const formalities = items.map((item) => item.formality).filter((value): value is number => typeof value === "number");
  if (formalities.length && Math.max(...formalities) - Math.min(...formalities) >= 3) violations.push("extreme-formality-gap");

  const base = roleItems.get("base");
  const overshirt = roleItems.get("overshirt");
  const outer = roleItems.get("outer");
  const simpleTop = roleItems.get("top");
  if (formula === "Layered" && (base?.layer === "mid" || base?.layer === "outer")) violations.push("invalid-base-layer");
  if (formula === "Layered" && overshirt?.layer !== "mid") violations.push("invalid-mid-layer");
  if (formula === "With layer" && outer?.layer !== "outer") violations.push("invalid-outer-layer");
  if (formula === "Simple" && (simpleTop?.layer === "mid" || simpleTop?.layer === "outer")) violations.push("layer-piece-used-as-solo-top");

  return { valid: violations.length === 0, violations };
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

export type RecommendOptions = {
  extraItems?: Item[];
  preferences?: StylePreferences;
  candidateLimit?: number;
  catalogItems?: Item[];
};

export function recommend(
  anchors?: string | string[],
  k = 3,
  options: RecommendOptions = {},
): Look[] {
  const prefs = options.preferences ?? {};
  const baseItems = options.catalogItems ?? FIXED;
  const pool = [...baseItems, ...(options.extraItems ?? []).filter((item, index, values) => values.findIndex((v) => v.id === item.id) === index)];
  const all = prefs.gender && prefs.gender !== "all"
    ? pool.filter((i) => !i.gender || i.gender === prefs.gender)
    : pool;
  const uppers = all.filter((i) => isUpperItem(i));
  const bottoms = all.filter((i) => i.category === "bottom" || hasSlot(i, "bottom"));
  const shoes = all.filter((i) => i.category === "shoe" || hasSlot(i, "shoe"));
  const accessories = all.filter((i) => i.category === "accessory" || hasSlot(i, "accessory"));
  const dresses = all.filter((i) => i.category === "dress" || hasSlot(i, "dress"));
  const bases = uppers.filter((i) => i.layer === "base" || hasSlot(i, "innerwear") || (!i.layer && hasSlot(i, "top")));
  const mids = uppers.filter((i) => i.layer === "mid");
  const outers = uppers.filter((i) => i.layer === "outer");
  const solo = uppers.filter((i) => i.layer !== "mid" && i.layer !== "outer" && (hasSlot(i, "top") || !hasSlot(i, "innerwear")));
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
      const roles = formula.slots.map((slot) => slot.role);
      if (!validateOutfitCandidate(formula.name, combo, roles).valid) continue;
      const scoreBreakdown = scoreOutfit(combo, prefs);
      const score = scoreBreakdown.total;
      const cohesion = scoreBreakdown.compatibility;
      const reason = buildReason(formula.name, combo, roles, prefs);
      const archetype = inferArchetype(formula.name, combo, prefs);
      built.push({ formula: formula.name, archetype, selectionMode: "alternate", items: combo, roles, score, cohesion, scoreBreakdown, reason, deterministicReason: reason });
    }
  }

  const included = (look: Look) => coreAnchors.filter((id) => look.items.some((item) => item.id === id)).length;
  const eligible = coreAnchors.length ? built.filter((look) => included(look) === coreAnchors.length) : built;
  const anchorSet = new Set(ids);
  const signature = (look: Look) => look.items.filter((item) => !anchorSet.has(item.id)).map((item) => item.id).sort().join("|");
  const uniqueEligible = [...eligible]
    .sort((a, b) => b.score - a.score)
    .filter((look, index, values) => values.findIndex((candidate) => signature(candidate) === signature(look)) === index);
  const candidateCount = Math.max(k, options.candidateLimit ?? k);
  const chosen: Look[] = [];
  const strategyRank = (look: Look) => look.score + occasionStrategyBonus(look.archetype, prefs.occasion);

  if (candidateCount === 1) {
    const balanced = [...uniqueEligible].sort((a, b) => strategyRank(b) - strategyRank(a))[0];
    if (balanced) { balanced.selectionMode = "balanced"; chosen.push(balanced); }
  } else {
    const conservativeArchetypes = new Set<OutfitArchetype>(["safe-casual", "soft-casual", "polished-smart", "dress"]);
    const conservative = uniqueEligible.filter((look) => conservativeArchetypes.has(look.archetype));
    const safePool = conservative.length ? conservative : uniqueEligible;
    const safe = chooseDistinctCandidate(safePool, chosen, anchorSet, (look) => {
      const stability = Math.min(look.scoreBreakdown.palette, look.scoreBreakdown.formality, look.scoreBreakdown.footwear);
      return strategyRank(look) + 0.14 * stability;
    });
    if (safe) { safe.selectionMode = "safe"; chosen.push(safe); }

    const balanced = chooseDistinctCandidate(uniqueEligible, chosen, anchorSet, strategyRank);
    if (balanced) { balanced.selectionMode = "balanced"; chosen.push(balanced); }

    if (candidateCount >= 3) {
      const expressive = chooseDistinctCandidate(uniqueEligible, chosen, anchorSet, (look) => {
        const accents = look.items.filter((item) => item.color_role === "accent").length;
        const archetypeSignal = look.archetype === "statement-top" || look.archetype === "statement-bottom" || look.archetype === "utility-street" ? 0.12 : 0;
        const layerSignal = look.formula === "Layered" || look.formula === "With layer" ? 0.06 : 0;
        return strategyRank(look) + archetypeSignal + layerSignal + Math.min(0.08, accents * 0.04);
      });
      if (expressive) { expressive.selectionMode = "expressive"; chosen.push(expressive); }
    }
  }

  while (chosen.length < candidateCount) {
    const alternate = chooseDistinctCandidate(uniqueEligible, chosen, anchorSet, strategyRank);
    if (!alternate) break;
    alternate.selectionMode = "alternate";
    chosen.push(alternate);
  }

  for (const look of chosen) {
    for (const id of accessoryAnchors) {
      const item = accessories.find((accessory) => accessory.id === id);
      if (item && !look.items.some((i) => i.id === id)) { look.items.push(item); look.roles.push("accessory"); }
    }
    // Only auto-attach an accessory if user explicitly anchored an accessory OR if occasion is evening/work and there is a high-affinity match (>0.6)
    if (!look.items.some((i) => accessoriesById.has(i.id)) && (accessoryAnchors.length > 0 || prefs.occasion === "evening" || prefs.occasion === "work")) {
      const item = bestAccessory(look.items, accessories);
      if (item) {
        const avgScore = look.items.reduce((sum, it) => sum + compatibility(it, item), 0) / Math.max(1, look.items.length);
        if (avgScore >= 0.55) {
          look.items.push(item);
          look.roles.push("accessory");
        }
      }
    }
  }
  return chosen.slice(0, candidateCount);
}
