import { NextRequest, NextResponse } from "next/server";
import { askGeminiJson, geminiConfigured, parseDataImage } from "@/lib/gemini";

export const runtime = "nodejs";

const CATEGORIES = ["upper", "bottom", "shoe", "accessory", "dress"] as const;
const LAYERS = ["base", "mid", "outer"] as const;
const FITS = ["slim", "regular", "relaxed", "baggy"] as const;
const PALETTES = ["warm", "cool", "neutral"] as const;
const COLOR_ROLES = ["neutral", "accent"] as const;

type Analysis = {
  title: string;
  category: (typeof CATEGORIES)[number];
  subcategory: string;
  layer: (typeof LAYERS)[number] | null;
  dominantColor: string;
  palette: (typeof PALETTES)[number];
  colorRole: (typeof COLOR_ROLES)[number];
  fit: (typeof FITS)[number];
  formality: number;
  seasons: string[];
  styles: string[];
  material: string;
  description: string;
};

function fallback(rowHint: string, fallbackName: string): Analysis {
  const category = rowHint === "bottoms" ? "bottom" : rowHint === "accessories" ? "accessory" : "upper";
  return {
    title: fallbackName || "Wardrobe item",
    category,
    subcategory: category === "upper" ? "top" : category,
    layer: category === "upper" ? "base" : null,
    dominantColor: "#8A8480",
    palette: "neutral",
    colorRole: "neutral",
    fit: "regular",
    formality: 2,
    seasons: ["all-season"],
    styles: ["casual"],
    material: "unknown",
    description: "User-added wardrobe item",
  };
}

function normalize(raw: Partial<Analysis>, rowHint: string, fallbackName: string): Analysis {
  const base = fallback(rowHint, fallbackName);
  const category = CATEGORIES.includes(raw.category as Analysis["category"]) ? raw.category! : base.category;
  const layer = category === "upper" && LAYERS.includes(raw.layer as NonNullable<Analysis["layer"]>) ? raw.layer! : category === "upper" ? "base" : null;
  return {
    title: String(raw.title || base.title).slice(0, 80),
    category,
    subcategory: String(raw.subcategory || base.subcategory).slice(0, 40),
    layer,
    dominantColor: /^#[0-9a-f]{6}$/i.test(String(raw.dominantColor)) ? String(raw.dominantColor) : base.dominantColor,
    palette: PALETTES.includes(raw.palette as Analysis["palette"]) ? raw.palette! : base.palette,
    colorRole: COLOR_ROLES.includes(raw.colorRole as Analysis["colorRole"]) ? raw.colorRole! : base.colorRole,
    fit: FITS.includes(raw.fit as Analysis["fit"]) ? raw.fit! : base.fit,
    formality: Math.max(1, Math.min(5, Math.round(Number(raw.formality) || base.formality))),
    seasons: Array.isArray(raw.seasons) ? raw.seasons.map(String).slice(0, 4) : base.seasons,
    styles: Array.isArray(raw.styles) ? raw.styles.map(String).slice(0, 5) : base.styles,
    material: String(raw.material || base.material).slice(0, 40),
    description: String(raw.description || base.description).slice(0, 240),
  };
}

export async function POST(req: NextRequest) {
  const { imageBase64, rowHint = "tops", fallbackName = "Wardrobe item" } = await req.json();
  const image = typeof imageBase64 === "string" ? parseDataImage(imageBase64) : null;
  if (!image) return NextResponse.json({ error: "A valid image data URL is required" }, { status: 400 });

  if (!geminiConfigured()) {
    return NextResponse.json({ analysis: fallback(rowHint, fallbackName), source: "fallback" });
  }

  try {
    const raw = await askGeminiJson<Partial<Analysis>>({
      images: [image],
      prompt: `You are a fashion cataloging system. Inspect the garment or accessory in the image and return JSON only.
Required schema:
{
  "title": "short ecommerce product name",
  "category": "upper|bottom|shoe|accessory|dress",
  "subcategory": "t-shirt|overshirt|jeans|sneaker|bag etc",
  "layer": "base|mid|outer|null",
  "dominantColor": "#RRGGBB",
  "palette": "warm|cool|neutral",
  "colorRole": "neutral|accent",
  "fit": "slim|regular|relaxed|baggy",
  "formality": 1,
  "seasons": ["spring","summer","autumn","winter"],
  "styles": ["minimal","streetwear","smart-casual"],
  "material": "best visual estimate",
  "description": "one factual sentence"
}
Rules: classify what is visibly present, do not invent branding, set layer only for upper garments, formality is 1 casual to 5 formal. The upload UI hint was '${rowHint}', but visual evidence wins.`,
    });
    return NextResponse.json({ analysis: normalize(raw, rowHint, fallbackName), source: "gemini" });
  } catch (error) {
    return NextResponse.json({
      analysis: fallback(rowHint, fallbackName),
      source: "fallback",
      warning: error instanceof Error ? error.message : String(error),
    });
  }
}
