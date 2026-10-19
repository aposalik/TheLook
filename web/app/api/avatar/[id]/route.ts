import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage } from "@/lib/storage";
import { dbDeleteAvatar } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { id } = await params;

    // Fetch storage path from DB if available, fallback to standard path
    const { data: avRow } = await supabase
      .from("avatars")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", data.user.id)
      .maybeSingle();

    const storagePath = avRow?.storage_path ?? `${data.user.id}/${id}.jpg`;

    await dbDeleteAvatar(supabase, id);
    await deleteFromStorage("avatars", storagePath);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
