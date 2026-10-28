// Deterministic outfit constructor. Fixed catalog pairs use the offline CLIP/Polyvore
// matrix; uploaded wardrobe items use Gemini-generated metadata and explicit style rules.
import catalogData from "../data/catalog.json";
import matrixData from "../data/compat_matrix.json";
import { feedbackAdjustment, type OutfitFeedbackEvent } from "./outfit-feedback";
import type { StylistVerdict, SwapRole, VisualScores } from "./stylist-judge";

const GARMENT_TYPES = [
  "t-shirt", "tank", "button-up-shirt", "overshirt", "sweater", "cardigan", "hoodie",
  "bomber-jacket", "jacket", "blazer", "coat", "jeans", "trousers", "sweatpants",
  "shorts", "skirt", "dress", "sneaker", "dress-shoe", "boot", "sandal", "accessory", "other",
] as const;
const GARMENT_PATTERNS = ["solid", "stripe", "check", "graphic", "floral", "camo", "other"] as const;
const PATTERN_SCALES = ["none", "fine", "medium", "bold"] as const;
const FABRICS = ["cotton", "linen", "wool", "denim", "leather", "suede", "knit", "fleece", "synthetic", "silk", "other"] as const;
const FABRIC_WEIGHTS = ["light", "medium", "heavy"] as const;
const COLLAR_TYPES = ["none", "crew", "v-neck", "point", "camp", "polo", "turtleneck", "lapel", "hood", "zip-neck", "other"] as const;
const CLOSURES = ["none", "buttons", "zip", "pullover", "open-front", "other"] as const;
const LAYER_ROLES = ["base", "mid", "outer"] as const;
const SILHOUETTE_VOLUMES = ["low", "medium", "high"] as const;
const GARMENT_LENGTHS = ["cropped", "regular", "long"] as const;

export type GarmentSemantics = {
  garmentType?: (typeof GARMENT_TYPES)[number];
  pattern?: (typeof GARMENT_PATTERNS)[number];
  patternScale?: (typeof PATTERN_SCALES)[number];
  fabric?: (typeof FABRICS)[number];
  fabricWeight?: (typeof FABRIC_WEIGHTS)[number];
  collarType?: (typeof COLLAR_TYPES)[number];
  closure?: (typeof CLOSURES)[number];
  canWearOpen?: boolean;
  layerRole?: (typeof LAYER_ROLES)[number];
  silhouetteVolume?: (typeof SILHOUETTE_VOLUMES)[number];
  length?: (typeof GARMENT_LENGTHS)[number];
  isSubstantialLayer?: boolean;
  isLoungewear?: boolean;
};

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === "string" && allowed.includes(value) ? value as T[number] : undefined;
}

export function normalizeGarmentSemantics(value: unknown): GarmentSemantics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const normalized: GarmentSemantics = {};
  const fields = {
    garmentType: enumValue(raw.garmentType, GARMENT_TYPES),
    pattern: enumValue(raw.pattern, GARMENT_PATTERNS),
    patternScale: enumValue(raw.patternScale, PATTERN_SCALES),
    fabric: enumValue(raw.fabric, FABRICS),
    fabricWeight: enumValue(raw.fabricWeight, FABRIC_WEIGHTS),
    collarType: enumValue(raw.collarType, COLLAR_TYPES),
    closure: enumValue(raw.closure, CLOSURES),
    layerRole: enumValue(raw.layerRole, LAYER_ROLES),
    silhouetteVolume: enumValue(raw.silhouetteVolume, SILHOUETTE_VOLUMES),
    length: enumValue(raw.length, GARMENT_LENGTHS),
  };
  for (const [key, fieldValue] of Object.entries(fields)) {
    if (fieldValue !== undefined) (normalized as Record<string, unknown>)[key] = fieldValue;
  }
  for (const key of ["canWearOpen", "isSubstantialLayer", "isLoungewear"] as const) {
    if (typeof raw[key] === "boolean") normalized[key] = raw[key];
  }
  return normalized;
}

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
  semantics?: GarmentSemantics;
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
  stylistVerdict?: StylistVerdict;
  visualScores?: VisualScores;
  stylistIssues?: string[];
  preferredSwapRole?: SwapRole;
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

function isFitted(fit?: string): boolean {
  return fit === "fitted" || fit === "slim";
}

function isOversized(fit?: string): boolean {
  return fit === "baggy" || fit === "oversized";
}

function itemText(item: Item): string {
  return `${item.title ?? ""} ${item.subcategory ?? ""} ${item.description ?? ""} ${item.material ?? ""}`.toLowerCase();
}

export function inferLegacyGarmentSemantics(item: Item): GarmentSemantics {
  const text = itemText(item);
  let garmentType: GarmentSemantics["garmentType"] = "other";
  if (/sweatpant|jogger|lounge pant|track pant/.test(text)) garmentType = "sweatpants";
  else if (/\bjean|denim pant/.test(text)) garmentType = "jeans";
  else if (/trouser|chino|slack/.test(text)) garmentType = "trousers";
  else if (/\bshort/.test(text)) garmentType = "shorts";
  else if (/\bdress\b/.test(text)) garmentType = "dress";
  else if (/overshirt|shacket|chore shirt/.test(text)) garmentType = "overshirt";
  else if (/button-up|button-down|oxford|poplin|dress shirt|\bshirt\b/.test(text)) garmentType = "button-up-shirt";
  else if (/t-shirt|\btee\b/.test(text)) garmentType = "t-shirt";
  else if (/\btank\b|camisole/.test(text)) garmentType = "tank";
  else if (/cardigan/.test(text)) garmentType = "cardigan";
  else if (/hoodie/.test(text)) garmentType = "hoodie";
  else if (/sweater|jumper|knit/.test(text)) garmentType = "sweater";
  else if (/bomber/.test(text)) garmentType = "bomber-jacket";
  else if (/blazer/.test(text)) garmentType = "blazer";
  else if (/coat|trench|parka|puffer/.test(text)) garmentType = "coat";
  else if (/jacket|windbreaker/.test(text)) garmentType = "jacket";
  else if (/loafer|derby|oxford shoe|heel/.test(text)) garmentType = "dress-shoe";
  else if (/sneaker|trainer|high-top|low-top/.test(text)) garmentType = "sneaker";
  else if (/\bboot/.test(text)) garmentType = "boot";
  else if (/sandal/.test(text)) garmentType = "sandal";
  else if (item.category === "accessory") garmentType = "accessory";

  const pattern = /stripe|pinstripe|breton/.test(text) ? "stripe"
    : /check|plaid|gingham|tartan/.test(text) ? "check"
    : /graphic|logo|printed/.test(text) ? "graphic"
    : /floral/.test(text) ? "floral"
    : /camo/.test(text) ? "camo"
    : "solid";
  const fabric = /leather/.test(text) ? "leather"
    : /suede/.test(text) ? "suede"
    : /denim/.test(text) ? "denim"
    : /linen/.test(text) ? "linen"
    : /wool/.test(text) ? "wool"
    : /fleece/.test(text) ? "fleece"
    : /silk/.test(text) ? "silk"
    : /knit/.test(text) ? "knit"
    : /cotton/.test(text) ? "cotton"
    : undefined;
  const substantialType = ["overshirt", "cardigan", "bomber-jacket", "jacket", "blazer", "coat"].includes(garmentType);
  const closure = /button/.test(text) ? "buttons" : /zip/.test(text) ? "zip" : substantialType ? "open-front" : "none";
  const layerRole = item.category === "upper" && (item.layer === "base" || item.layer === "mid" || item.layer === "outer") ? item.layer : undefined;
  return normalizeGarmentSemantics({
    garmentType,
    pattern,
    patternScale: pattern === "solid" ? "none" : "medium",
    fabric,
    fabricWeight: /heavy|thick|puffer|leather|wool|fleece/.test(text) ? "heavy" : substantialType ? "medium" : "light",
    collarType: garmentType === "button-up-shirt" || garmentType === "overshirt" ? (/camp collar/.test(text) ? "camp" : "point")
      : garmentType === "blazer" || garmentType === "coat" ? "lapel"
      : garmentType === "hoodie" ? "hood"
      : garmentType === "t-shirt" || garmentType === "sweater" ? "crew"
      : "none",
    closure,
    canWearOpen: closure === "buttons" || closure === "zip" || closure === "open-front",
    layerRole,
    silhouetteVolume: item.fit === "baggy" || item.fit === "oversized" ? "high" : item.fit === "slim" ? "low" : "medium",
    length: /cropped/.test(text) ? "cropped" : /longline|long coat|maxi/.test(text) ? "long" : "regular",
    isLoungewear: garmentType === "sweatpants" || /lounge|pajama/.test(text),
    isSubstantialLayer: substantialType,
  });
}

export function isCollaredShirt(item: Item): boolean {
  if (item.semantics?.collarType) return ["point", "camp", "polo"].includes(item.semantics.collarType);
  const text = itemText(item);
  if (/t-shirt|\btee\b|sweatshirt|undershirt|tank|camisole|hoodie|sweater|cardigan|blazer|jacket|coat|bomber|parka|puffer|vest/.test(text)) {
    return false;
  }
  return /\bshirt\b|button-up|button-down|oxford|poplin|camp collar|dress shirt|polo|flannel|overshirt|shacket/.test(text);
}

export function isSubstantialLayerPiece(item: Item): boolean {
  if (typeof item.semantics?.isSubstantialLayer === "boolean") return item.semantics.isSubstantialLayer;
  if (item.semantics?.fabricWeight === "heavy") return true;
  if (["overshirt", "cardigan", "bomber-jacket", "jacket", "blazer", "coat"].includes(item.semantics?.garmentType ?? "")) return true;
  const text = itemText(item);
  if (/overshirt|shacket|cardigan|blazer|jacket|coat|bomber|puffer|parka|trench|vest|gilet|hoodie|half-zip|quarter-zip|chore|flannel|corduroy|denim|leather|suede|wool|fleece|heavy|canvas|twill/.test(text)) {
    return true;
  }
  return item.layer === "outer";
}

export function isPolishedButtonUp(item: Item): boolean {
  if (!isCollaredShirt(item)) return false;
  if (item.semantics?.garmentType === "overshirt") return false;
  if (item.semantics?.garmentType === "button-up-shirt") return (item.formality ?? 2) >= 3;
  const text = itemText(item);
  if (/overshirt|shacket|flannel|work shirt|utility|chore|camp collar|denim/.test(text)) return false;
  return /button-up|button-down|oxford|dress shirt|poplin|striped.*shirt|\bshirt\b/.test(text) || (item.formality ?? 2) >= 3;
}

export function isLoungeBottom(item: Item): boolean {
  if (typeof item.semantics?.isLoungewear === "boolean") return item.semantics.isLoungewear;
  if (item.semantics?.garmentType === "sweatpants") return true;
  const text = itemText(item);
  return /sweatpant|jogger|track pant|lounge|gym short|athletic short|fleece pant|sweatshort/.test(text);
}

export function inferPattern(item: Item): GarmentSemantics["pattern"] {
  if (item.semantics?.pattern) return item.semantics.pattern;
  const text = itemText(item);
  if (/stripe|striped|pinstripe|breton/.test(text)) return "stripe";
  if (/check|checked|plaid|gingham|tartan|houndstooth/.test(text)) return "check";
  if (/graphic|print|printed|logo|floral|camo/.test(text)) return "graphic";
  return "solid";
}

export function isClosedOuterOrMid(item: Item): boolean {
  if (typeof item.semantics?.canWearOpen === "boolean") return !item.semantics.canWearOpen;
  const text = itemText(item);
  if (/open|cardigan|overshirt|shacket|blazer|coat|trench|vest|gilet|button/.test(text)) return false;
  return /pullover|crewneck|sweater|knit|hoodie|bomber|anorak/.test(text);
}

function isBrightIsolatedAccentShoe(shoe: Item, core: Item[]): boolean {
  const text = itemText(shoe);
  const c = rgb(shoe.color);
  const isHighChromaRgb = c
    ? (Math.max(...c) - Math.min(...c)) > 85 && Math.max(...c) > 155
    : false;
  const isBrightNamed = /\bred\b|crimson|scarlet|pink|magenta|neon|orange|yellow|cobalt|bright|lime/.test(text);
  const isCasualBrightShoe = (shoe.color_role === "accent" || isBrightNamed || isHighChromaRgb) && (shoe.formality ?? 2) <= 2;
  if (!isCasualBrightShoe) return false;

  const echoedInCore = core.some((item) => {
    if (item.color_role === "accent" && item.palette === shoe.palette) return true;
    const ir = rgb(item.color);
    if (c && ir) {
      const dist = Math.sqrt(c.reduce((sum, val, idx) => sum + (val - ir[idx]!) ** 2, 0)) / 441.67;
      if (dist < 0.22) return true;
    }
    return false;
  });
  return !echoedInCore;
}

function metadataCompat(a: Item, b: Item): number {
  let score = 0.52;
  const ar = rgb(a.color), br = rgb(b.color);
  if (ar && br) {
    const distance = Math.sqrt(ar.reduce((sum, value, i) => sum + (value - br[i]!) ** 2, 0)) / 441.67;
    const bothAccent = a.color_role === "accent" && b.color_role === "accent";
    score += bothAccent ? (distance > 0.3 ? -0.12 : -0.2) : 0.1 * (1 - Math.abs(distance - 0.42));
  }
  if (a.palette === "neutral" || b.palette === "neutral" || a.palette === b.palette) score += 0.06;
  const formalityGap = Math.abs((a.formality ?? 2) - (b.formality ?? 2));
  score += formalityGap === 0 ? 0.09 : formalityGap === 1 ? 0.06 : formalityGap === 2 ? -0.06 : -0.18;
  if (isOversized(a.fit) && isOversized(b.fit)) score -= 0.1;
  const patA = inferPattern(a), patB = inferPattern(b);
  if (patA !== "solid" && patB !== "solid") score -= 0.14;
  const seasonsA = new Set(a.seasons ?? []);
  if (seasonsA.size && (b.seasons ?? []).some((s) => seasonsA.has(s) || s === "all-season")) score += 0.05;
  const stylesA = new Set(a.styles ?? []);
  if (stylesA.size && (b.styles ?? []).some((s) => stylesA.has(s))) score += 0.07;
  return Math.max(0, Math.min(1, score));
}

function hasSlot(item: Item, s: string): boolean {
  return item.slot === s || (Array.isArray(item.slots) && item.slots.includes(s));
}

function hasExplicitSlot(item: Item, s: string): boolean {
  return Array.isArray(item.slots) && item.slots.includes(s);
}

export function inferSmartUpperSlots(item: Item): string[] {
  if (item.category && item.category !== "upper") {
    return [item.slot || item.category];
  }
  const semanticType = item.semantics?.garmentType;
  const semanticRole = item.semantics?.layerRole;
  if (semanticRole === "outer" || ["bomber-jacket", "jacket", "blazer", "coat"].includes(semanticType ?? "")) return ["outerwear"];
  if (semanticRole === "mid" || semanticType === "overshirt" || semanticType === "cardigan") return ["top", "outerwear"];
  if (semanticType === "t-shirt" || semanticType === "tank") return ["innerwear", "top"];
  if (semanticType === "button-up-shirt" || semanticType === "sweater" || semanticType === "hoodie") return ["top"];
  const text = itemText(item);
  if (/undershirt|\btank\b|camisole|innerwear|thermal base/.test(text)) {
    return ["innerwear"];
  }
  if (/\bt-shirt\b|\btee\b|henley|ribbed|mock-neck|turtleneck|long-sleeve tee|jersey/.test(text)) {
    return ["innerwear", "top"];
  }
  if (/overshirt|shacket|cardigan|camp collar|short sleeve shirt|half-zip|quarter-zip|flannel|vest|gilet|hoodie|zip-up|chore|denim shirt|linen shirt/.test(text)) {
    return ["top", "outerwear"];
  }
  if (/bomber|jacket|coat|blazer|puffer|parka|trench|windbreaker|anorak|peacoat|overcoat/.test(text) || item.layer === "outer") {
    return ["outerwear"];
  }
  if (item.layer === "mid") {
    return ["top", "outerwear"];
  }
  return ["top"];
}

export function canBeBaseLayer(item: Item): boolean {
  if (!isUpperItem(item)) return false;
  if (item.semantics?.layerRole === "outer" || item.semantics?.layerRole === "mid") return false;
  if (item.semantics?.layerRole === "base") return true;
  if (hasSlot(item, "innerwear")) return true;
  if (Array.isArray(item.slots) && item.slots.length > 0 && !item.slots.includes("innerwear") && item.slots.includes("outerwear") && !item.slots.includes("top")) {
    return false;
  }
  if (item.layer === "base") return true;
  return !item.layer && hasSlot(item, "top") && !hasSlot(item, "outerwear");
}

export function canBeMidLayer(item: Item): boolean {
  if (!isUpperItem(item)) return false;
  if (item.semantics?.layerRole === "mid") return true;
  if (item.layer === "mid") return true;
  if (hasExplicitSlot(item, "outerwear") && hasExplicitSlot(item, "top")) return true;
  return false;
}

export function canBeOuterLayer(item: Item): boolean {
  if (!isUpperItem(item)) return false;
  if (item.semantics?.layerRole === "outer") return true;
  if (item.layer === "outer") return true;
  if (hasSlot(item, "outerwear") && !hasExplicitSlot(item, "top")) return true;
  if (hasExplicitSlot(item, "outerwear") && isSubstantialLayerPiece(item)) return true;
  return false;
}

export function canBeSoloTop(item: Item): boolean {
  if (!isUpperItem(item)) return false;
  if (item.semantics?.layerRole === "outer") return false;
  if ((item.layer === "mid" || item.layer === "outer") && /overshirt|shacket/i.test(itemText(item))) {
    return false;
  }
  if (Array.isArray(item.slots) && item.slots.length > 0) {
    if (item.slots.includes("innerwear") && !item.slots.includes("top")) return false;
    if (item.slots.includes("outerwear") && !item.slots.includes("top")) return false;
    if (item.slots.includes("top")) {
      if ((item.layer === "mid" || item.layer === "outer") && item.slots.length === 1) return false;
      return true;
    }
  }
  return item.layer !== "mid" && item.layer !== "outer" && (hasSlot(item, "top") || !hasSlot(item, "innerwear"));
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
    let score = metadataCompat(a, b);
    if (a.layer && b.layer && a.layer !== b.layer) score += 0.08;
    // Penalize two collared shirts layered together unless one is a heavy/substantial overshirt over a tee
    if (isCollaredShirt(a) && isCollaredShirt(b)) {
      score -= (isSubstantialLayerPiece(a) || isSubstantialLayerPiece(b)) ? 0.12 : 0.28;
    }
    // Penalize closed outer hiding a patterned base
    const patA = inferPattern(a), patB = inferPattern(b);
    if ((isClosedOuterOrMid(a) && patB !== "solid") || (isClosedOuterOrMid(b) && patA !== "solid")) {
      score -= 0.12;
    }
    return clamp01(score);
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
  let score = 0.72 * accentBalance + 0.28 * neutralAnchor;

  const shoe = items.find((item) => item.category === "shoe" || hasSlot(item, "shoe"));
  if (shoe) {
    const core = items.filter((item) => item.id !== shoe.id && item.category !== "accessory");
    if (isBrightIsolatedAccentShoe(shoe, core)) {
      score -= 0.22;
    }
  }
  return clamp01(score);
}

function silhouetteScore(items: Item[]): number {
  const uppers = items.filter((item) => isUpperItem(item));
  const bottom = items.find((item) => item.category === "bottom" || hasSlot(item, "bottom"));
  if (!uppers.length || !bottom) return 0.82;
  const primaryUpper = uppers.find((item) => item.layer !== "outer") ?? uppers[0]!;
  const outerOrMid = uppers.find((item) => item.layer === "outer" || item.layer === "mid");
  const upperFit = primaryUpper.fit ?? "regular";
  const bottomFit = bottom.fit ?? "regular";

  let score = 0.88;
  if (isFitted(upperFit) && (bottomFit === "relaxed" || isOversized(bottomFit))) score = 0.96;
  else if (isOversized(upperFit) && isOversized(bottomFit)) score = 0.68;
  else if (upperFit === bottomFit) score = upperFit === "regular" ? 0.92 : 0.84;

  // Check outer/mid layer volume against bottom volume (e.g. heavy bomber + wide sweatpants/baggy bottom)
  if (outerOrMid) {
    const outerFit = outerOrMid.fit ?? "regular";
    const heavyOuter = /bomber|puffer|parka|leather|shearling/.test(itemText(outerOrMid));
    if ((isOversized(outerFit) || (outerFit === "relaxed" && heavyOuter)) && (bottomFit === "relaxed" || isOversized(bottomFit))) {
      score -= 0.14;
    }
  }
  return clamp01(score);
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
  let score = 0.78 * formalityFit + 0.22 * styleFit;
  if (isBrightIsolatedAccentShoe(shoe, core)) {
    score -= 0.28;
  }
  return clamp01(score);
}

function preferenceScore(items: Item[], prefs: StylePreferences, feedback: OutfitFeedbackEvent[] = []): number {
  let goalScore = 0.86;
  if (prefs.goal === "vertical-line") goalScore = items.some((item) => item.layer === "mid" || item.layer === "outer") ? 1 : 0.5;
  else if (prefs.goal === "shoulder-structure") {
    goalScore = items.some((item) => item.layer === "outer" || /blazer|jacket/i.test(item.subcategory ?? item.title)) ? 1 : 0.5;
  } else if (prefs.goal === "define-waist") {
    goalScore = items.some((item) => /fitted|belt|cinch/i.test(`${item.fit} ${item.description}`)) ? 1 : 0.5;
  }
  return clamp01(goalScore + feedbackAdjustment(items.map((item) => item.id), feedback));
}

export function scoreOutfit(items: Item[], prefs: StylePreferences, feedback: OutfitFeedbackEvent[] = []): OutfitScoreBreakdown {
  const compatibility = compatibilityScore(items);
  const palette = paletteScore(items);
  const silhouette = silhouetteScore(items);
  const formality = formalityScore(items, prefs);
  const style = styleScore(items);
  const footwear = footwearScore(items);
  const preference = preferenceScore(items, prefs, feedback);
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

export function inferArchetype(formula: string, items: Item[], prefs: StylePreferences): OutfitArchetype {
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
  if (isFitted(upper?.fit) && (bottom?.fit === "relaxed" || isOversized(bottom?.fit))) return "soft-casual";
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
  if (formula === "Layered" && (!base || !canBeBaseLayer(base))) violations.push("invalid-base-layer");
  if (formula === "Layered" && (!overshirt || !canBeMidLayer(overshirt))) violations.push("invalid-mid-layer");
  if (formula === "With layer" && (!outer || !canBeOuterLayer(outer))) violations.push("invalid-outer-layer");
  if (formula === "Simple" && (!simpleTop || !canBeSoloTop(simpleTop))) violations.push("layer-piece-used-as-solo-top");

  const layeredUpper = overshirt ?? outer;
  if (base && layeredUpper) {
    if (isCollaredShirt(base) && isCollaredShirt(layeredUpper) && !isSubstantialLayerPiece(layeredUpper)) {
      violations.push("competing-collared-shirts");
    }
    const basePat = inferPattern(base);
    const layerPat = inferPattern(layeredUpper);
    if (basePat !== "solid" && layerPat !== "solid") {
      violations.push("competing-upper-patterns");
    }
  }

  const uppers = items.filter((item) => isUpperItem(item));
  if (uppers.some((u) => isPolishedButtonUp(u)) && bottoms.some((b) => isLoungeBottom(b))) {
    violations.push("polished-shirt-with-lounge-bottom");
  }

  return { valid: violations.length === 0, violations };
}

export function buildReason(formula: string, items: Item[], roles: string[], prefs: StylePreferences): string {
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
  feedback?: OutfitFeedbackEvent[];
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
  const bases = uppers.filter((i) => canBeBaseLayer(i));
  const mids = uppers.filter((i) => canBeMidLayer(i));
  const outers = uppers.filter((i) => canBeOuterLayer(i));
  const solo = uppers.filter((i) => canBeSoloTop(i));
  const shoeSlot = shoes.length ? [{ role: "shoes", pool: shoes }] : [];
  const baseOrMidForOuter = [...bases, ...mids.filter((m) => !bases.some((b) => b.id === m.id))];
  const formulas = [
    ...(bases.length && mids.length && bottoms.length ? [{ name: "Layered", slots: [{ role: "base", pool: bases }, { role: "overshirt", pool: mids }, { role: "bottom", pool: bottoms }, ...shoeSlot] }] : []),
    ...(solo.length && bottoms.length ? [{ name: "Simple", slots: [{ role: "top", pool: solo }, { role: "bottom", pool: bottoms }, ...shoeSlot] }] : []),
    ...(baseOrMidForOuter.length && outers.length && bottoms.length ? [{ name: "With layer", slots: [{ role: "base", pool: baseOrMidForOuter }, { role: "outer", pool: outers }, { role: "bottom", pool: bottoms }, ...shoeSlot] }] : []),
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
      const scoreBreakdown = scoreOutfit(combo, prefs, options.feedback);
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
