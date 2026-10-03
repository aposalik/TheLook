import { NextRequest, NextResponse } from "next/server";
import { recommend } from "@/lib/recommend";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const anchor = req.nextUrl.searchParams.get("anchor") ?? undefined;
  const looks = recommend(anchor, 3);
  return NextResponse.json({ anchor: anchor ?? null, looks });
}
