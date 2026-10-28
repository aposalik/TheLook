import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage } from "@/lib/storage";
import { dbDeleteWardrobeItem } from "@/lib/db";
import { normalizeGarmentSemantics } from "@/lib/recommend";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { id } = await params;
    const body = await req.json() as { slots?: string[]; category?: string; layer?: string | null; styles?: string[]; semantics?: unknown };
    const cleanStyles = (body.styles ?? []).filter((s) => !s.startsWith("slot:"));
    const slotTags = (body.slots ?? []).map((s) => `slot:${s}`);

    const { error: updateErr } = await supabase
      .from("wardrobe_items")
      .update({
        ...(body.category ? { category: body.category } : {}),
        ...(body.layer !== undefined ? { layer: body.layer } : {}),
        ...(body.semantics !== undefined ? { semantics: normalizeGarmentSemantics(body.semantics) } : {}),
        styles: [...cleanStyles, ...slotTags],
      })
      .eq("id", id)
      .eq("user_id", data.user.id);

    if (updateErr) throw new Error(updateErr.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { id } = await params;
    const storagePath = `${data.user.id}/${id}.png`;

    await dbDeleteWardrobeItem(supabase, id);
    await deleteFromStorage("wardrobe", storagePath);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
