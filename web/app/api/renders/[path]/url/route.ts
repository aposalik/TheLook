import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { path } = await params;
    const storagePath = decodeURIComponent(path);
    // Verify the path belongs to this user
    if (!storagePath.startsWith(`${data.user.id}/`)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const url = await signedUrl("renders", storagePath);
    return NextResponse.json({ signedUrl: url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
