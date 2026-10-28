import { NextRequest, NextResponse } from "next/server";
import { uploadToStorage, signedUrl, deleteFromStorage } from "@/lib/storage";
import { toJpeg } from "@/lib/youcam";
import { createClient } from "@/lib/supabase/server";
import { dbDeleteAvatar, dbInsertAvatar } from "@/lib/db";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let uploadedPath: string | null = null;
  let insertedId: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (data.user.is_anonymous) {
      return NextResponse.json({ error: "Permanent account required for cloud storage." }, { status: 403 });
    }
    const userId = data.user.id;

    const body = await req.json() as { imageBase64?: string; avatarId?: string };
    if (!body.imageBase64 || !body.avatarId || !UUID_RE.test(body.avatarId)) {
      return NextResponse.json({ error: "imageBase64 and avatarId required." }, { status: 400 });
    }

    const raw = Buffer.from(body.imageBase64.split(",").pop()!, "base64");
    const jpeg = await toJpeg(raw);
    const storagePath = `${userId}/${body.avatarId}.jpg`;

    await uploadToStorage("avatars", storagePath, jpeg, "image/jpeg");
    uploadedPath = storagePath;
    // Complete the metadata write before issuing the URL. If either later step
    // fails, the catch block removes both sides of this upload transaction.
    await dbInsertAvatar(supabase, body.avatarId, storagePath, userId);
    insertedId = body.avatarId;
    const url = await signedUrl("avatars", storagePath);

    return NextResponse.json({ storagePath, signedUrl: url });
  } catch (err) {
    // Storage and metadata must not diverge when signing or DB persistence fails.
    if (insertedId) await dbDeleteAvatar(await createClient(), insertedId).catch(() => {});
    if (uploadedPath) await deleteFromStorage("avatars", uploadedPath).catch(() => {});
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
