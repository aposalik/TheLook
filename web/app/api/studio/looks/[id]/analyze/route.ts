import { NextRequest, NextResponse } from "next/server";
import { analyzeManualLook } from "@/lib/studio/analysis";
import { requirePermanentStudioUser } from "@/lib/studio/server-auth";
import { parseOwnedStudioDocument } from "@/lib/studio/server-document";
import { StudioPersistenceError } from "@/lib/studio/server-persistence";
import { studioApiError } from "@/lib/studio/server-response";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requirePermanentStudioUser();
    const body = await request.json() as { document?: unknown };
    const document = parseOwnedStudioDocument(body.document, user.id);
    const { data: look, error: lookError } = await supabase
      .from("saved_looks").select("id, outfit_document_id").eq("id", id).maybeSingle();
    if (lookError) throw new StudioPersistenceError(lookError.message);
    if (!look || look.outfit_document_id !== document.id) throw new StudioPersistenceError("Manual Look not found.", "not_found");
    const analysis = analyzeManualLook(document);
    const { error } = await supabase.from("look_analyses").upsert({
      look_id: id, user_id: user.id, engine_version: analysis.engineVersion, deterministic: analysis,
    }, { onConflict: "look_id,engine_version" });
    if (error) throw new StudioPersistenceError(error.message);
    await supabase.from("saved_looks").update({ analysis_status: "complete", analysis_version: analysis.engineVersion }).eq("id", id);
    return NextResponse.json({ analysis });
  } catch (error) { return studioApiError(error); }
}
