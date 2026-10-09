import { NextRequest, NextResponse } from "next/server";
import { recommend, type Item, type StylePreferences } from "@/lib/recommend";

export const runtime = "nodejs";

// Back-compatible fixed-catalog endpoint.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const anchors = [...(sp.get("anchors")?.split(",") ?? []), ...sp.getAll("anchor")].map((s) => s.trim()).filter(Boolean);
  return NextResponse.json({ anchors, looks: recommend(anchors, 3) });
}

// Dynamic wardrobe endpoint. Uploaded items and preferences participate in the
// same deterministic constructor; five candidates are returned for AI reranking.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { anchors?: string[]; wardrobeItems?: Item[]; preferences?: StylePreferences };
    const anchors = Array.isArray(body.anchors) ? body.anchors.slice(0, 12) : [];
    const wardrobeItems = Array.isArray(body.wardrobeItems) ? body.wardrobeItems.slice(0, 60) : [];
    const looks = recommend(anchors, 3, { extraItems: wardrobeItems, preferences: body.preferences, candidateLimit: 5 });
    return NextResponse.json({ anchors, looks });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
