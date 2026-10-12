import { NextRequest, NextResponse } from "next/server";
import { uploadToStorage, signedUrl } from "@/lib/storage";
import { toJpeg } from "@/lib/youcam";
import { createClient } from "@/lib/supabase/server";
import { dbInsertAvatar } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Avatars are uploaded by any authenticated user (guest or verified).
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const userId = data.user.id;

    const body = await req.json() as { imageBase64?: string; avatarId?: string };
    if (!body.imageBase64 || !body.avatarId) {
      return NextResponse.json({ error: "imageBase64 and avatarId required." }, { status: 400 });
    }

    const raw = Buffer.from(body.imageBase64.split(",").pop()!, "base64");
    const jpeg = await toJpeg(raw);
    const storagePath = `${userId}/${body.avatarId}.jpg`;

    await uploadToStorage("avatars", storagePath, jpeg, "image/jpeg");
    await dbInsertAvatar(supabase, body.avatarId, storagePath);
    const url = await signedUrl("avatars", storagePath);

    return NextResponse.json({ storagePath, signedUrl: url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
