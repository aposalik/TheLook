import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";

export const runtime = "nodejs";

const RENDER_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[A-Za-z0-9_-]+\.jpg$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string }> }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { path } = await params;
    const storagePath = decodeURIComponent(path);
    // Verify the path belongs to this user
    if (!RENDER_PATH_RE.test(storagePath) || !storagePath.startsWith(`${data.user.id}/`)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const url = await signedUrl("renders", storagePath);
    return NextResponse.json({ signedUrl: url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
