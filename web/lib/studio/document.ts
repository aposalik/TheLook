import type { Item } from "../recommend";
import {
  MAX_STUDIO_NODES,
  createEditorState,
  type StudioEditorState,
  type StudioNode,
} from "./editor";

export const STUDIO_SCHEMA_VERSION = 1 as const;
export const STUDIO_ASPECT_RATIOS = ["4:5", "3:4", "1:1", "9:16"] as const;
export const STUDIO_DOCUMENT_STATUSES = ["draft", "saved", "archived"] as const;
export const STUDIO_WEARING_ROLES = ["base", "mid", "outer", "bottom", "shoe", "accessory"] as const;

export type StudioAspectRatio = (typeof STUDIO_ASPECT_RATIOS)[number];
export type StudioDocumentStatus = (typeof STUDIO_DOCUMENT_STATUSES)[number];
export type StudioWearingRole = (typeof STUDIO_WEARING_ROLES)[number];
export type StudioItemSource = "catalog" | "user";
export type StudioItemSnapshot = Omit<Item, "image">;

export type StudioDocumentNode = {
  id: string;
  itemId: string;
  itemSource: StudioItemSource;
  itemSnapshot: StudioItemSnapshot;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  flipX: boolean;
  locked: boolean;
  wearingRole: StudioWearingRole;
};

export type OutfitStudioDocument = {
  schemaVersion: typeof STUDIO_SCHEMA_VERSION;
  id: string;
  ownerId: string;
  title: string;
  aspectRatio: StudioAspectRatio;
  background: {
    type: "solid" | "gradient" | "transparent";
    value: string;
  };
  nodes: StudioDocumentNode[];
  revision: number;
  status: StudioDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudioDocumentValidation = {
  ok: boolean;
  errors: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length >= 20 && Number.isFinite(Date.parse(value));
}

function itemSource(item: Item): StudioItemSource {
  return item.source === "user" ? "user" : "catalog";
}

function snapshotItem(item: Item): StudioItemSnapshot {
  const snapshot = { ...item } as Record<string, unknown>;
  delete snapshot.image;
  return snapshot as StudioItemSnapshot;
}

export function inferWearingRole(item: Item): StudioWearingRole {
  if (item.category === "bottom" || item.slot === "bottom") return "bottom";
  if (item.category === "shoe" || item.slot === "shoe") return "shoe";
  if (item.category === "accessory" || item.slot === "accessory") return "accessory";
  if (item.layer === "outer" || item.slot === "outerwear") return "outer";
  if (item.layer === "mid") return "mid";
  return "base";
}

export function createStudioDocument({
  id = crypto.randomUUID(),
  ownerId,
  title = "Untitled outfit",
  now = new Date().toISOString(),
}: {
  id?: string;
  ownerId: string;
  title?: string;
  now?: string;
}): OutfitStudioDocument {
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id,
    ownerId,
    title,
    aspectRatio: "4:5",
    background: { type: "solid", value: "#f4f0e8" },
    nodes: [],
    revision: 0,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateStudioDocument(
  document: OutfitStudioDocument,
  {
    id = crypto.randomUUID(),
    now = new Date().toISOString(),
    createNodeId = () => crypto.randomUUID(),
  }: { id?: string; now?: string; createNodeId?: () => string } = {},
): OutfitStudioDocument {
  const safe = parseStudioDocument(document);
  return {
    ...safe,
    id,
    title: `Copy of ${safe.title}`.slice(0, 120),
    revision: 0,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    nodes: safe.nodes.map((node) => ({ ...node, id: createNodeId() })),
  };
}

export function editorStateToDocument(
  editor: StudioEditorState,
  base: OutfitStudioDocument,
  updatedAt = new Date().toISOString(),
): OutfitStudioDocument {
  return {
    ...base,
    updatedAt,
    nodes: editor.present.nodes
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((node): StudioDocumentNode => ({
        id: node.id,
        itemId: node.item.id,
        itemSource: itemSource(node.item),
        itemSnapshot: snapshotItem(node.item),
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        rotation: node.rotation,
        zIndex: node.zIndex,
        opacity: 1,
        flipX: false,
        locked: node.locked,
        wearingRole: inferWearingRole(node.item),
      })),
  };
}

function itemKey(source: StudioItemSource, id: string): string {
  return `${source}:${id}`;
}

export function documentToEditorState(
  document: OutfitStudioDocument,
  availableItems: Item[],
): StudioEditorState {
  const itemsByKey = new Map(
    availableItems.map((item) => [itemKey(itemSource(item), item.id), item] as const),
  );
  const nodes: StudioNode[] = document.nodes.map((node) => {
    const fresh = itemsByKey.get(itemKey(node.itemSource, node.itemId));
    const item: Item = fresh ?? {
      ...node.itemSnapshot,
      id: node.itemId,
      image: "",
      source: node.itemSource,
    };
    return {
      id: node.id,
      item,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      zIndex: node.zIndex,
      locked: node.locked,
    };
  });
  return createEditorState(nodes);
}

export function validateStudioDocument(value: unknown): StudioDocumentValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["Document must be an object."] };

  if (value.schemaVersion !== STUDIO_SCHEMA_VERSION) errors.push("Unsupported studio schema version.");
  if (typeof value.id !== "string" || !UUID_RE.test(value.id)) errors.push("Document id must be a UUID.");
  if (typeof value.ownerId !== "string" || !UUID_RE.test(value.ownerId)) errors.push("Document ownerId must be a UUID.");
  if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.length > 120) errors.push("Document title must contain 1–120 characters.");
  if (!STUDIO_ASPECT_RATIOS.includes(value.aspectRatio as StudioAspectRatio)) errors.push("Document aspect ratio is unsupported.");
  if (!STUDIO_DOCUMENT_STATUSES.includes(value.status as StudioDocumentStatus)) errors.push("Document status is invalid.");
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0) errors.push("Document revision must be a non-negative integer.");
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) errors.push("Document timestamps must be valid ISO dates.");

  if (!isRecord(value.background)) {
    errors.push("Document background must be an object.");
  } else {
    if (!["solid", "gradient", "transparent"].includes(String(value.background.type))) errors.push("Document background type is invalid.");
    if (typeof value.background.value !== "string" || value.background.value.length > 200) errors.push("Document background value is invalid.");
  }

  if (!Array.isArray(value.nodes)) {
    errors.push("Document nodes must be an array.");
    return { ok: false, errors };
  }
  if (value.nodes.length > MAX_STUDIO_NODES) errors.push(`Document cannot contain more than ${MAX_STUDIO_NODES} nodes.`);

  const nodeIds = new Set<string>();
  const zIndexes = new Set<number>();
  value.nodes.forEach((rawNode, index) => {
    const prefix = `Node ${index + 1}`;
    if (!isRecord(rawNode)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (typeof rawNode.id !== "string" || !UUID_RE.test(rawNode.id)) errors.push(`${prefix} id must be a UUID.`);
    else if (nodeIds.has(rawNode.id)) errors.push(`${prefix} has a duplicate id.`);
    else nodeIds.add(rawNode.id);

    if (typeof rawNode.itemId !== "string" || !rawNode.itemId.trim() || rawNode.itemId.length > 160) errors.push(`${prefix} itemId is invalid.`);
    if (rawNode.itemSource !== "user" && rawNode.itemSource !== "catalog") errors.push(`${prefix} itemSource is invalid.`);
    if (rawNode.itemSource === "user" && (typeof rawNode.itemId !== "string" || !UUID_RE.test(rawNode.itemId))) errors.push(`${prefix} user itemId must be a UUID.`);
    if (!isRecord(rawNode.itemSnapshot)) errors.push(`${prefix} itemSnapshot is invalid.`);
    else if ("image" in rawNode.itemSnapshot) errors.push(`${prefix} itemSnapshot must not contain an image URL.`);

    if (!isFiniteRange(rawNode.x, -0.8, 0.95)) errors.push(`${prefix} x is outside editor bounds.`);
    if (!isFiniteRange(rawNode.y, -0.8, 0.95)) errors.push(`${prefix} y is outside editor bounds.`);
    if (!isFiniteRange(rawNode.width, 0.05, 1.5)) errors.push(`${prefix} width is outside editor bounds.`);
    if (!isFiniteRange(rawNode.height, 0.05, 1.5)) errors.push(`${prefix} height is outside editor bounds.`);
    if (!isFiniteRange(rawNode.rotation, -180, 180)) errors.push(`${prefix} rotation is outside editor bounds.`);
    if (!isFiniteRange(rawNode.opacity, 0, 1)) errors.push(`${prefix} opacity is invalid.`);
    if (typeof rawNode.flipX !== "boolean") errors.push(`${prefix} flipX must be boolean.`);
    if (typeof rawNode.locked !== "boolean") errors.push(`${prefix} locked must be boolean.`);
    if (!STUDIO_WEARING_ROLES.includes(rawNode.wearingRole as StudioWearingRole)) errors.push(`${prefix} wearingRole is invalid.`);
    if (!Number.isInteger(rawNode.zIndex) || (rawNode.zIndex as number) < 0 || (rawNode.zIndex as number) >= MAX_STUDIO_NODES) {
      errors.push(`${prefix} zIndex is invalid.`);
    } else if (zIndexes.has(rawNode.zIndex as number)) {
      errors.push(`${prefix} has a duplicate zIndex.`);
    } else {
      zIndexes.add(rawNode.zIndex as number);
    }
  });

  return { ok: errors.length === 0, errors };
}

export function parseStudioDocument(value: unknown): OutfitStudioDocument {
  const result = validateStudioDocument(value);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return value as OutfitStudioDocument;
}

export function serializeStudioDocument(document: OutfitStudioDocument): string {
  const result = validateStudioDocument(document);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return JSON.stringify(document);
}
