import { normalizeGarmentSemantics, type GarmentSemantics } from "./recommend";

export const WARDROBE_CATEGORIES = ["upper", "bottom", "shoe", "accessory", "dress"] as const;
export const WARDROBE_LAYERS = ["base", "mid", "outer"] as const;
export const WARDROBE_ROLES = ["innerwear", "top", "outerwear", "bottom", "dress", "shoe", "accessory"] as const;
export const WARDROBE_FITS = ["slim", "regular", "relaxed", "baggy"] as const;
export const WARDROBE_PALETTES = ["warm", "cool", "neutral"] as const;
export const WARDROBE_COLOR_ROLES = ["neutral", "accent"] as const;

export type WardrobeRole = (typeof WARDROBE_ROLES)[number];

export type WardrobeAnalysis = {
  title: string;
  category: (typeof WARDROBE_CATEGORIES)[number];
  subcategory: string;
  layer: (typeof WARDROBE_LAYERS)[number] | null;
  roles: WardrobeRole[];
  dominantColor: string;
  palette: (typeof WARDROBE_PALETTES)[number];
  colorRole: (typeof WARDROBE_COLOR_ROLES)[number];
  fit: (typeof WARDROBE_FITS)[number];
  formality: number;
  seasons: string[];
  styles: string[];
  material: string;
  description: string;
  gender: "men" | "women";
  semantics: GarmentSemantics;
};

function isMember<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function fallbackAnalysis(rowHint: string, fallbackName: string): WardrobeAnalysis {
  const category = rowHint === "bottoms" ? "bottom" : rowHint === "accessories" ? "accessory" : "upper";
  return {
    title: fallbackName.trim() || "Wardrobe item",
    category,
    subcategory: category === "upper" ? "top" : category,
    layer: category === "upper" ? "base" : null,
    roles: category === "bottom" ? ["bottom"] : category === "accessory" ? ["accessory"] : ["top"],
    dominantColor: "#8A8480",
    palette: "neutral",
    colorRole: "neutral",
    fit: "regular",
    formality: 2,
    seasons: ["all-season"],
    styles: ["casual"],
    material: "unknown",
    description: "User-added wardrobe item",
    gender: "men",
    semantics: category === "upper" ? { layerRole: "base" } : {},
  };
}

function defaultRole(category: WardrobeAnalysis["category"], layer: WardrobeAnalysis["layer"]): WardrobeRole {
  if (category === "bottom") return "bottom";
  if (category === "shoe") return "shoe";
  if (category === "accessory") return "accessory";
  if (category === "dress") return "dress";
  return layer === "outer" ? "outerwear" : layer === "mid" ? "outerwear" : "top";
}

export function normalizeWardrobeAnalysis(input: unknown, rowHint: string, fallbackName: string): WardrobeAnalysis {
  const base = fallbackAnalysis(rowHint, fallbackName);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const category = isMember(raw.category, WARDROBE_CATEGORIES) ? raw.category : base.category;
  let semantics = normalizeGarmentSemantics(raw.semantics);
  if (!Object.keys(semantics).length && typeof raw.openLayerCapable === "boolean") {
    semantics = { canWearOpen: raw.openLayerCapable };
  }

  let layer: WardrobeAnalysis["layer"] = null;
  if (category === "upper") {
    layer = isMember(raw.layer, WARDROBE_LAYERS)
      ? raw.layer
      : semantics.layerRole ?? base.layer;
    if (semantics.layerRole && semantics.layerRole !== layer) layer = semantics.layerRole;
    semantics = { ...semantics, layerRole: layer ?? "base" };
  } else if (semantics.layerRole !== undefined) {
    const { layerRole: _discarded, ...nonLayerSemantics } = semantics;
    void _discarded;
    semantics = nonLayerSemantics;
  }

  const rawRoles = Array.isArray(raw.roles)
    ? raw.roles.filter((role): role is WardrobeRole => isMember(role, WARDROBE_ROLES))
    : [];
  let roles = [...new Set(rawRoles)].slice(0, 3);
  if (category !== "upper") roles = roles.filter((role) => role === defaultRole(category, layer));
  if (!roles.length) roles = [defaultRole(category, layer)];

  return {
    title: String(raw.title || base.title).trim().slice(0, 80) || base.title,
    category,
    subcategory: String(raw.subcategory || base.subcategory).trim().slice(0, 40) || base.subcategory,
    layer,
    roles,
    dominantColor: /^#[0-9a-f]{6}$/i.test(String(raw.dominantColor)) ? String(raw.dominantColor) : base.dominantColor,
    palette: isMember(raw.palette, WARDROBE_PALETTES) ? raw.palette : base.palette,
    colorRole: isMember(raw.colorRole, WARDROBE_COLOR_ROLES) ? raw.colorRole : base.colorRole,
    fit: isMember(raw.fit, WARDROBE_FITS) ? raw.fit : base.fit,
    formality: Math.max(1, Math.min(5, Math.round(Number(raw.formality) || base.formality))),
    seasons: Array.isArray(raw.seasons) ? raw.seasons.map(String).slice(0, 4) : base.seasons,
    styles: Array.isArray(raw.styles) ? raw.styles.map(String).slice(0, 5) : base.styles,
    material: String(raw.material || base.material).trim().slice(0, 40) || base.material,
    description: String(raw.description || base.description).trim().slice(0, 240) || base.description,
    gender: raw.gender === "women" ? "women" : "men",
    semantics,
  };
}

export function fallbackWardrobeAnalysis(rowHint: string, fallbackName: string): WardrobeAnalysis {
  return fallbackAnalysis(rowHint, fallbackName);
}
