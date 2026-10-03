import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { uploadFile, runCloth, pollCloth, type ClothParams } from "@/lib/youcam";
import catalog from "@/data/catalog.json";

export const runtime = "nodejs";

type Item = { id: string; slot: string; title: string; image: string };
const SLOT_TO_CATEGORY: Record<string, ClothParams["garment_category"]> = {
  top: "upper_body", outerwear: "upper_body", bottom: "lower_body", dress: "full_body",
};

const RESULTS_DIR = path.join(process.cwd(), "public", "results");

async function exists(p: string) { try { await access(p); return true; } catch { return false; } }

export async function POST(req: NextRequest) {
  try {
    const { photoBase64, garmentId } = await req.json();
    if (!photoBase64 || !garmentId) return NextResponse.json({ error: "photoBase64 and garmentId required" }, { status: 400 });

    const item = (catalog as Item[]).find((c) => c.id === garmentId);
    if (!item) return NextResponse.json({ error: `unknown garment ${garmentId}` }, { status: 400 });
    const category = SLOT_TO_CATEGORY[item.slot] ?? "upper_body";

    const photoBytes = Buffer.from(String(photoBase64).split(",").pop() as string, "base64");

    // Mock mode (no credits): return both the user photo and garment for a split preview.
    if (process.env.MOCK === "1" || !process.env.PERFECTCORP_KEY) {
      const photoDataUrl = `data:image/jpeg;base64,${photoBytes.toString("base64")}`;
      return NextResponse.json({ resultUrl: item.image, photoDataUrl, garmentTitle: item.title, category, mock: true });
    }

    // Cache by (photo, garment) -> stored result image. Avoids re-spending credits (result URLs are short-TTL).
    const key = crypto.createHash("sha1").update(photoBytes).update(garmentId).digest("hex").slice(0, 16);
    await mkdir(RESULTS_DIR, { recursive: true });
    const cachedFile = path.join(RESULTS_DIR, `${key}.jpg`);
    if (await exists(cachedFile)) return NextResponse.json({ resultUrl: `/results/${key}.jpg`, category, cached: true });

    const srcId = await uploadFile(photoBytes, "user.jpg");
    const refBytes = await readFile(path.join(process.cwd(), "public", "garments", `${garmentId}.jpg`));
    const refId = await uploadFile(refBytes, `${garmentId}.jpg`);

    const taskId = await runCloth({ src_file_id: srcId, ref_file_id: refId, garment_category: category });
    const resultUrl = await pollCloth(taskId);

    const bytes = Buffer.from(await (await fetch(resultUrl)).arrayBuffer());
    await writeFile(cachedFile, bytes);
    return NextResponse.json({ resultUrl: `/results/${key}.jpg`, category });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
