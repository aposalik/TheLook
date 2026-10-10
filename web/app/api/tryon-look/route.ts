import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { uploadFile, runCloth, pollCloth, toJpeg } from "@/lib/youcam";
import { buildUpperCollage } from "@/lib/collage";
import catalog from "@/data/catalog.json";
import type { Item } from "@/lib/recommend";

export const runtime = "nodejs";
const RESULTS_DIR = path.join(process.cwd(), "public", "results");
const GARMENTS_DIR = path.join(process.cwd(), "public", "garments");
const LAYER_RANK: Record<string, number> = { base: 0, mid: 1, outer: 2 };

async function exists(p: string) { try { await access(p); return true; } catch { return false; } }
async function itemBytes(item: Item): Promise<Buffer> {
  if (item.image?.startsWith("data:image/")) {
    const bytes = Buffer.from(item.image.split(",").pop()!, "base64");
    if (bytes.length > 8_000_000) throw new Error("Uploaded garment is too large");
    return toJpeg(bytes);
  }
  return readFile(path.join(GARMENTS_DIR, `${item.id}.jpg`));
}
async function reupload(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download intermediate render (${response.status})`);
  return uploadFile(Buffer.from(await response.arrayBuffer()), "step.jpg");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { photoBase64?: string; itemIds?: string[]; items?: Item[] };
    if (!body.photoBase64) return NextResponse.json({ error: "photoBase64 required" }, { status: 400 });
    const supplied = Array.isArray(body.items) ? body.items.slice(0, 12) : [];
    const byId = new Map<string, Item>([...(catalog as Item[]), ...supplied].map((item) => [item.id, item]));
    const itemIds = Array.isArray(body.itemIds) && body.itemIds.length ? body.itemIds : supplied.map((item) => item.id);
    const items = itemIds.map((id) => byId.get(id)).filter(Boolean) as Item[];
    if (!items.length || items.length !== itemIds.length) return NextResponse.json({ error: "unknown item in look" }, { status: 400 });

    const renderable = items.filter((item) => !["shoe", "accessory"].includes(item.category ?? item.slot));
    const dress = renderable.find((i) => i.slot === "dress" || i.category === "dress");
    const bottom = renderable.find((i) => i.slot === "bottom" || i.category === "bottom");
    const uppers = renderable
      .filter((i) => i.slot === "top" || i.slot === "outerwear" || i.category === "upper")
      .sort((a, b) => (LAYER_RANK[a.layer ?? "base"] ?? 0) - (LAYER_RANK[b.layer ?? "base"] ?? 0));
    if (!dress && !bottom && !uppers.length) return NextResponse.json({ error: "The look has no renderable clothing" }, { status: 400 });

    const photoBytes = Buffer.from(body.photoBase64.split(",").pop()!, "base64");
    const itemFingerprint = items.map((item) => `${item.id}:${crypto.createHash("sha1").update(item.image || "").digest("hex").slice(0, 8)}`).sort().join("|");
    const key = crypto.createHash("sha1").update(photoBytes).update(itemFingerprint).digest("hex").slice(0, 16);
    await mkdir(RESULTS_DIR, { recursive: true });

    if (process.env.MOCK === "1" || !process.env.PERFECTCORP_KEY) {
      const preview = dress ? await itemBytes(dress)
        : uppers.length >= 2 ? await buildUpperCollage(uppers)
        : await itemBytes((uppers[0] ?? bottom)!);
      const file = path.join(RESULTS_DIR, `mock-${key}.jpg`);
      await writeFile(file, preview);
      return NextResponse.json({ resultUrl: `/results/mock-${key}.jpg`, mock: true, steps: ["reference-preview (mock)"] });
    }

    const cached = path.join(RESULTS_DIR, `${key}.jpg`);
    if (await exists(cached)) return NextResponse.json({ resultUrl: `/results/${key}.jpg`, cached: true, steps: ["cache"] });

    const srcId = await uploadFile(await toJpeg(photoBytes), "user.jpg");
    const steps: string[] = [];
    let finalUrl: string;
    if (dress) {
      const refId = await uploadFile(await itemBytes(dress), "dress.jpg");
      finalUrl = await pollCloth(await runCloth({ src_file_id: srcId, ref_file_id: refId, garment_category: "full_body" }));
      steps.push("full_body:dress");
    } else {
      let currentUrl: string | null = null;
      if (uppers.length) {
        const upperRef = uppers.length >= 2 ? await buildUpperCollage(uppers) : await itemBytes(uppers[0]!);
        const refId = await uploadFile(upperRef, "upper.jpg");
        currentUrl = await pollCloth(await runCloth({ src_file_id: srcId, ref_file_id: refId, garment_category: "upper_body" }));
        steps.push(uppers.length >= 2 ? `upper_body:collage(${uppers.length})` : "upper_body:single");
      }
      if (bottom) {
        const sourceId = currentUrl ? await reupload(currentUrl) : srcId;
        const refId = await uploadFile(await itemBytes(bottom), "bottom.jpg");
        currentUrl = await pollCloth(await runCloth({ src_file_id: sourceId, ref_file_id: refId, garment_category: "lower_body" }));
        steps.push("lower_body:bottom");
      }
      finalUrl = currentUrl!;
    }

    const response = await fetch(finalUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not persist render (${response.status})`);
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
    return NextResponse.json({ resultUrl: `/results/${key}.jpg`, steps });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
