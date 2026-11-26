import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "../recommend";
import { addGarment, createEditorState, transformNode } from "./editor";
import {
  createStudioDocument,
  documentToEditorState,
  duplicateStudioDocument,
  editorStateToDocument,
  parseStudioDocument,
  serializeStudioDocument,
  validateStudioDocument,
} from "./document";

const shirt: Item = {
  id: "catalog-shirt",
  slot: "top",
  title: "Blue shirt",
  color: "#557799",
  palette: "cool",
  image: "/cutouts/top_shirt-blue.png",
  category: "upper",
  layer: "base",
  source: "catalog",
};

const privateShoe: Item = {
  id: "10000000-0000-0000-0000-000000000001",
  slot: "shoe",
  title: "Private sneaker",
  color: "#ffffff",
  palette: "neutral",
  image: "https://storage.example.test/signed/private-token",
  category: "shoe",
  source: "user",
};

const NOW = "2026-11-26T14:00:00.000Z";

test("creates a versioned local-first studio document", () => {
  const document = createStudioDocument({
    id: "20000000-0000-0000-0000-000000000001",
    ownerId: "00000000-0000-0000-0000-000000000001",
    now: NOW,
  });

  assert.equal(document.schemaVersion, 1);
  assert.equal(document.revision, 0);
  assert.equal(document.status, "draft");
  assert.equal(document.aspectRatio, "4:5");
  assert.deepEqual(document.nodes, []);
  assert.equal(validateStudioDocument(document).ok, true);
});

test("converts editor state to a serializable document without signed URLs", () => {
  let editor = addGarment(createEditorState(), shirt);
  editor = addGarment(editor, privateShoe);
  const shoeNode = editor.present.nodes[1]!;
  editor = transformNode(editor, shoeNode.id, { x: 0.41, y: 0.7, rotation: 7 });
  const base = createStudioDocument({
    id: "20000000-0000-0000-0000-000000000001",
    ownerId: "00000000-0000-0000-0000-000000000001",
    now: NOW,
  });

  const document = editorStateToDocument(editor, base, "2026-11-26T14:01:00.000Z");
  const serialized = serializeStudioDocument(document);

  assert.equal(document.nodes.length, 2);
  assert.equal(document.nodes[1]!.itemSource, "user");
  assert.equal(document.nodes[1]!.wearingRole, "shoe");
  assert.equal(document.nodes[1]!.x, 0.41);
  assert.equal(document.nodes[1]!.rotation, 7);
  assert.equal(serialized.includes("private-token"), false);
  assert.equal(serialized.includes("signed"), false);
});

test("hydrates fresh wardrobe URLs when reopening a document", () => {
  let editor = addGarment(createEditorState(), privateShoe);
  const base = createStudioDocument({
    id: "20000000-0000-0000-0000-000000000001",
    ownerId: "00000000-0000-0000-0000-000000000001",
    now: NOW,
  });
  const document = editorStateToDocument(editor, base, NOW);
  const freshShoe = { ...privateShoe, image: "https://storage.example.test/signed/fresh-token" };

  editor = documentToEditorState(document, [freshShoe]);

  assert.equal(editor.present.nodes[0]!.item.image, freshShoe.image);
  assert.equal(editor.present.nodes[0]!.item.title, "Private sneaker");
  assert.deepEqual(editor.past, []);
  assert.deepEqual(editor.future, []);
});

test("duplicates documents with fresh document and node identities", () => {
  const editor = addGarment(createEditorState(), shirt);
  const original = editorStateToDocument(
    editor,
    createStudioDocument({ id: "20000000-0000-0000-0000-000000000001", ownerId: "00000000-0000-0000-0000-000000000001", now: NOW }),
    NOW,
  );
  const copy = duplicateStudioDocument(original, {
    id: "20000000-0000-0000-0000-000000000002",
    now: "2026-11-26T14:05:00.000Z",
    createNodeId: () => "30000000-0000-0000-0000-000000000002",
  });

  assert.equal(copy.id, "20000000-0000-0000-0000-000000000002");
  assert.equal(copy.revision, 0);
  assert.equal(copy.status, "draft");
  assert.equal(copy.title, "Copy of Untitled outfit");
  assert.notEqual(copy.nodes[0]!.id, original.nodes[0]!.id);
});

test("parses a valid document and rejects unsupported or unsafe payloads", () => {
  const document = createStudioDocument({
    id: "20000000-0000-0000-0000-000000000001",
    ownerId: "00000000-0000-0000-0000-000000000001",
    now: NOW,
  });
  assert.equal(parseStudioDocument(JSON.parse(serializeStudioDocument(document))).id, document.id);

  assert.throws(() => parseStudioDocument({ ...document, schemaVersion: 2 }), /schema version/i);
  assert.throws(() => parseStudioDocument({ ...document, revision: -1 }), /revision/i);
  assert.throws(() => parseStudioDocument({ ...document, nodes: Array.from({ length: 13 }, (_, index) => ({ id: String(index) })) }), /12 nodes/i);
});

test("rejects duplicate node IDs and transforms outside editor bounds", () => {
  const editor = addGarment(createEditorState(), shirt);
  const base = createStudioDocument({
    id: "20000000-0000-0000-0000-000000000001",
    ownerId: "00000000-0000-0000-0000-000000000001",
    now: NOW,
  });
  const document = editorStateToDocument(editor, base, NOW);
  const duplicate = { ...document, nodes: [document.nodes[0]!, { ...document.nodes[0]! }] };
  assert.match(validateStudioDocument(duplicate).errors.join(" "), /duplicate/i);

  const unsafe = { ...document, nodes: [{ ...document.nodes[0]!, width: 20 }] };
  assert.match(validateStudioDocument(unsafe).errors.join(" "), /width/i);
});
