// Rolling Rack + Hard Physical Guardrail architecture.
// TypeScript curates a diverse Rolling Rack (12-20 items) and enforces hard physical/layering
// constraints via validateOutfitCandidate(); Gemini Vision acts as the primary creative stylist.
import catalogData from "../data/catalog.json";
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
const INFERENCE_CONFIDENCE = ["low", "medium", "high"] as const;

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
  inferenceConfidence?: (typeof INFERENCE_CONFIDENCE)[number];
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
    inferenceConfidence: enumValue(raw.inferenceConfidence, INFERENCE_CONFIDENCE),
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

export type WeatherContext = {
  location: string;
  tempMin: number;
  tempMax: number;
  tempCurrent?: number;
  condition: string;
  season?: "winter" | "spring" | "summer" | "autumn";
  summary?: string;
};

export type StylePreferences = {
  occasion?: "any" | "casual" | "work" | "evening";
  goal?: "balanced" | "define-waist" | "vertical-line" | "shoulder-structure";
  gender?: "all" | "men" | "women";
  weather?: WeatherContext | null;
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
export function getCatalog(): Item[] { return FIXED; }

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
    : /graphic|logo|printed|embroider|bear|patch|motif|crest|illustration/.test(text) ? "graphic"
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
  const substantialType = ["overshirt", "cardigan", "hoodie", "bomber-jacket", "jacket", "blazer", "coat"].includes(garmentType);
  const closure = /button/.test(text) ? "buttons"
    : /zip/.test(text) ? "zip"
    : garmentType === "sweater" || garmentType === "hoodie" ? "pullover"
    : substantialType ? "open-front"
    : "none";
  const layerRole = item.category === "upper" && (item.layer === "base" || item.layer === "mid" || item.layer === "outer") ? item.layer : undefined;
  return normalizeGarmentSemantics({
    garmentType,
    pattern,
    patternScale: pattern === "solid" ? "none" : "medium",
    fabric,
    fabricWeight: garmentType === "hoodie" || /heavy|thick|puffer|leather|wool|fleece|hoodie/.test(text) ? "heavy" : substantialType ? "medium" : "light",
    collarType: garmentType === "button-up-shirt" || garmentType === "overshirt" ? (/camp collar/.test(text) ? "camp" : "point")
      : garmentType === "blazer" || garmentType === "coat" ? "lapel"
      : garmentType === "hoodie" ? "hood"
      : /v[ -]?neck/.test(text) ? "v-neck"
      : /turtleneck|roll neck/.test(text) ? "turtleneck"
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
  if (item.semantics?.pattern && item.semantics.pattern !== "solid") return item.semantics.pattern;
  const text = itemText(item);
  if (/stripe|striped|pinstripe|breton/.test(text)) return "stripe";
  if (/check|checked|plaid|gingham|tartan|houndstooth/.test(text)) return "check";
  if (/graphic|print|printed|logo|floral|camo|embroider|bear|patch|motif|crest|illustration/.test(text)) return "graphic";
  return item.semantics?.pattern ?? "solid";
}

export function isClosedOuterOrMid(item: Item): boolean {
  if (typeof item.semantics?.canWearOpen === "boolean") return !item.semantics.canWearOpen;
  const text = itemText(item);
  if (/open|cardigan|overshirt|shacket|blazer|coat|trench|vest|gilet|button/.test(text)) return false;
  return /pullover|crewneck|sweater|knit|hoodie|bomber|anorak/.test(text);
}

function isPulloverLayer(item: Item): boolean {
  if (item.semantics?.closure) return item.semantics.closure === "pullover";
  return /pullover|sweater|jumper|crewneck|v-neck|knit/.test(itemText(item)) && !/cardigan|zip|button/.test(itemText(item));
}

function hasHood(item: Item): boolean {
  return item.semantics?.collarType === "hood" || item.semantics?.garmentType === "hoodie" || /hoodie|hooded/.test(itemText(item));
}

function isShirtOvershirtOrCardigan(item: Item): boolean {
  const gType = item.semantics?.garmentType ?? inferLegacyGarmentSemantics(item).garmentType;
  if (gType === "button-up-shirt" || gType === "overshirt" || gType === "cardigan" || gType === "t-shirt") {
    return true;
  }
  const text = itemText(item);
  return /\bshirt\b|overshirt|shacket|cardigan|flannel|polo|blouse/.test(text) && !/jacket|coat|bomber|puffer|parka|blazer|vest|gilet/.test(text);
}

function layerBulk(item: Item): number {
  const inferredWeight = hasHood(item)
    ? "heavy"
    : item.semantics?.fabricWeight ?? inferLegacyGarmentSemantics(item).fabricWeight ?? "light";
  const weight = { light: 0, medium: 1, heavy: 2 }[inferredWeight];
  const volume = { low: 0, medium: 1, high: 2 }[item.semantics?.silhouetteVolume ?? "medium"];
  return weight + volume;
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
  if (semanticRole === "outer" || item.layer === "outer" || (item.slot === "outerwear" && !item.slots?.includes("top")) || ["bomber-jacket", "jacket", "blazer", "coat"].includes(semanticType ?? "")) return ["outerwear"];
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
  if (item.semantics?.layerRole === "outer" || item.layer === "outer") return false;
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
  // Legacy catalog data sometimes marks ordinary button-up shirts as `mid`
  // because they can participate in layering. They remain valid standalone tops.
  if ((item.layer === "mid" || item.layer === "outer") && isPolishedButtonUp(item)) return true;
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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inferArchetype(formula: string, items: Item[], prefs: StylePreferences): OutfitArchetype {
  const upper = items.find((item) => isUpperItem(item) && item.layer !== "outer");
  const bottom = items.find((item) => item.category === "bottom" || hasSlot(item, "bottom"));
  const outer = items.find((item) => item.layer === "outer" || canBeOuterLayer(item));
  const styles = new Set(items.flatMap((item) => item.styles ?? []));
  const formalities = items.map((item) => item.formality).filter((value): value is number => typeof value === "number");
  const averageFormality = formalities.length ? formalities.reduce((sum, value) => sum + value, 0) / formalities.length : 2;

  if (formula === "Dress") return "dress";
  if (formula === "Three layer" || formula === "With layer") {
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

function occasionTargetFormality(occasion?: StylePreferences["occasion"]): number | null {
  if (occasion === "casual") return 1.8;
  if (occasion === "work") return 3.0;
  if (occasion === "evening") return 3.5;
  return null;
}

export type RollingRackOptions = {
  extraItems?: Item[];
  catalogItems?: Item[];
  anchorIds?: string[];
  recentlyUsedItemIds?: string[];
  preferences?: StylePreferences;
  feedback?: OutfitFeedbackEvent[];
  seed?: number;
  maxItems?: number;
};

export type RollingRack = {
  items: Item[];
  byRole: {
    bases: Item[];
    solo: Item[];
    mids: Item[];
    outers: Item[];
    bottoms: Item[];
    dresses: Item[];
    shoes: Item[];
    accessories: Item[];
  };
};

function diversifySlotSample(
  pool: Item[],
  quota: number,
  anchorSet: Set<string>,
  recentSet: Set<string>,
  prefs: StylePreferences,
  feedback: OutfitFeedbackEvent[],
  rng: () => number,
  alreadySelected: Set<string>,
): Item[] {
  if (pool.length === 0 || quota <= 0) return [];
  const chosen: Item[] = [];
  const seenPalettes = new Set<string>();
  const seenFits = new Set<string>();
  const targetForm = occasionTargetFormality(prefs.occasion);

  // 1. Always pin anchor items first
  for (const item of pool) {
    if (anchorSet.has(item.id) && chosen.length < quota) {
      chosen.push(item);
      alreadySelected.add(item.id);
      if (item.palette) seenPalettes.add(item.palette);
      if (item.fit) seenFits.add(item.fit);
    }
  }

  const candidates = pool.filter((item) => !chosen.some((c) => c.id === item.id));
  while (chosen.length < quota && candidates.length > 0) {
    let bestIdx = 0;
    let bestWeight = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i]!;
      let weight = 1.0;

      // Penalize recently used items so re-generating wheels in a fresh rack
      if (recentSet.has(item.id)) weight *= 0.2;

      // Slight penalty if already pulled into another upper role on the rack
      if (alreadySelected.has(item.id)) weight *= 0.55;

      // Occasion alignment (soft guide, not rigid block)
      if (targetForm !== null && typeof item.formality === "number") {
        const gap = Math.abs(item.formality - targetForm);
        weight += gap <= 1 ? 0.22 : gap <= 2 ? 0.05 : -0.25;
      }

      // Live weather & season alignment when weather is provided
      if (prefs.weather) {
        const avgTemp = typeof prefs.weather.tempCurrent === "number"
          ? prefs.weather.tempCurrent
          : (prefs.weather.tempMin + prefs.weather.tempMax) / 2;
        const season = prefs.weather.season;
        if (season && Array.isArray(item.seasons) && item.seasons.length > 0) {
          if (item.seasons.includes(season) || item.seasons.includes("all-season")) {
            weight += 0.25;
          } else {
            weight -= 0.18;
          }
        }
        const fabWeight = item.semantics?.fabricWeight ?? inferLegacyGarmentSemantics(item).fabricWeight;
        if (avgTemp <= 14 && (fabWeight === "heavy" || fabWeight === "medium")) weight += 0.22;
        if (avgTemp >= 24 && fabWeight === "heavy") weight -= 0.35;
        if (avgTemp >= 24 && fabWeight === "light") weight += 0.22;
      }

      // Reward color/palette & silhouette diversity on the rack
      const palKey = `${item.color_role ?? "neutral"}:${item.palette ?? "neutral"}`;
      if (!seenPalettes.has(palKey)) weight += 0.28;
      if (item.fit && !seenFits.has(item.fit)) weight += 0.22;

      // User feedback signal adjustment
      weight += feedbackAdjustment([item.id], feedback);

      // Seeded jitter for variety across clicks
      weight += rng() * 0.35;

      if (weight > bestWeight) {
        bestWeight = weight;
        bestIdx = i;
      }
    }

    const picked = candidates.splice(bestIdx, 1)[0]!;
    chosen.push(picked);
    alreadySelected.add(picked.id);
    seenPalettes.add(`${picked.color_role ?? "neutral"}:${picked.palette ?? "neutral"}`);
    if (picked.fit) seenFits.add(picked.fit);
  }

  return chosen;
}

export function buildRollingRack(options: RollingRackOptions = {}): RollingRack {
  const prefs = options.preferences ?? {};
  const feedback = options.feedback ?? [];
  const baseItems = options.catalogItems ?? FIXED;
  const rawPool = [
    ...baseItems,
    ...(options.extraItems ?? []).filter((item, index, values) => values.findIndex((v) => v.id === item.id) === index),
  ].map((item) =>
    item.category === "upper" && (!item.slots || item.slots.length <= 1)
      ? { ...item, slots: inferSmartUpperSlots(item) }
      : item,
  );

  const anchorIds = (options.anchorIds ?? []).filter(Boolean);
  const anchorSet = new Set(anchorIds);
  const recentSet = new Set((options.recentlyUsedItemIds ?? []).filter((id) => !anchorSet.has(id)));
  const rng = mulberry32(options.seed ?? 1);

  const anchoredGender = rawPool.find((item) => anchorSet.has(item.id) && item.category !== "accessory" && item.gender)?.gender;
  const targetGender = prefs.gender && prefs.gender !== "all" ? prefs.gender : anchoredGender;
  const targetForm = occasionTargetFormality(prefs.occasion);

  const filtered = rawPool.filter((item) => {
    if (anchorSet.has(item.id)) return true;
    if (targetGender && item.gender && item.gender !== targetGender) return false;
    if (targetForm !== null && typeof item.formality === "number" && Math.abs(item.formality - targetForm) >= 3) {
      return false;
    }
    return true;
  });

  const uppers = filtered.filter((i) => isUpperItem(i));
  const rawBases = uppers.filter((i) => canBeBaseLayer(i));
  const rawSolo = uppers.filter((i) => canBeSoloTop(i));
  const rawMids = uppers.filter((i) => canBeMidLayer(i));
  const rawOuters = uppers.filter((i) => canBeOuterLayer(i));
  const rawBottoms = filtered.filter((i) => i.category === "bottom" || hasSlot(i, "bottom"));
  const rawDresses = filtered.filter((i) => i.category === "dress" || hasSlot(i, "dress"));
  const rawShoes = filtered.filter((i) => i.category === "shoe" || hasSlot(i, "shoe"));
  const rawAccessories = filtered.filter((i) => i.category === "accessory" || hasSlot(i, "accessory"));

  const alreadySelected = new Set<string>();
  const soloAndBasesPool = [...rawSolo, ...rawBases.filter((b) => !rawSolo.some((s) => s.id === b.id))];
  const sampledTops = diversifySlotSample(soloAndBasesPool, 5, anchorSet, recentSet, prefs, feedback, rng, alreadySelected);
  const mids = diversifySlotSample(rawMids, 4, anchorSet, recentSet, prefs, feedback, rng, alreadySelected);
  const outers = diversifySlotSample(rawOuters, 3, anchorSet, recentSet, prefs, feedback, rng, alreadySelected);
  const bottoms = diversifySlotSample(rawBottoms, 5, anchorSet, recentSet, prefs, feedback, rng, alreadySelected);
  const dresses = diversifySlotSample(rawDresses, 2, anchorSet, recentSet, prefs, feedback, rng, alreadySelected);
  const shoes = diversifySlotSample(rawShoes, 4, anchorSet, recentSet, prefs, feedback, rng, alreadySelected);
  const accessories = diversifySlotSample(rawAccessories, 2, anchorSet, recentSet, prefs, feedback, rng, alreadySelected);

  // Ensure every locked anchor is present on the rack
  const rackMap = new Map<string, Item>();
  for (const item of rawPool) {
    if (anchorSet.has(item.id)) rackMap.set(item.id, item);
  }
  const maxItems = options.maxItems ?? 18;
  for (const item of [...sampledTops, ...bottoms, ...shoes, ...mids, ...outers, ...dresses, ...accessories]) {
    if (rackMap.size >= maxItems && !anchorSet.has(item.id)) continue;
    rackMap.set(item.id, item);
  }

  const items = [...rackMap.values()];
  return {
    items,
    byRole: {
      bases: items.filter((i) => canBeBaseLayer(i)),
      solo: items.filter((i) => canBeSoloTop(i)),
      mids: items.filter((i) => canBeMidLayer(i)),
      outers: items.filter((i) => canBeOuterLayer(i)),
      bottoms: items.filter((i) => i.category === "bottom" || hasSlot(i, "bottom")),
      dresses: items.filter((i) => i.category === "dress" || hasSlot(i, "dress")),
      shoes: items.filter((i) => i.category === "shoe" || hasSlot(i, "shoe")),
      accessories: items.filter((i) => i.category === "accessory" || hasSlot(i, "accessory")),
    },
  };
}

export function buildScoreBreakdownFromVisuals(
  visualScores?: VisualScores,
  items: Item[] = [],
  prefs: StylePreferences = {},
  feedback: OutfitFeedbackEvent[] = [],
): OutfitScoreBreakdown {
  const palette = clamp01(visualScores?.palette ?? 0.86);
  const silhouette = clamp01(visualScores?.silhouette ?? 0.86);
  const compatibility = clamp01(visualScores?.layering ?? 0.85);
  const formality = clamp01(visualScores?.occasion ?? 0.86);
  const style = clamp01((palette + silhouette) / 2);
  const footwear = clamp01((silhouette + formality) / 2);
  const preference = clamp01(0.86 + feedbackAdjustment(items.map((item) => item.id), feedback));
  void prefs;
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
  if ((formula === "Layered" || formula === "Three layer") && (!base || !canBeBaseLayer(base))) {
    violations.push("invalid-base-layer");
  }
  if (formula === "With layer" && (!base || (!canBeBaseLayer(base) && !canBeMidLayer(base)))) {
    violations.push("invalid-base-layer");
  }
  if ((formula === "Layered" || formula === "Three layer") && (!overshirt || !canBeMidLayer(overshirt))) {
    violations.push("invalid-mid-layer");
  }
  if ((formula === "With layer" || formula === "Three layer") && (!outer || !canBeOuterLayer(outer))) {
    violations.push("invalid-outer-layer");
  }
  if (formula === "Simple" && (!simpleTop || !canBeSoloTop(simpleTop))) {
    violations.push("layer-piece-used-as-solo-top");
  }

  // Check every adjacent upper layer pair: (base -> overshirt), (overshirt -> outer), or (base -> outer)
  const orderedUppers = [base, overshirt, outer].filter((x): x is Item => Boolean(x));
  for (let i = 0; i < orderedUppers.length - 1; i++) {
    const inner = orderedUppers[i]!;
    const layer = orderedUppers[i + 1]!;
    if (isCollaredShirt(inner) && isCollaredShirt(layer) && !isSubstantialLayerPiece(layer)) {
      violations.push("competing-collared-shirts");
    }
    const innerPat = inferPattern(inner);
    const layerPat = inferPattern(layer);
    if (innerPat !== "solid" && layerPat !== "solid") {
      violations.push("competing-upper-patterns");
    }
    if (hasHood(inner) && isPulloverLayer(layer)) {
      violations.push("hood-under-pullover-layer");
    }
    if (hasHood(inner) && (formula === "Layered" || isShirtOvershirtOrCardigan(layer))) {
      violations.push("hoodie-under-shirt-or-overshirt");
    }
    if (layerBulk(inner) > layerBulk(layer)) {
      violations.push("bulky-base-under-lighter-layer");
    }
  }

  const uppers = items.filter((item) => isUpperItem(item));
  if (uppers.some((u) => isPolishedButtonUp(u)) && bottoms.some((b) => isLoungeBottom(b))) {
    violations.push("polished-shirt-with-lounge-bottom");
  }

  return { valid: violations.length === 0, violations };
}

export function repairOutfitFromRack(
  formula: string,
  items: Item[],
  roles: string[],
  rack: RollingRack,
  anchorIds: string[] = [],
): { items: Item[]; roles: string[] } | null {
  if (validateOutfitCandidate(formula, items, roles).valid) {
    return { items, roles };
  }
  const anchorSet = new Set(anchorIds);
  const rolePools: Record<string, Item[]> = {
    base: rack.byRole.bases,
    top: rack.byRole.solo,
    overshirt: rack.byRole.mids,
    outer: rack.byRole.outers,
    bottom: rack.byRole.bottoms,
    dress: rack.byRole.dresses,
    shoes: rack.byRole.shoes,
    accessory: rack.byRole.accessories,
  };

  for (let idx = 0; idx < roles.length; idx++) {
    const current = items[idx]!;
    if (anchorSet.has(current.id)) continue;
    const role = roles[idx]!;
    const alternatives = rolePools[role] ?? [];
    for (const replacement of alternatives) {
      if (items.some((it) => it.id === replacement.id)) continue;
      const nextItems = items.map((it, i) => (i === idx ? replacement : it));
      if (validateOutfitCandidate(formula, nextItems, roles).valid) {
        return { items: nextItems, roles };
      }
    }
  }
  return null;
}

export function buildReason(formula: string, items: Item[], roles: string[], prefs: StylePreferences): string {
  const name = (role: string) => items[roles.indexOf(role)]?.title ?? "";
  const core = formula === "Three layer"
    ? `${name("base")} layered under ${name("overshirt")} and ${name("outer")}, with ${name("bottom")}`
    : formula === "Layered"
      ? `${name("base")} with ${name("overshirt")} layered over it, ${name("bottom")}`
      : formula === "With layer"
        ? `${name("base")} under ${name("outer")}, ${name("bottom")}`
        : formula === "Dress"
          ? `${name("dress")} with ${name("shoes")}`
          : `${name("top")} with ${name("bottom")}`;
  const why: string[] = [];
  const base = items[roles.indexOf("base")];
  const layer = items[roles.indexOf("overshirt")] ?? items[roles.indexOf("outer")];
  if (base && layer && isCollaredShirt(base) && layer.semantics?.collarType === "v-neck") {
    why.push("the V-neck frames the shirt collar");
  }
  if (items.filter((i) => i.color_role === "accent").length <= 1) why.push("balanced palette");
  const fs = items.map((i) => i.formality ?? 2);
  if (Math.max(...fs) - Math.min(...fs) <= 1) why.push("consistent formality");
  if (prefs.weather) {
    const tempText = typeof prefs.weather.tempCurrent === "number"
      ? `${prefs.weather.tempCurrent}°C`
      : `${prefs.weather.tempMin}–${prefs.weather.tempMax}°C`;
    why.push(`styled for ${tempText} (${prefs.weather.condition.toLowerCase()}) in ${prefs.weather.location}`);
  }
  if (prefs.occasion && prefs.occasion !== "any") why.push(`suited to ${prefs.occasion}`);
  if (prefs.goal && prefs.goal !== "balanced") why.push(`supports your ${prefs.goal.replaceAll("-", " ")} goal`);
  return `${core}. ${why.join(", ") || "The proportions and textures work together"}.`;
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

function isLoudUnEchoedShoe(shoe: Item, core: Item[]): boolean {
  const text = itemText(shoe);
  const isBrightNamed = /\bred\b|crimson|scarlet|pink|magenta|neon|orange|yellow|cobalt|bright|lime/.test(text);
  if (!isBrightNamed && shoe.color_role !== "accent") return false;
  return !core.some((item) => item.color_role === "accent" && item.palette === shoe.palette);
}

export function stampOutfitRolesOnItems(items: Item[], roles: string[]): Item[] {
  return items.map((item, idx) => {
    const role = roles[idx];
    if (role === "base") return { ...item, layer: "base" };
    if (role === "overshirt") return { ...item, layer: "mid" };
    if (role === "outer") return { ...item, layer: "outer" };
    if (role === "top") return { ...item, layer: "base" };
    return item;
  });
}

function buildPrunedRackCandidates(
  rack: RollingRack,
  coreAnchors: string[],
  prefs: StylePreferences,
  feedback: OutfitFeedbackEvent[],
): Look[] {
  const { bases, solo, mids, outers, bottoms, dresses, shoes } = rack.byRole;
  const shoePool = shoes.length ? shoes : [null];
  const baseOrMidForOuter = [...bases, ...mids.filter((m) => !bases.some((b) => b.id === m.id))];

  const templates: Array<{ name: string; roles: string[]; pools: Array<Array<Item | null>> }> = [
    ...(bases.length && mids.length && outers.length && bottoms.length
      ? [{ name: "Three layer", roles: ["base", "overshirt", "outer", "bottom", ...(shoes.length ? ["shoes"] : [])], pools: [bases, mids, outers, bottoms, ...(shoes.length ? [shoePool] : [])] }]
      : []),
    ...(bases.length && mids.length && bottoms.length
      ? [{ name: "Layered", roles: ["base", "overshirt", "bottom", ...(shoes.length ? ["shoes"] : [])], pools: [bases, mids, bottoms, ...(shoes.length ? [shoePool] : [])] }]
      : []),
    ...(solo.length && bottoms.length
      ? [{ name: "Simple", roles: ["top", "bottom", ...(shoes.length ? ["shoes"] : [])], pools: [solo, bottoms, ...(shoes.length ? [shoePool] : [])] }]
      : []),
    ...(baseOrMidForOuter.length && outers.length && bottoms.length
      ? [{ name: "With layer", roles: ["base", "outer", "bottom", ...(shoes.length ? ["shoes"] : [])], pools: [baseOrMidForOuter, outers, bottoms, ...(shoes.length ? [shoePool] : [])] }]
      : []),
    ...(dresses.length
      ? [{ name: "Dress", roles: ["dress", ...(shoes.length ? ["shoes"] : [])], pools: [dresses, ...(shoes.length ? [shoePool] : [])] }]
      : []),
  ];

  const built: Look[] = [];
  const BEAM_WIDTH = 28;

  for (const tpl of templates) {
    // Pruned Beam Search: prune invalid partial combinations at each slot step
    let beam: Item[][] = [[]];
    for (let step = 0; step < tpl.pools.length; step++) {
      const pool = tpl.pools[step]!.filter((x): x is Item => x !== null);
      const nextBeam: Item[][] = [];
      for (const prefix of beam) {
        for (const candidate of pool) {
          if (prefix.some((p) => p.id === candidate.id)) continue;
          const partial = [...prefix, candidate];
          const explicitGenders = new Set(partial.map((i) => i.gender).filter(Boolean));
          if (explicitGenders.size > 1) continue;
          const fs = partial.map((i) => i.formality).filter((v): v is number => typeof v === "number");
          if (fs.length > 1 && Math.max(...fs) - Math.min(...fs) >= 3) continue;
          nextBeam.push(partial);
        }
      }
      // Prioritize partial paths that contain locked anchors
      nextBeam.sort((a, b) => {
        const aAnchors = coreAnchors.filter((id) => a.some((it) => it.id === id)).length;
        const bAnchors = coreAnchors.filter((id) => b.some((it) => it.id === id)).length;
        return bAnchors - aAnchors;
      });
      beam = nextBeam.slice(0, BEAM_WIDTH);
    }

    for (const combo of beam) {
      if (coreAnchors.some((id) => !combo.some((it) => it.id === id))) continue;
      if (!validateOutfitCandidate(tpl.name, combo, tpl.roles).valid) continue;

      const shoe = combo.find((i) => i.category === "shoe" || hasSlot(i, "shoe"));
      const core = combo.filter((i) => i.id !== shoe?.id);
      const loudShoePenalty = shoe && isLoudUnEchoedShoe(shoe, core) ? 0.16 : 0;
      const fs = combo.map((i) => i.formality ?? 2);
      const formSpread = fs.length ? Math.max(...fs) - Math.min(...fs) : 0;
      let weatherLayerBonus = 0;
      if (prefs.weather) {
        const avgTemp = typeof prefs.weather.tempCurrent === "number"
          ? prefs.weather.tempCurrent
          : (prefs.weather.tempMin + prefs.weather.tempMax) / 2;
        const isLayeredFormula = tpl.name === "Three layer" || tpl.name === "With layer" || tpl.name === "Layered";
        if (avgTemp <= 15) {
          weatherLayerBonus = tpl.name === "Three layer" ? 0.08 : isLayeredFormula ? 0.06 : -0.05;
        } else if (avgTemp >= 24) {
          weatherLayerBonus = tpl.name === "Simple" || tpl.name === "Dress" ? 0.07 : -0.08;
        } else {
          weatherLayerBonus = isLayeredFormula ? 0.04 : 0.02;
        }
      }
      const formScore = clamp01(1 - formSpread * 0.12);
      const palScore = clamp01(0.88 - loudShoePenalty);
      const scoreBreakdown = buildScoreBreakdownFromVisuals(
        {
          palette: palScore,
          silhouette: 0.88,
          layering: clamp01(0.86 + weatherLayerBonus),
          occasion: formScore,
        },
        combo,
        prefs,
        feedback,
      );
      const reason = buildReason(tpl.name, combo, tpl.roles, prefs);
      const archetype = inferArchetype(tpl.name, combo, prefs);
      const stampedItems = stampOutfitRolesOnItems(combo, tpl.roles);
      built.push({
        formula: tpl.name,
        archetype,
        selectionMode: "alternate",
        items: stampedItems,
        roles: tpl.roles,
        score: scoreBreakdown.total,
        cohesion: scoreBreakdown.compatibility,
        scoreBreakdown,
        reason,
        deterministicReason: reason,
      });
    }
  }
  return built;
}

export type RecommendOptions = {
  extraItems?: Item[];
  preferences?: StylePreferences;
  feedback?: OutfitFeedbackEvent[];
  candidateLimit?: number;
  catalogItems?: Item[];
  recentlyUsedItemIds?: string[];
  seed?: number;
};

export function recommend(
  anchors?: string | string[],
  k = 3,
  options: RecommendOptions = {},
): Look[] {
  const prefs = options.preferences ?? {};
  const ids = (Array.isArray(anchors) ? anchors : anchors ? [anchors] : []).filter(Boolean);
  const rack = buildRollingRack({
    extraItems: options.extraItems,
    catalogItems: options.catalogItems,
    anchorIds: ids,
    recentlyUsedItemIds: options.recentlyUsedItemIds,
    preferences: prefs,
    feedback: options.feedback,
    seed: options.seed,
  });

  const accessories = rack.byRole.accessories;
  const accessoriesById = new Set(accessories.map((a) => a.id));
  const accessoryAnchors = ids.filter((id) => accessoriesById.has(id));
  const coreAnchors = ids.filter((id) => !accessoriesById.has(id));

  const built = buildPrunedRackCandidates(rack, coreAnchors, prefs, options.feedback ?? []);
  const anchorSet = new Set(ids);
  const signature = (look: Look) => look.items.filter((item) => !anchorSet.has(item.id)).map((item) => item.id).sort().join("|");
  const uniqueEligible = [...built]
    .sort((a, b) => b.score - a.score)
    .filter((look, index, values) => values.findIndex((candidate) => signature(candidate) === signature(look)) === index);

  const candidateCount = Math.max(k, options.candidateLimit ?? k);
  const chosen: Look[] = [];
  const strategyRank = (look: Look) => look.score;

  if (candidateCount === 1) {
    const balanced = [...uniqueEligible].sort((a, b) => strategyRank(b) - strategyRank(a))[0];
    if (balanced) { balanced.selectionMode = "balanced"; chosen.push(balanced); }
  } else {
    const conservativeArchetypes = new Set<OutfitArchetype>(["safe-casual", "soft-casual", "polished-smart", "dress"]);
    const conservative = uniqueEligible.filter((look) => conservativeArchetypes.has(look.archetype));
    const safePool = conservative.length ? conservative : uniqueEligible;
    const safe = chooseDistinctCandidate(safePool, chosen, anchorSet, (look) => look.score + 0.05);
    if (safe) { safe.selectionMode = "safe"; chosen.push(safe); }

    const balanced = chooseDistinctCandidate(uniqueEligible, chosen, anchorSet, strategyRank);
    if (balanced) { balanced.selectionMode = "balanced"; chosen.push(balanced); }

    if (candidateCount >= 3) {
      const expressive = chooseDistinctCandidate(uniqueEligible, chosen, anchorSet, (look) => {
        const layerSignal = look.formula === "Three layer" || look.formula === "Layered" || look.formula === "With layer" ? 0.08 : 0;
        const archetypeSignal = look.archetype === "statement-top" || look.archetype === "statement-bottom" || look.archetype === "utility-street" ? 0.1 : 0;
        return look.score + layerSignal + archetypeSignal;
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
      if (item && !look.items.some((i) => i.id === id)) {
        look.items.push(item);
        look.roles.push("accessory");
      }
    }
  }
  return chosen.slice(0, candidateCount);
}
