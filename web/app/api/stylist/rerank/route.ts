import { NextRequest, NextResponse } from "next/server";
import { critiqueAndRerankCandidates, type CriticRequest } from "@/lib/stylist-critic";

export const runtime = "nodejs";

// Stage 2: Gemini Vision acts strictly as a visual critic/reranker over
// deterministic Stage 1 candidates (never composing or mutating outfits).
export async function POST(req: NextRequest) {
  let body: CriticRequest;
  try {
    body = (await req.json()) as CriticRequest;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid JSON request body" },
      { status: 400 },
    );
  }

  const result = await critiqueAndRerankCandidates(body ?? {});
  return NextResponse.json(result);
}
