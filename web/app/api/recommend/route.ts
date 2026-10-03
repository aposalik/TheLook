import { NextRequest, NextResponse } from "next/server";
import { recommend } from "@/lib/recommend";

export const runtime = "nodejs";

// Accepts the selected items as ?anchors=a,b,c (preferred, multi-select),
// repeated ?anchor=a&anchor=b, or a single ?anchor=a (back-compat).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const anchors = [
    ...(sp.get("anchors")?.split(",") ?? []),
    ...sp.getAll("anchor"),
  ].map((s) => s.trim()).filter(Boolean);
  const looks = recommend(anchors, 3);
  return NextResponse.json({ anchors, looks });
}
