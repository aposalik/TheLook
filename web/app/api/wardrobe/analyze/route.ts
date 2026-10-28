import { NextRequest, NextResponse } from "next/server";
import { askGeminiJson, geminiConfigured, parseDataImage } from "@/lib/gemini";
import {
  fallbackWardrobeAnalysis,
  normalizeWardrobeAnalysis,
  type WardrobeAnalysis,
} from "@/lib/wardrobe-analysis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { imageBase64, rowHint = "tops", fallbackName = "Wardrobe item" } = await req.json();
  const image = typeof imageBase64 === "string" ? parseDataImage(imageBase64) : null;
  if (!image) return NextResponse.json({ error: "A valid image data URL is required" }, { status: 400 });

  if (!geminiConfigured()) {
    return NextResponse.json({ analysis: fallbackWardrobeAnalysis(rowHint, fallbackName), source: "fallback" });
  }

  try {
    const raw = await askGeminiJson<Partial<WardrobeAnalysis>>({
      images: [image],
      prompt: `You are an expert fashion cataloging system. Inspect the single visible garment or accessory and return JSON only.
Required schema:
{
  "title": "short factual product name",
  "category": "upper|bottom|shoe|accessory|dress",
  "subcategory": "specific garment subtype",
  "layer": "base|mid|outer|null",
  "roles": ["innerwear", "top", "outerwear"],
  "dominantColor": "#RRGGBB",
  "palette": "warm|cool|neutral",
  "colorRole": "neutral|accent",
  "fit": "slim|regular|relaxed|baggy",
  "formality": 1,
  "gender": "men|women",
  "seasons": ["spring", "summer", "autumn", "winter"],
  "styles": ["minimal", "streetwear", "smart-casual"],
  "material": "best visual estimate",
  "description": "one factual sentence",
  "semantics": {
    "garmentType": "t-shirt|tank|button-up-shirt|overshirt|sweater|cardigan|hoodie|bomber-jacket|jacket|blazer|coat|jeans|trousers|sweatpants|shorts|skirt|dress|sneaker|dress-shoe|boot|sandal|accessory|other",
    "pattern": "solid|stripe|check|graphic|floral|camo|other",
    "patternScale": "none|fine|medium|bold",
    "fabric": "cotton|linen|wool|denim|leather|suede|knit|fleece|synthetic|silk|other",
    "fabricWeight": "light|medium|heavy",
    "collarType": "none|crew|v-neck|point|camp|polo|turtleneck|lapel|hood|zip-neck|other",
    "closure": "none|buttons|zip|pullover|open-front|other",
    "canWearOpen": false,
    "layerRole": "base|mid|outer",
    "silhouetteVolume": "low|medium|high",
    "length": "cropped|regular|long",
    "isLoungewear": false,
    "isSubstantialLayer": false,
    "inferenceConfidence": "low|medium|high"
  }
}
Rules:
- Classify only visible evidence and do not invent branding.
- A normal button-up shirt is a top/base, not automatically outerwear.
- Use outerwear for jackets/coats or a true substantial overshirt/cardigan that can be worn over another top.
- A basic tee may use roles ["innerwear", "top"]. A true overshirt may use ["top", "outerwear"].
- Set canWearOpen only for a visible button, zip, or open-front construction.
- Set isSubstantialLayer only when fabric weight and construction can realistically support another upper beneath it.
- Set isLoungewear for sweatpants, lounge pants, and similar athletic-home bottoms.
- Treat neckline/collar geometry as functional evidence: distinguish v-neck, crew, point collar, turtleneck, zip-neck, and hood precisely.
- A pullover sweater is normally a mid layer when it has enough room for a light tee or shirt; it is not open outerwear.
- A V-neck knit can intentionally reveal a collared shirt beneath it. Record collarType "v-neck", closure "pullover", fabric "knit", and realistic weight/volume.
- A hoodie has collarType "hood" and usually medium/high volume. Do not describe it as a suitable base beneath a fitted pullover knit.
- Infer fabric weight and silhouette volume independently. Thick cable knit, fleece, and bulky hood constructions are not light layers.
- If age/fit context is uncertain from the image, keep the title factual and omit unsupported claims such as "children's" or "adult".
- Set inferenceConfidence from image evidence quality. Use low when neckline, construction, weight, or intended use is occluded or genuinely ambiguous.
- The upload UI hint is '${rowHint}', but visual evidence wins.`,
      temperature: 0.05,
    });
    return NextResponse.json({ analysis: normalizeWardrobeAnalysis(raw, rowHint, fallbackName), source: "gemini" });
  } catch (error) {
    return NextResponse.json({
      analysis: fallbackWardrobeAnalysis(rowHint, fallbackName),
      source: "fallback",
      warning: error instanceof Error ? error.message : String(error),
    });
  }
}
