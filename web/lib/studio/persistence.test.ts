import assert from "node:assert/strict";
import test from "node:test";
import { addGarment, createEditorState } from "./editor";
import { createStudioDocument, editorStateToDocument } from "./document";
import { documentToRpcParams, rowsToStudioDocument } from "./persistence";

const ownerId = "00000000-0000-0000-0000-000000000001";
const documentId = "20000000-0000-0000-0000-000000000001";

const catalogItem = {
  id: "linen-shirt",
  slot: "top",
  title: "Linen shirt",
  color: "#ddd0bf",
  palette: "neutral" as const,
  image: "/cutouts/top_shirt-blue.png",
  source: "catalog" as const,
  category: "upper",
  layer: "base",
};

test("maps a studio document to bounded RPC parameters", () => {
  const editor = addGarment(createEditorState(), catalogItem);
  const document = editorStateToDocument(
    editor,
    createStudioDocument({ id: documentId, ownerId, now: "2026-11-26T14:00:00.000Z" }),
    "2026-11-26T14:01:00.000Z",
  );
  const params = documentToRpcParams(document);

  assert.equal(params.p_document_id, documentId);
  assert.equal(params.p_expected_revision, 0);
  assert.equal(params.p_nodes.length, 1);
  assert.equal(JSON.stringify(params).includes("/cutouts/"), false);
});

test("maps normalized database rows back to schema version one", () => {
  const document = rowsToStudioDocument({
    id: documentId,
    user_id: ownerId,
    title: "Saved outfit",
    schema_version: 1,
    aspect_ratio: "4:5",
    background: { type: "solid", value: "#f4f0e8" },
    revision: 3,
    status: "saved",
    created_at: "2026-11-26T14:00:00.000Z",
    updated_at: "2026-11-26T14:02:00.000Z",
    outfit_document_nodes: [{
      id: "30000000-0000-0000-0000-000000000001",
      wardrobe_item_id: null,
      catalog_item_id: "linen-shirt",
      wearing_role: "base",
      transform: { x: 0.3, y: 0.12, width: 0.4, height: 0.36, rotation: 0, opacity: 1, flipX: false, locked: false },
      z_index: 0,
      item_snapshot: { ...catalogItem, image: undefined },
    }],
  });

  assert.equal(document.revision, 3);
  assert.equal(document.nodes[0]!.itemSource, "catalog");
  assert.equal(document.nodes[0]!.itemId, "linen-shirt");
});
