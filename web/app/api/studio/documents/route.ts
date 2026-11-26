import { NextRequest, NextResponse } from "next/server";
import { requirePermanentStudioUser } from "@/lib/studio/server-auth";
import { parseOwnedStudioDocument } from "@/lib/studio/server-document";
import { listCloudStudioDocuments, saveCloudStudioDocument } from "@/lib/studio/server-persistence";
import { studioApiError } from "@/lib/studio/server-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { supabase } = await requirePermanentStudioUser();
    const documents = await listCloudStudioDocuments(supabase);
    return NextResponse.json({ documents });
  } catch (error) {
    return studioApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requirePermanentStudioUser();
    const body = await request.json() as { document?: unknown };
    const document = parseOwnedStudioDocument(body.document, user.id);
    if (document.revision !== 0) {
      return NextResponse.json({ error: "New outfit documents must start at revision zero." }, { status: 400 });
    }
    const saved = await saveCloudStudioDocument(supabase, document, "draft");
    return NextResponse.json({ document: saved }, { status: 201 });
  } catch (error) {
    return studioApiError(error);
  }
}
