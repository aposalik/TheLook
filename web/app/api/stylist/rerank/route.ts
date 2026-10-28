import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { askGeminiJson, geminiConfigured, parseDataImage } from "@/lib/gemini";
import { assertAvailableSwapRoles, parseStylistJudgment, rankJudgedCandidates } from "@/lib/stylist-judge";
import type { Item, Look, StylePreferences } from "@/lib/recommend";

export const runtime = "nodejs";

async function imagePart(item: Item) {
  let bytes: Buffer;
  const inline = parseDataImage(item.image);
  if (inline) bytes = Buffer.from(inline.data, "base64");
  else {
    const relative = item.image.replace(/^\/+/, "");
    const full = path.resolve(process.cwd(), "public", relative);
    const root = path.resolve(process.cwd(), "public") + path.sep;
    if (!full.startsWith(root)) throw new Error("Invalid catalog image path");
    bytes = await readFile(full);
  }
  const optimized = await sharp(bytes).rotate().resize({ width: 420, height: 420, fit: "inside" }).jpeg({ quality: 72 }).toBuffer();
  return { data: optimized.toString("base64"), mimeType: "image/jpeg" };
}

export async function POST(req: NextRequest) {
  const { candidates, preferences = {} } = await req.json() as { candidates: Look[]; preferences?: StylePreferences };
  if (!Array.isArray(candidates) || !candidates.length) return NextResponse.json({ error: "candidates[] required" }, { status: 400 });
  const limited = candidates.slice(0, 5).map((look, index) => ({ ...look, lookId: `look_${index + 1}` }));
  if (!geminiConfigured()) return NextResponse.json({ looks: limited.slice(0, 3), rejected: [], source: "deterministic" });

  try {
    const unique = new Map<string, Item>();
    for (const look of limited) for (const item of look.items) if (unique.size < 12) unique.set(item.id, item);
    const imageItems = [...unique.values()];
    const images = await Promise.all(imageItems.map(imagePart));
    const facts = limited.map((look) => ({
      id: look.lookId,
      formula: look.formula,
      archetype: look.archetype,
      selectionMode: look.selectionMode,
      deterministicScore: Number(look.score.toFixed(3)),
      deterministicScores: Object.fromEntries(Object.entries(look.scoreBreakdown).map(([name, score]) => [name, Number(score.toFixed(3))])),
      roles: look.roles,
      items: look.items.map(({ id, title, category, subcategory, color, palette, layer, fit, formality, styles, seasons, material, semantics }) => ({
        id, title, category, subcategory, color, palette, layer, fit, formality, styles, seasons, material, semantics,
      })),
    }));
    const imageOrder = imageItems.map((item, index) => ({ image: index + 1, itemId: item.id, title: item.title }));

    const raw = await askGeminiJson<unknown>({
      images,
      prompt: `Act as a strict visual critic for already-validated outfit candidates. The deterministic engine has already enforced ownership, garment roles, locked items, and hard constraints. Judge only visible palette, silhouette, layering, and occasion fit.

RULES:
- Judge every supplied look exactly once and use only its provided lookId.
- Never invent, remove, rename, or move a product.
- Never overrule deterministic constraints or scores; use them as evidence.
- Use verdict "reject" only for a visible styling conflict serious enough that the look should not be shown.
- Judge physical layer grammar before aesthetics: neckline/collar geometry, closure, fabric weight, and silhouette volume must make sense together.
- Prefer a light collared shirt under a medium-weight V-neck knit when palette and formality also cohere; the visible collar is intentional.
- Reject a hoodie beneath a pullover sweater/knit because the hood and fleece bulk cannot sit cleanly under the closed neckline.
- Reject a base whose combined fabric weight and silhouette volume exceed the layer worn over it.
- Do not infer child/adult fit or branding unless visibly supported; describe uncertainty rather than inventing evidence.
- preferredSwapRole must be one role listed on that candidate, or "none".
- Each visual score must be a number from 0 to 1.
- Rank values must be unique integers from 1 through the candidate count.

USER PREFERENCES:
${JSON.stringify(preferences)}

CANDIDATES:
${JSON.stringify(facts)}

IMAGE ORDER:
${JSON.stringify(imageOrder)}

Return JSON exactly in this shape:
{
  "judgments": [
    {
      "lookId": "look_1",
      "rank": 1,
      "verdict": "strong",
      "visualScores": {
        "palette": 0.0,
        "silhouette": 0.0,
        "layering": 0.0,
        "occasion": 0.0
      },
      "issues": ["specific visible issue, or an empty array"],
      "preferredSwapRole": "none",
      "title": "2-4 word verdict title",
      "reason": "One or two concise sentences grounded in the supplied garments"
    }
  ]
}`,
      temperature: 0.1,
    });

    const judgment = parseStylistJudgment(raw, limited.map((look) => look.lookId));
    assertAvailableSwapRoles(limited, judgment);
    const ranked = rankJudgedCandidates(limited, judgment);
    const rejected = judgment.judgments
      .filter((entry) => entry.verdict === "reject")
      .map(({ lookId, issues, preferredSwapRole, reason }) => ({ lookId, issues, preferredSwapRole, reason }));
    if (!ranked.length) {
      return NextResponse.json({
        looks: limited.slice(0, 3),
        rejected,
        source: "deterministic",
        warning: "Gemini rejected every candidate; preserved deterministic results.",
      });
    }
    return NextResponse.json({ looks: ranked.slice(0, 3), rejected, source: "gemini" });
  } catch (error) {
    return NextResponse.json({
      looks: limited.slice(0, 3),
      rejected: [],
      source: "deterministic",
      warning: error instanceof Error ? error.message : String(error),
    });
  }
}
