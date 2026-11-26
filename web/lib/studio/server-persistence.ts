import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutfitStudioDocument, StudioDocumentStatus } from "./document";
import { documentToRpcParams, rowsToStudioDocument, type StudioDocumentRow } from "./persistence";

const DOCUMENT_SELECT = `
  id,
  user_id,
  title,
  schema_version,
  aspect_ratio,
  background,
  revision,
  status,
  created_at,
  updated_at,
  outfit_document_nodes (
    id,
    wardrobe_item_id,
    catalog_item_id,
    wearing_role,
    transform,
    z_index,
    item_snapshot
  )
`;

export class StudioPersistenceError extends Error {
  constructor(
    message: string,
    readonly kind: "conflict" | "not_found" | "invalid" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "StudioPersistenceError";
  }
}

function persistenceError(message: string): StudioPersistenceError {
  if (message.includes("revision_conflict")) return new StudioPersistenceError("This outfit changed in another tab.", "conflict");
  if (message.includes("wardrobe_item_not_owned")) return new StudioPersistenceError("The outfit contains a wardrobe item you do not own.", "invalid");
  if (message.includes("invalid_") || message.includes("node_limit") || message.includes("out_of_bounds")) {
    return new StudioPersistenceError("The outfit document is malformed.", "invalid");
  }
  return new StudioPersistenceError(message, "unknown");
}

export async function listCloudStudioDocuments(supabase: SupabaseClient): Promise<OutfitStudioDocument[]> {
  const { data, error } = await supabase
    .from("outfit_documents")
    .select(DOCUMENT_SELECT)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) throw persistenceError(error.message);
  return ((data ?? []) as unknown as StudioDocumentRow[]).map(rowsToStudioDocument);
}

export async function getCloudStudioDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<OutfitStudioDocument> {
  const { data, error } = await supabase
    .from("outfit_documents")
    .select(DOCUMENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw persistenceError(error.message);
  if (!data) throw new StudioPersistenceError("Outfit document not found.", "not_found");
  return rowsToStudioDocument(data as unknown as StudioDocumentRow);
}

export async function saveCloudStudioDocument(
  supabase: SupabaseClient,
  document: OutfitStudioDocument,
  status: StudioDocumentStatus = document.status,
): Promise<OutfitStudioDocument> {
  const { error } = await supabase.rpc("save_outfit_document", documentToRpcParams(document, status));
  if (error) throw persistenceError(error.message);
  return getCloudStudioDocument(supabase, document.id);
}

export async function saveManualStudioLook(
  supabase: SupabaseClient,
  document: OutfitStudioDocument,
  lookId: string,
  previewPath: string | null,
): Promise<OutfitStudioDocument> {
  const params = documentToRpcParams(document, "saved");
  const { error } = await supabase.rpc("save_manual_look", {
    p_look_id: lookId,
    p_document_id: params.p_document_id,
    p_title: params.p_title,
    p_schema_version: params.p_schema_version,
    p_aspect_ratio: params.p_aspect_ratio,
    p_background: params.p_background,
    p_expected_revision: params.p_expected_revision,
    p_nodes: params.p_nodes,
    p_preview_path: previewPath,
  });
  if (error) throw persistenceError(error.message);
  return getCloudStudioDocument(supabase, document.id);
}

export async function deleteCloudStudioDocument(supabase: SupabaseClient, id: string): Promise<void> {
  const { error, count } = await supabase
    .from("outfit_documents")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw persistenceError(error.message);
  if (count === 0) throw new StudioPersistenceError("Outfit document not found.", "not_found");
}
