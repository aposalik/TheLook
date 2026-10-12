import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbListSavedLooks, dbInsertSavedLook } from "@/lib/db";
import type { Item } from "@/lib/recommend";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const looks = await dbListSavedLooks(supabase);
    return NextResponse.json({ looks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const body = await req.json() as {
      id: string;
      renderPath: string | null;
      formula: string;
      stylistTitle?: string;
      cohesion?: number;
      reason?: string;
      items: Item[];
    };

    await dbInsertSavedLook(supabase, data.user.id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
