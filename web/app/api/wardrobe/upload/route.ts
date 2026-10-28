import { NextRequest, NextResponse } from "next/server";
import { uploadToStorage, signedUrl, deleteFromStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { dbDeleteWardrobeItem, dbInsertWardrobeItem } from "@/lib/db";
import type { Item } from "@/lib/recommend";

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

    const body = await req.json() as { imageBase64?: string; itemId?: string; item?: Item };
    if (!body.imageBase64 || !body.itemId) {
      return NextResponse.json({ error: "imageBase64 and itemId required." }, { status: 400 });
    }

    // public.wardrobe_items requires id to be a valid UUID and storage_path to
    // remain exactly under the authenticated user's folder.
    if (!UUID_RE.test(body.itemId)) {
      return NextResponse.json({ error: "Invalid wardrobe item ID." }, { status: 400 });
    }
    const itemId = body.itemId;
    const raw = Buffer.from(body.imageBase64.split(",").pop()!, "base64");
    const storagePath = `${userId}/${itemId}.png`;

    await uploadToStorage("wardrobe", storagePath, raw, "image/png");
    uploadedPath = storagePath;

    if (body.item) {
      await dbInsertWardrobeItem(supabase, { ...body.item, id: itemId }, storagePath, userId);
      insertedId = itemId;
    }
    const url = await signedUrl("wardrobe", storagePath);

    return NextResponse.json({ itemId, storagePath, signedUrl: url });
  } catch (err) {
    if (insertedId) await dbDeleteWardrobeItem(await createClient(), insertedId).catch(() => {});
    if (uploadedPath) await deleteFromStorage("wardrobe", uploadedPath).catch(() => {});
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
