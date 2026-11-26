import "server-only";
import { parseStudioDocument, type OutfitStudioDocument } from "./document";
import { StudioPersistenceError } from "./server-persistence";

export function parseOwnedStudioDocument(value: unknown, userId: string): OutfitStudioDocument {
  try {
    const document = parseStudioDocument(value);
    if (document.ownerId !== userId) throw new Error("owner mismatch");
    return document;
  } catch {
    throw new StudioPersistenceError("The outfit document is malformed.", "invalid");
  }
}
