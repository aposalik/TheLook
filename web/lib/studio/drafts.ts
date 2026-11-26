import {
  parseStudioDocument,
  serializeStudioDocument,
  type OutfitStudioDocument,
} from "./document";

const DATABASE_NAME = "thelook-studio";
const DATABASE_VERSION = 1;
const DRAFT_STORE = "drafts";

export type StudioDraftRecord = {
  key: string;
  ownerId: string;
  documentId: string;
  savedAt: string;
  document: OutfitStudioDocument;
};

let databasePromise: Promise<IDBDatabase> | null = null;

export function studioDraftKey(ownerId: string, documentId: string): string {
  return `${ownerId}:${documentId}`;
}

export function createDraftRecord(
  document: OutfitStudioDocument,
  savedAt = new Date().toISOString(),
): StudioDraftRecord {
  const safeDocument = parseStudioDocument(JSON.parse(serializeStudioDocument(document)));
  return {
    key: studioDraftKey(safeDocument.ownerId, safeDocument.id),
    ownerId: safeDocument.ownerId,
    documentId: safeDocument.id,
    savedAt,
    document: safeDocument,
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable."));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(DRAFT_STORE)
        ? request.transaction!.objectStore(DRAFT_STORE)
        : database.createObjectStore(DRAFT_STORE, { keyPath: "key" });
      if (!store.indexNames.contains("ownerId")) store.createIndex("ownerId", "ownerId", { unique: false });
      if (!store.indexNames.contains("savedAt")) store.createIndex("savedAt", "savedAt", { unique: false });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Could not open the Outfit Studio draft database."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Outfit Studio draft database upgrade is blocked by another tab."));
    };
  });

  return databasePromise;
}

export async function saveStudioDraft(document: OutfitStudioDocument): Promise<StudioDraftRecord> {
  const record = createDraftRecord(document);
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, "readwrite");
  transaction.objectStore(DRAFT_STORE).put(record);
  await transactionComplete(transaction);
  return record;
}

export async function loadStudioDraft(ownerId: string, documentId: string): Promise<OutfitStudioDocument | null> {
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, "readonly");
  const record = await requestResult(
    transaction.objectStore(DRAFT_STORE).get(studioDraftKey(ownerId, documentId)) as IDBRequest<StudioDraftRecord | undefined>,
  );
  await transactionComplete(transaction);
  return record ? parseStudioDocument(record.document) : null;
}

export async function listStudioDrafts(ownerId: string): Promise<StudioDraftRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, "readonly");
  const records = await requestResult(
    transaction.objectStore(DRAFT_STORE).index("ownerId").getAll(ownerId) as IDBRequest<StudioDraftRecord[]>,
  );
  await transactionComplete(transaction);
  return records
    .map((record) => ({ ...record, document: parseStudioDocument(record.document) }))
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

export async function loadLatestStudioDraft(ownerId: string): Promise<OutfitStudioDocument | null> {
  const records = await listStudioDrafts(ownerId);
  return records.find((record) => record.document.status !== "archived")?.document ?? null;
}

export async function deleteStudioDraft(ownerId: string, documentId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(DRAFT_STORE, "readwrite");
  transaction.objectStore(DRAFT_STORE).delete(studioDraftKey(ownerId, documentId));
  await transactionComplete(transaction);
}
