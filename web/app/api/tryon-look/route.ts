import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { uploadFile, runCloth, pollCloth, toJpeg } from "@/lib/youcam";
import { buildUpperCollage } from "@/lib/collage";
import catalog from "@/data/catalog.json";

export const runtime = "nodejs";

type Item = { id: string; slot: string; title: string; image: string; category?: string; layer?: string | null };

const RESULTS_DIR = path.join(process.cwd(), "public", "results");
const GARMENTS_DIR = path.join(process.cwd(), "public", "garments");
const LAYER_RANK: Record<string, number> = { base: 0, mid: 1, outer: 2 };

async function exists(p: string) { try { await access(p); return true; } catch { return false; } }
async function garmentBytes(id: string) { return readFile(path.join(GARMENTS_DIR, `${id}.jpg`)); }
async function reupload(url: string) {
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  return uploadFile(bytes, "step.jpg");
}

// Render a full look onto the user's photo. Dress -> single full_body render.
// Otherwise: composite uppers into one layered reference, render it (upper_body),
// then chain the bottom (lower_body) onto that result. Each sub-step is Phase-0 proven.
export async function POST(req: NextRequest) {
  try {
    const { photoBase64, itemIds } = await req.json();
    if (!photoBase64 || !Array.isArray(itemIds) || itemIds.length === 0)
      return NextResponse.json({ error: "photoBase64 and itemIds[] required" }, { status: 400 });

    const items = (itemIds as string[]).map((id) => (catalog as Item[]).find((c) => c.id === id)).filter(Boolean) as Item[];
    if (items.length !== itemIds.length) return NextResponse.json({ error: "unknown item in look" }, { status: 400 });

    const dress = items.find((i) => i.slot === "dress");
    const bottom = items.find((i) => i.slot === "bottom" || i.category === "bottom");
    const uppers = items
      .filter((i) => i.slot === "top" || i.slot === "outerwear" || i.category === "upper")
      .sort((a, b) => (LAYER_RANK[a.layer ?? "base"] ?? 0) - (LAYER_RANK[b.layer ?? "base"] ?? 0));

    const steps: string[] = [];
    const photoBytes = Buffer.from(String(photoBase64).split(",").pop() as string, "base64");
    const key = crypto.createHash("sha1").update(photoBytes).update([...itemIds].sort().join(",")).digest("hex").slice(0, 16);
    await mkdir(RESULTS_DIR, { recursive: true });

    // Mock mode (no credits): show the layered reference we *would* render, so UI/flow works free.
    if (process.env.MOCK === "1" || !process.env.PERFECTCORP_KEY) {
      let preview: Buffer;
      if (dress) preview = await garmentBytes(dress.id);
      else if (uppers.length >= 2) preview = await buildUpperCollage(uppers.map((u) => u.id));
      else preview = await garmentBytes((uppers[0] ?? bottom)!.id);
      const file = path.join(RESULTS_DIR, `mock-${key}.jpg`);
      await writeFile(file, preview);
      return NextResponse.json({ resultUrl: `/results/mock-${key}.jpg`, mock: true, steps: ["collage-preview (mock)"] });
    }

    const cached = path.join(RESULTS_DIR, `${key}.jpg`);
    if (await exists(cached)) return NextResponse.json({ resultUrl: `/results/${key}.jpg`, cached: true, steps: ["cache"] });

    const srcId = await uploadFile(await toJpeg(photoBytes), "user.jpg");
    let finalUrl: string;

    if (dress) {
      const refId = await uploadFile(await garmentBytes(dress.id), "dress.jpg");
      finalUrl = await pollCloth(await runCloth({ src_file_id: srcId, ref_file_id: refId, garment_category: "full_body" }));
      steps.push("full_body:dress");
    } else {
      // 1) uppers -> one layered reference -> upper_body render
      const upperRef = uppers.length >= 2 ? await buildUpperCollage(uppers.map((u) => u.id)) : await garmentBytes(uppers[0]!.id);
      const upperRefId = await uploadFile(upperRef, "upper.jpg");
      let cur = await pollCloth(await runCloth({ src_file_id: srcId, ref_file_id: upperRefId, garment_category: "upper_body" }));
      steps.push(uppers.length >= 2 ? `upper_body:collage(${uppers.length})` : "upper_body:single");
      // 2) chain the bottom onto the upper result
      if (bottom) {
        const bottomSrc = await reupload(cur);
        const bottomRefId = await uploadFile(await garmentBytes(bottom.id), "bottom.jpg");
        cur = await pollCloth(await runCloth({ src_file_id: bottomSrc, ref_file_id: bottomRefId, garment_category: "lower_body" }));
        steps.push("lower_body:bottom");
      }
      finalUrl = cur;
    }

    const bytes = Buffer.from(await (await fetch(finalUrl)).arrayBuffer());
    await writeFile(cached, bytes);
    return NextResponse.json({ resultUrl: `/results/${key}.jpg`, steps });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
