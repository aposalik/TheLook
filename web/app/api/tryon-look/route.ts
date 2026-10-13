import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { uploadFile, runCloth, pollCloth, toJpeg } from "@/lib/youcam";
import { buildUpperCollage } from "@/lib/collage";
import { uploadToStorage, signedUrl } from "@/lib/storage";
import { reserveQuota, completeJob, failJob, hashIp, trustedIp } from "@/lib/quota";
import catalog from "@/data/catalog.json";
import type { Item } from "@/lib/recommend";
import { requireVerifiedAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbInsertAvatar } from "@/lib/db";

export const runtime = "nodejs";
const GARMENTS_DIR = path.join(process.cwd(), "public", "garments");
const LAYER_RANK: Record<string, number> = { base: 0, mid: 1, outer: 2 };

async function itemBytes(item: Item): Promise<Buffer> {
  if (item.image?.startsWith("data:image/")) {
    const bytes = Buffer.from(item.image.split(",").pop()!, "base64");
    if (bytes.length > 8_000_000) throw new Error("Uploaded garment is too large");
    return toJpeg(bytes);
  }
  if (item.image?.startsWith("http://") || item.image?.startsWith("https://")) {
    const res = await fetch(item.image);
    if (!res.ok) throw new Error(`Could not fetch garment image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return toJpeg(buf);
  }
  return readFile(path.join(GARMENTS_DIR, `${item.id}.jpg`));
}
async function reupload(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download intermediate render (${response.status})`);
  return uploadFile(Buffer.from(await response.arrayBuffer()), "step.jpg");
}

export async function POST(req: NextRequest) {
  const auth = await requireVerifiedAccount();
  if (auth.response) return auth.response;
  const userId = auth.user!.id;

  let jobId: string | null = null;

  try {
    const body = await req.json() as { photoBase64?: string; itemIds?: string[]; items?: Item[]; avatarId?: string };
    if (!body.photoBase64) return NextResponse.json({ error: "photoBase64 required" }, { status: 400 });

    const supplied = Array.isArray(body.items) ? body.items.slice(0, 12) : [];
    const byId = new Map<string, Item>([...(catalog as Item[]), ...supplied].map((item) => [item.id, item]));
    const itemIds = Array.isArray(body.itemIds) && body.itemIds.length ? body.itemIds : supplied.map((i) => i.id);
    const items = itemIds.map((id) => byId.get(id)).filter(Boolean) as Item[];
    if (!items.length || items.length !== itemIds.length) {
      return NextResponse.json({ error: "unknown item in look" }, { status: 400 });
    }

    const renderable = items.filter((i) => !["shoe", "accessory"].includes(i.category ?? i.slot));
    const dress = renderable.find((i) => i.slot === "dress" || i.category === "dress");
    const bottom = renderable.find((i) => i.slot === "bottom" || i.category === "bottom");
    const uppers = renderable
      .filter((i) => i.slot === "top" || i.slot === "outerwear" || i.category === "upper")
      .sort((a, b) => (LAYER_RANK[a.layer ?? "base"] ?? 0) - (LAYER_RANK[b.layer ?? "base"] ?? 0));
    if (!dress && !bottom && !uppers.length) {
      return NextResponse.json({ error: "The look has no renderable clothing" }, { status: 400 });
    }

    const photoBytes = Buffer.from(body.photoBase64.split(",").pop()!, "base64");
    const itemFingerprint = items
      .map((i) => `${i.id}:${crypto.createHash("sha1").update(i.image || "").digest("hex").slice(0, 8)}`)
      .sort().join("|");
    // SHA-256 (64 hex chars) to satisfy the render_jobs fingerprint constraint
    const fingerprint = crypto.createHash("sha256")
      .update(photoBytes).update(itemFingerprint).digest("hex");
    const renderPath = `${userId}/${fingerprint.slice(0, 16)}.jpg`;

    // Mock mode — skip quota, write to Storage, return signed URL
    if (process.env.MOCK === "1" || !process.env.PERFECTCORP_KEY) {
      const preview = dress ? await itemBytes(dress)
        : uppers.length >= 2 ? await buildUpperCollage(uppers)
        : await itemBytes((uppers[0] ?? bottom)!);
      await uploadToStorage("renders", renderPath, await toJpeg(preview), "image/jpeg");
      const url = await signedUrl("renders", renderPath);
      return NextResponse.json({ resultUrl: url, mock: true, steps: ["reference-preview (mock)"] });
    }

    // Quota reservation — atomic check + insert render_job + increment counters
    // Ensure avatarId exists in public.avatars to satisfy render_jobs_avatar_id_user_id_fkey
    const supabase = await createClient();
    let avatarId: string = body.avatarId ?? "";
    let avatarValid = false;

    if (avatarId) {
      const { data: avRow } = await supabase
        .from("avatars")
        .select("id")
        .eq("id", avatarId)
        .eq("user_id", userId)
        .maybeSingle();
      if (avRow) avatarValid = true;
    }

    if (!avatarValid) {
      const { data: latestAv } = await supabase
        .from("avatars")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAv) {
        avatarId = latestAv.id;
      } else {
        avatarId = avatarId && avatarId !== "00000000-0000-0000-0000-000000000000"
          ? avatarId
          : crypto.randomUUID();
        const avatarPath = `${userId}/${avatarId}.jpg`;
        await uploadToStorage("avatars", avatarPath, await toJpeg(photoBytes), "image/jpeg");
        await dbInsertAvatar(supabase, avatarId, avatarPath, userId);
      }
    }

    const ipHash = hashIp(trustedIp(req));
    const quota = await reserveQuota(userId, fingerprint, ipHash, avatarId, items.map((i) => ({ id: i.id, slot: i.slot })));
    if (!quota.ok) {
      if (quota.reason === "cached" && quota.cachedPath) {
        const url = await signedUrl("renders", quota.cachedPath);
        return NextResponse.json({ resultUrl: url, cached: true, steps: ["cache"] });
      }
      if (quota.reason === "user_limit") {
        return NextResponse.json(
          { error: `Daily render limit reached. Resets at midnight UTC.`, remaining: 0 },
          { status: 429 },
        );
      }
      if (quota.reason === "global_budget") {
        return NextResponse.json({ error: "Service temporarily unavailable. Try again later." }, { status: 503 });
      }
      if (quota.reason === "disabled") {
        return NextResponse.json({ error: "Try-on rendering is temporarily disabled." }, { status: 503 });
      }
      if (quota.reason === "in_flight") {
        return NextResponse.json({ error: "A render for this look is already in progress." }, { status: 409 });
      }
      return NextResponse.json({ error: "Quota check failed." }, { status: 429 });
    }

    jobId = quota.jobId;

    // YouCam pipeline
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

    // Save result to private Storage + mark job complete
    const response = await fetch(finalUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not persist render (${response.status})`);
    const resultBytes = await toJpeg(Buffer.from(await response.arrayBuffer()));
    await uploadToStorage("renders", renderPath, resultBytes, "image/jpeg");
    await completeJob(jobId, renderPath, 1);

    const resultSignedUrl = await signedUrl("renders", renderPath);
    return NextResponse.json({ resultUrl: resultSignedUrl, steps, remaining: quota.remaining - 1 });

  } catch (error) {
    // Refund quota if a job was reserved but YouCam failed
    if (jobId) {
      const msg = error instanceof Error ? error.message : String(error);
      await failJob(jobId, "pipeline_error", msg).catch(() => {});
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
