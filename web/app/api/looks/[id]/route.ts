import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbDeleteSavedLook } from "@/lib/db";
import { deleteFromStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { id } = await params;
    const { data: look } = await supabase.from("saved_looks").select("preview_path").eq("id", id).maybeSingle();
    await dbDeleteSavedLook(supabase, id);
    if (look?.preview_path) await deleteFromStorage("look-previews", look.preview_path as string).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
