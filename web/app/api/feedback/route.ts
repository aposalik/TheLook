import { NextRequest, NextResponse } from "next/server";
import { normalizeOutfitFeedback } from "@/lib/outfit-feedback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await supabase
    .from("outfit_feedback")
    .select("id, signal, item_ids, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const feedback = normalizeOutfitFeedback((data ?? []).map((row) => ({
    id: row.id,
    signal: row.signal,
    itemIds: row.item_ids,
    createdAt: new Date(row.created_at).getTime(),
  })));
  return NextResponse.json({ feedback });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const [event] = normalizeOutfitFeedback([await req.json()]);
  if (!event) return NextResponse.json({ error: "Invalid feedback event." }, { status: 400 });
  const { error } = await supabase.from("outfit_feedback").insert({
    id: event.id,
    user_id: auth.user.id,
    signal: event.signal,
    item_ids: event.itemIds,
    created_at: new Date(event.createdAt).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
