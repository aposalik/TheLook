import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { deleteFromStorage, signedUrl, uploadToStorage } from "@/lib/storage";
import { requirePermanentStudioUser } from "@/lib/studio/server-auth";
import { parseOwnedStudioDocument } from "@/lib/studio/server-document";
import { saveManualStudioLook, StudioPersistenceError } from "@/lib/studio/server-persistence";
import { studioApiError } from "@/lib/studio/server-response";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PREVIEW_BYTES = 10_000_000;

function decodePreview(value: unknown): Buffer | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new StudioPersistenceError("Preview must be a WebP data URL.", "invalid");
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new StudioPersistenceError("Preview must be a WebP data URL.", "invalid");
  const preview = Buffer.from(match[1]!, "base64");
  if (!preview.length || preview.length > MAX_PREVIEW_BYTES) {
    throw new StudioPersistenceError("Preview exceeds the 10 MB limit.", "invalid");
  }
  return preview;
}

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;
  try {
    const { supabase, user } = await requirePermanentStudioUser();
    const body = await request.json() as { document?: unknown; lookId?: unknown; previewDataUrl?: unknown };
    const document = parseOwnedStudioDocument(body.document, user.id);
    if (!document.nodes.length) throw new StudioPersistenceError("Add at least one garment before saving.", "invalid");
    if (typeof body.lookId !== "string" || !UUID_RE.test(body.lookId)) {
      throw new StudioPersistenceError("Look id must be a UUID.", "invalid");
    }
    const preview = decodePreview(body.previewDataUrl);

    const { data: existingLook, error: existingError } = await supabase
      .from("saved_looks")
      .select("preview_path")
      .eq("id", body.lookId)
      .maybeSingle();
    if (existingError) throw new StudioPersistenceError(existingError.message);
    const previousPath = existingLook?.preview_path as string | null | undefined;
    let previewPath = previousPath ?? null;
    let previewUploaded = false;

    if (preview) {
      uploadedPath = `${user.id}/${body.lookId}-${randomUUID()}.webp`;
      try {
        await uploadToStorage("look-previews", uploadedPath, preview, "image/webp");
        previewPath = uploadedPath;
        previewUploaded = true;
      } catch {
        uploadedPath = null;
      }
    }

    let savedDocument;
    try {
      savedDocument = await saveManualStudioLook(supabase, document, body.lookId, previewPath);
    } catch (error) {
      if (uploadedPath) await deleteFromStorage("look-previews", uploadedPath).catch(() => {});
      throw error;
    }

    if (uploadedPath && previousPath && previousPath !== uploadedPath) {
      await deleteFromStorage("look-previews", previousPath).catch(() => {});
    }

    let image = "";
    if (previewPath) image = await signedUrl("look-previews", previewPath).catch(() => "");

    return NextResponse.json({
      document: savedDocument,
      look: {
        id: body.lookId,
        image,
        previewPath,
        outfitDocumentId: savedDocument.id,
        origin: "manual",
        title: savedDocument.title,
      },
      previewUploaded,
    });
  } catch (error) {
    return studioApiError(error);
  }
}
