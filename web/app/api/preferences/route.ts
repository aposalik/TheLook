import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbUpsertPreferences } from "@/lib/db";
import type { StylePreferences } from "@/lib/recommend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const prefs = await req.json() as StylePreferences;
    await dbUpsertPreferences(supabase, data.user.id, prefs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
