import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { id } = await params;
    const url = await signedUrl("wardrobe", `${data.user.id}/${id}.png`);
    return NextResponse.json({ signedUrl: url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
