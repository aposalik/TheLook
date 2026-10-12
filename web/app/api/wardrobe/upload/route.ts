import { NextRequest, NextResponse } from "next/server";
import { uploadToStorage, signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { dbInsertWardrobeItem } from "@/lib/db";
import type { Item } from "@/lib/recommend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const userId = data.user.id;

    const body = await req.json() as { imageBase64?: string; itemId?: string; item?: Item };
    if (!body.imageBase64 || !body.itemId) {
      return NextResponse.json({ error: "imageBase64 and itemId required." }, { status: 400 });
    }

    const raw = Buffer.from(body.imageBase64.split(",").pop()!, "base64");
    const storagePath = `${userId}/${body.itemId}.png`;

    await uploadToStorage("wardrobe", storagePath, raw, "image/png");
    if (body.item) await dbInsertWardrobeItem(supabase, body.item, storagePath);
    const url = await signedUrl("wardrobe", storagePath);

    return NextResponse.json({ storagePath, signedUrl: url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
