import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { uploadFile, runCloth, pollCloth, toJpeg } from "@/lib/youcam";
import { buildUpperCollage } from "@/lib/collage";
import { uploadToStorage, signedUrl } from "@/lib/storage";
import { reserveQuota, completeJob, failJob, hashIp, trustedIp } from "@/lib/quota";
import catalog from "@/data/catalog.json";
import { isClosedOuterOrMid, type Item } from "@/lib/recommend";
import { partitionTryOnItems } from "@/lib/tryon-plan";
import { requireVerifiedAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbInsertAvatar } from "@/lib/db";

export const runtime = "nodejs";
const GARMENTS_DIR = path.join(process.cwd(), "public", "garments");
const RENDER_PIPELINE_VERSION = "v6-full-torso-length";

async function resolvePhotoBytes(photoInput: string): Promise<Buffer> {
  if (photoInput.startsWith("http://") || photoInput.startsWith("https://")) {
    const res = await fetch(photoInput, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Could not fetch avatar photo (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return Buffer.from(photoInput.split(",").pop()!, "base64");
}

async function itemBytes(item: Item): Promise<Buffer> {
  if (item.image?.startsWith("data:image/")) {
    const bytes = Buffer.from(item.image.split(",").pop()!, "base64");
    if (bytes.length > 8_000_000) throw new Error("Uploaded garment is too large");
    return toJpeg(bytes);
  }
  if (item.image?.startsWith("http://") || item.image?.startsWith("https://")) {
    const res = await fetch(item.image, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Could not fetch garment image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return toJpeg(buf);
  }
  return readFile(path.join(GARMENTS_DIR, `${item.id}.jpg`));
}
async function reupload(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
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

    const { renderable, styleOnly, dress, bottom, uppers } = partitionTryOnItems(items);
    if (!dress && !bottom && !uppers.length) {
      return NextResponse.json({ error: "The look has no renderable clothing" }, { status: 400 });
    }
    const renderDiagnostics = {
      pipelineVersion: RENDER_PIPELINE_VERSION,
      renderedItemIds: renderable.map((item) => item.id),
      styleOnlyItemIds: styleOnly.map((item) => item.id),
      upperReferenceItemIds: uppers.map((item) => item.id),
      layerWarning: uppers.length >= 2 && uppers.some((item) => (item.layer === "mid" || item.layer === "outer") && isClosedOuterOrMid(item))
        ? "A closed upper layer may visually cover the base garment."
        : null,
    };

    const rawPhotoBytes = await resolvePhotoBytes(body.photoBase64);
    const userJpeg = await toJpeg(rawPhotoBytes);
    const itemFingerprint = items
      .map((i) => `${i.id}:${crypto.createHash("sha1").update(i.image || "").digest("hex").slice(0, 8)}`)
      .sort().join("|");
    // SHA-256 (64 hex chars) to satisfy the render_jobs fingerprint constraint
    const fingerprint = crypto.createHash("sha256")
      .update(RENDER_PIPELINE_VERSION)
      .update(userJpeg)
      .update(itemFingerprint)
      .digest("hex");
    const renderPath = `${userId}/${fingerprint.slice(0, 16)}.jpg`;

    // Mock mode — skip quota, write to Storage, return signed URL
    if (process.env.MOCK === "1" || !process.env.PERFECTCORP_KEY) {
      const preview = dress ? await itemBytes(dress)
        : uppers.length >= 2 ? await buildUpperCollage(uppers)
        : await itemBytes((uppers[0] ?? bottom)!);
      await uploadToStorage("renders", renderPath, await toJpeg(preview), "image/jpeg");
      const url = await signedUrl("renders", renderPath);
      return NextResponse.json({ resultUrl: url, renderPath, mock: true, steps: ["reference-preview (mock)"], ...renderDiagnostics });
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
        await uploadToStorage("avatars", avatarPath, userJpeg, "image/jpeg");
        await dbInsertAvatar(supabase, avatarId, avatarPath, userId);
      }
    }

    const ipHash = hashIp(trustedIp(req));
    const quota = await reserveQuota(
      userId,
      fingerprint,
      ipHash,
      avatarId,
      items.map((i) => ({ id: i.id, slot: i.slot })),
      auth.user!.email,
    );
    if (!quota.ok) {
      if (quota.reason === "cached" && quota.cachedPath) {
        const url = await signedUrl("renders", quota.cachedPath);
        return NextResponse.json({ resultUrl: url, renderPath: quota.cachedPath, cached: true, steps: ["cache"], ...renderDiagnostics });
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

    // YouCam pipeline — pre-upload user photo and all garment references in parallel!
    const steps: string[] = [];
    let finalUrl: string;

    if (dress) {
      const [srcId, refId] = await Promise.all([
        uploadFile(userJpeg, "user.jpg"),
        itemBytes(dress).then((b) => uploadFile(b, "dress.jpg")),
      ]);
      finalUrl = await pollCloth(await runCloth({ src_file_id: srcId, ref_file_id: refId, garment_category: "full_body" }));
      steps.push("full_body:dress");
    } else {
      const [srcId, upperRefId, bottomRefId] = await Promise.all([
        uploadFile(userJpeg, "user.jpg"),
        uppers.length
          ? (uppers.length >= 2 ? buildUpperCollage(uppers) : itemBytes(uppers[0]!)).then((b) => uploadFile(b, "upper.jpg"))
          : Promise.resolve<string | null>(null),
        bottom
          ? itemBytes(bottom).then((b) => uploadFile(b, "bottom.jpg"))
          : Promise.resolve<string | null>(null),
      ]);

      let currentUrl: string | null = null;
      if (upperRefId) {
        currentUrl = await pollCloth(await runCloth({ src_file_id: srcId, ref_file_id: upperRefId, garment_category: "upper_body" }));
        steps.push(uppers.length >= 2 ? `upper_body:collage(${uppers.length})` : "upper_body:single");
      }
      if (bottomRefId) {
        const sourceId = currentUrl ? await reupload(currentUrl) : srcId;
        currentUrl = await pollCloth(await runCloth({ src_file_id: sourceId, ref_file_id: bottomRefId, garment_category: "lower_body" }));
        steps.push("lower_body:bottom");
      }
      finalUrl = currentUrl!;
    }

    // Save result to private Storage + mark job complete in parallel
    const response = await fetch(finalUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Could not persist render (${response.status})`);
    const resultBytes = await toJpeg(Buffer.from(await response.arrayBuffer()));
    const finalRenderPath = `${userId}/${jobId}.jpg`;
    await Promise.all([
      uploadToStorage("renders", finalRenderPath, resultBytes, "image/jpeg"),
      completeJob(jobId, finalRenderPath, 1),
    ]);

    const resultSignedUrl = await signedUrl("renders", finalRenderPath);
    return NextResponse.json({ resultUrl: resultSignedUrl, renderPath: finalRenderPath, steps, remaining: quota.remaining, ...renderDiagnostics });

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
