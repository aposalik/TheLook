import assert from "node:assert/strict";
import test from "node:test";
import { createStudioDocument } from "./document";
import { createDraftRecord, studioDraftKey } from "./drafts";

const ownerId = "00000000-0000-0000-0000-000000000001";
const documentId = "20000000-0000-0000-0000-000000000001";

test("builds owner-scoped IndexedDB keys", () => {
  assert.equal(studioDraftKey(ownerId, documentId), `${ownerId}:${documentId}`);
});

test("creates validated draft records with stable timestamps", () => {
  const document = createStudioDocument({ id: documentId, ownerId, now: "2026-11-26T14:00:00.000Z" });
  const record = createDraftRecord(document, "2026-11-26T14:01:00.000Z");

  assert.equal(record.key, studioDraftKey(ownerId, documentId));
  assert.equal(record.ownerId, ownerId);
  assert.equal(record.document.id, documentId);
  assert.equal(record.savedAt, "2026-11-26T14:01:00.000Z");
});
