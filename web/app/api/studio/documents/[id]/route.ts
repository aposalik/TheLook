import { NextRequest, NextResponse } from "next/server";
import { requirePermanentStudioUser } from "@/lib/studio/server-auth";
import { parseOwnedStudioDocument } from "@/lib/studio/server-document";
import {
  deleteCloudStudioDocument,
  getCloudStudioDocument,
  saveCloudStudioDocument,
  StudioPersistenceError,
} from "@/lib/studio/server-persistence";
import { studioApiError } from "@/lib/studio/server-response";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { supabase } = await requirePermanentStudioUser();
    const document = await getCloudStudioDocument(supabase, id);
    return NextResponse.json({ document });
  } catch (error) {
    return studioApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { supabase, user } = await requirePermanentStudioUser();
    const body = await request.json() as { document?: unknown };
    const document = parseOwnedStudioDocument(body.document, user.id);
    if (document.id !== id) throw new StudioPersistenceError("Document id does not match the route.", "invalid");
    const saved = await saveCloudStudioDocument(supabase, document);
    return NextResponse.json({ document: saved });
  } catch (error) {
    return studioApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { supabase } = await requirePermanentStudioUser();
    await deleteCloudStudioDocument(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return studioApiError(error);
  }
}
