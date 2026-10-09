import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { askGeminiJson, geminiConfigured, parseDataImage } from "@/lib/gemini";
import type { Item, Look, StylePreferences } from "@/lib/recommend";

export const runtime = "nodejs";

type Verdict = {
  rankedLookIds: string[];
  verdicts: Array<{ lookId: string; title: string; reason: string; tip: string }>;
};

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
  if (!geminiConfigured()) return NextResponse.json({ looks: limited.slice(0, 3), source: "deterministic" });

  try {
    const unique = new Map<string, Item>();
    for (const look of limited) for (const item of look.items) if (unique.size < 12) unique.set(item.id, item);
    const imageItems = [...unique.values()];
    const images = await Promise.all(imageItems.map(imagePart));
    const facts = limited.map((look) => ({
      id: look.lookId,
      formula: look.formula,
      deterministicScore: Number(look.score.toFixed(3)),
      cohesion: Number(look.cohesion.toFixed(3)),
      items: look.items.map(({ id, title, category, subcategory, color, palette, layer, fit, formality, styles, seasons }) => ({ id, title, category, subcategory, color, palette, layer, fit, formality, styles, seasons })),
    }));
    const imageOrder = imageItems.map((item, index) => ({ image: index + 1, itemId: item.id, title: item.title }));

    const verdict = await askGeminiJson<Verdict>({
      images,
      prompt: `Act as a careful ecommerce stylist and rerank ONLY the candidate outfits below. Never invent, remove, or rename products. Respect the deterministic score as evidence, then evaluate color harmony, silhouette balance, valid layering, formality, occasion and the user's optional styling goal. Product images follow after this prompt in IMAGE ORDER.

USER PREFERENCES:
${JSON.stringify(preferences)}

CANDIDATES:
${JSON.stringify(facts)}

IMAGE ORDER:
${JSON.stringify(imageOrder)}

Return JSON exactly:
{
  "rankedLookIds": ["look_2","look_1","look_3"],
  "verdicts": [
    {"lookId":"look_2","title":"2-4 word style verdict","reason":"two grounded sentences naming specific pieces and why they work","tip":"one optional styling tip"}
  ]
}
Rank every supplied candidate exactly once. Keep language positive and specific.`,
      temperature: 0.2,
    });

    const rank = new Map(verdict.rankedLookIds.map((id, index) => [id, index]));
    const notes = new Map((verdict.verdicts ?? []).map((v) => [v.lookId, v]));
    const ordered = [...limited].sort((a, b) => (rank.get(a.lookId) ?? 99) - (rank.get(b.lookId) ?? 99));
    const looks = ordered.slice(0, 3).map((look) => {
      const note = notes.get(look.lookId);
      const aiReason = note ? `${note.reason}${note.tip ? ` Tip: ${note.tip}` : ""}` : undefined;
      return { ...look, reason: aiReason ?? look.reason, aiReason, stylistTitle: note?.title };
    });
    return NextResponse.json({ looks, source: "gemini" });
  } catch (error) {
    return NextResponse.json({
      looks: limited.slice(0, 3),
      source: "deterministic",
      warning: error instanceof Error ? error.message : String(error),
    });
  }
}
