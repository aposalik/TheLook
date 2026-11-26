import {
  parseStudioDocument,
  type OutfitStudioDocument,
  type StudioDocumentNode,
  type StudioDocumentStatus,
  type StudioItemSnapshot,
} from "./document";

export type StudioDocumentRpcParams = {
  p_document_id: string;
  p_title: string;
  p_schema_version: number;
  p_aspect_ratio: string;
  p_background: OutfitStudioDocument["background"];
  p_expected_revision: number;
  p_status: StudioDocumentStatus;
  p_nodes: StudioDocumentNode[];
};

export type StudioNodeRow = {
  id: string;
  wardrobe_item_id: string | null;
  catalog_item_id: string | null;
  wearing_role: string;
  transform: Record<string, unknown>;
  z_index: number;
  item_snapshot: Record<string, unknown>;
};

export type StudioDocumentRow = {
  id: string;
  user_id: string;
  title: string;
  schema_version: number;
  aspect_ratio: string;
  background: unknown;
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
  outfit_document_nodes?: StudioNodeRow[] | null;
};

export function documentToRpcParams(
  document: OutfitStudioDocument,
  status: StudioDocumentStatus = document.status,
): StudioDocumentRpcParams {
  const safe = parseStudioDocument(document);
  return {
    p_document_id: safe.id,
    p_title: safe.title,
    p_schema_version: safe.schemaVersion,
    p_aspect_ratio: safe.aspectRatio,
    p_background: safe.background,
    p_expected_revision: safe.revision,
    p_status: status,
    p_nodes: safe.nodes,
  };
}

function numberValue(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" ? value : Number.NaN;
}

function booleanValue(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

export function rowsToStudioDocument(row: StudioDocumentRow): OutfitStudioDocument {
  const nodes: StudioDocumentNode[] = ((row.outfit_document_nodes ?? []) as StudioNodeRow[])
    .slice()
    .sort((a, b) => a.z_index - b.z_index)
    .map((node) => {
      const snapshot = { ...node.item_snapshot };
      delete snapshot.image;
      return {
        id: node.id,
        itemId: node.wardrobe_item_id ?? node.catalog_item_id ?? "",
        itemSource: node.wardrobe_item_id ? "user" as const : "catalog" as const,
        itemSnapshot: snapshot as StudioItemSnapshot,
        x: numberValue(node.transform, "x"),
        y: numberValue(node.transform, "y"),
        width: numberValue(node.transform, "width"),
        height: numberValue(node.transform, "height"),
        rotation: numberValue(node.transform, "rotation"),
        zIndex: node.z_index,
        opacity: numberValue(node.transform, "opacity"),
        flipX: booleanValue(node.transform, "flipX") ?? false,
        locked: booleanValue(node.transform, "locked") ?? false,
        wearingRole: node.wearing_role as StudioDocumentNode["wearingRole"],
      };
    });

  return parseStudioDocument({
    schemaVersion: row.schema_version,
    id: row.id,
    ownerId: row.user_id,
    title: row.title,
    aspectRatio: row.aspect_ratio,
    background: row.background,
    nodes,
    revision: row.revision,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
