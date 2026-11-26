"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Item } from "@/lib/recommend";
import {
  createStudioDocument,
  documentToEditorState,
  duplicateStudioDocument,
  editorStateToDocument,
  parseStudioDocument,
  type OutfitStudioDocument,
} from "@/lib/studio/document";
import {
  deleteStudioDraft,
  listStudioDrafts,
  saveStudioDraft,
} from "@/lib/studio/drafts";
import { createEditorState, type StudioEditorState } from "@/lib/studio/editor";

type StudioSyncState = "loading" | "local" | "unsaved" | "saving" | "saved" | "offline" | "conflict" | "error";

type ManualLookResponse = {
  document: OutfitStudioDocument;
  look: { id: string; image: string; previewPath: string | null; outfitDocumentId: string; origin: "manual"; title: string };
  previewUploaded: boolean;
};

type UseStudioPersistenceOptions = {
  userId: string | null;
  isVerifiedAccount: boolean;
  items: Item[];
  itemsLoading: boolean;
  editor: StudioEditorState;
  setEditor: Dispatch<SetStateAction<StudioEditorState>>;
};

function contentKey(document: OutfitStudioDocument): string {
  return JSON.stringify({
    title: document.title,
    aspectRatio: document.aspectRatio,
    background: document.background,
    status: document.status,
    nodes: document.nodes,
  });
}

function mergeDocuments(local: OutfitStudioDocument[], cloud: OutfitStudioDocument[]): OutfitStudioDocument[] {
  const merged = new Map<string, OutfitStudioDocument>();
  for (const document of [...cloud, ...local]) {
    const current = merged.get(document.id);
    if (!current || Date.parse(document.updatedAt) > Date.parse(current.updatedAt)) merged.set(document.id, document);
  }
  return [...merged.values()].filter((document) => document.status !== "archived").sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function replaceDocument(list: OutfitStudioDocument[], document: OutfitStudioDocument): OutfitStudioDocument[] {
  return [document, ...list.filter((entry) => entry.id !== document.id)]
    .filter((entry) => entry.status !== "archived")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export function useStudioPersistence({
  userId,
  isVerifiedAccount,
  items,
  itemsLoading,
  editor,
  setEditor,
}: UseStudioPersistenceOptions) {
  const [document, setDocument] = useState<OutfitStudioDocument | null>(null);
  const [documents, setDocuments] = useState<OutfitStudioDocument[]>([]);
  const [lookId, setLookId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<StudioSyncState>("loading");
  const [message, setMessage] = useState("Preparing local draft…");
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudInFlightRef = useRef<Promise<OutfitStudioDocument> | null>(null);
  const lastCloudKeyRef = useRef("");
  const cloudKeysRef = useRef(new Map<string, string>());
  const lookLinksRef = useRef(new Map<string, string>());
  const bootstrappedOwnerRef = useRef<string | null>(null);
  const documentRef = useRef<OutfitStudioDocument | null>(null);
  const editorRef = useRef(editor);
  const itemsRef = useRef(items);
  const syncStateRef = useRef<StudioSyncState>("loading");

  useEffect(() => { editorRef.current = editor; }, [editor]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => { syncStateRef.current = syncState; }, [syncState]);

  const applyDocument = useCallback((next: OutfitStudioDocument, nextLookId: string | null = null) => {
    documentRef.current = next;
    setDocument(next);
    setEditor(documentToEditorState(next, itemsRef.current));
    setLookId(nextLookId);
    setDocuments((current) => replaceDocument(current, next));
  }, [setEditor]);

  useEffect(() => {
    if (!userId || itemsLoading || bootstrappedOwnerRef.current === userId) return;
    bootstrappedOwnerRef.current = userId;
    let active = true;
    setReady(false);
    setSyncState("loading");
    setMessage("Restoring your latest outfit…");

    void (async () => {
      const localRecords = await listStudioDrafts(userId).catch(() => []);
      const localDocuments = localRecords.map((record) => record.document);
      let cloudDocuments: OutfitStudioDocument[] = [];
      let manualLooks: Array<{ id: string; outfitDocumentId?: string | null; origin?: string }> = [];

      if (isVerifiedAccount) {
        try {
          const [documentsResponse, looksResponse] = await Promise.all([
            fetch("/api/studio/documents", { cache: "no-store" }),
            fetch("/api/looks", { cache: "no-store" }),
          ]);
          if (documentsResponse.ok) {
            const body = await documentsResponse.json() as { documents?: unknown[] };
            cloudDocuments = (body.documents ?? []).map(parseStudioDocument);
          }
          if (looksResponse.ok) {
            const body = await looksResponse.json() as { looks?: Array<{ id: string; outfitDocumentId?: string | null; origin?: string }> };
            manualLooks = body.looks ?? [];
          }
        } catch {
          // IndexedDB remains canonical while offline.
        }
      }

      if (!active) return;
      const merged = mergeDocuments(localDocuments, cloudDocuments);
      const requestedId = new URLSearchParams(window.location.search).get("document");
      const selected = (requestedId ? merged.find((entry) => entry.id === requestedId) : null)
        ?? merged[0]
        ?? createStudioDocument({ ownerId: userId });
      const cloudVersion = cloudDocuments.find((entry) => entry.id === selected.id);
      cloudKeysRef.current = new Map(cloudDocuments.map((entry) => [entry.id, contentKey(entry)]));
      lookLinksRef.current = new Map(
        manualLooks
          .filter((look): look is { id: string; outfitDocumentId: string; origin?: string } => look.origin === "manual" && Boolean(look.outfitDocumentId))
          .map((look) => [look.outfitDocumentId, look.id]),
      );
      const linkedLook = lookLinksRef.current.get(selected.id) ?? null;

      setDocuments(replaceDocument(merged, selected));
      documentRef.current = selected;
      setDocument(selected);
      setEditor(documentToEditorState(selected, itemsRef.current));
      setLookId(linkedLook);
      lastCloudKeyRef.current = cloudVersion ? contentKey(cloudVersion) : "";
      setSyncState(isVerifiedAccount ? (cloudVersion ? "saved" : "unsaved") : "local");
      setMessage(isVerifiedAccount ? (cloudVersion ? "Saved to cloud" : "Saved on this device") : "Guest draft · this device only");
      setReady(true);
    })();

    return () => { active = false; };
  }, [isVerifiedAccount, itemsLoading, setEditor, userId]);

  const snapshot = useCallback(() => {
    const base = documentRef.current;
    if (!base) return null;
    return editorStateToDocument(editorRef.current, base, new Date().toISOString());
  }, []);

  const syncCloud = useCallback(async (candidate: OutfitStudioDocument): Promise<OutfitStudioDocument> => {
    if (!isVerifiedAccount) return candidate;
    if (cloudInFlightRef.current) await cloudInFlightRef.current.catch(() => null);

    const latestBase = documentRef.current;
    const latest = latestBase && latestBase.id === candidate.id
      ? { ...candidate, revision: latestBase.revision, createdAt: latestBase.createdAt }
      : candidate;
    const key = contentKey(latest);
    if (key === lastCloudKeyRef.current) return latestBase ?? latest;

    const operation = (async () => {
      setSyncState("saving");
      setMessage("Saving to cloud…");
      const response = await fetch(
        latest.revision === 0 ? "/api/studio/documents" : `/api/studio/documents/${latest.id}`,
        {
          method: latest.revision === 0 ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ document: latest }),
        },
      );
      if (!response.ok) {
        const error = await responseError(response);
        if (response.status === 409) {
          setSyncState("conflict");
          setMessage("Another tab saved a newer version");
        } else {
          setSyncState(response.status >= 500 ? "offline" : "error");
          setMessage(error);
        }
        throw new Error(error);
      }
      const body = await response.json() as { document: unknown };
      const saved = parseStudioDocument(body.document);
      lastCloudKeyRef.current = key;
      cloudKeysRef.current.set(saved.id, key);
      documentRef.current = saved;
      setDocument(saved);
      setDocuments((current) => replaceDocument(current, saved));
      await saveStudioDraft(saved).catch(() => null);
      setSyncState("saved");
      setMessage("Saved to cloud");
      return saved;
    })();

    cloudInFlightRef.current = operation;
    try {
      return await operation;
    } finally {
      if (cloudInFlightRef.current === operation) cloudInFlightRef.current = null;
    }
  }, [isVerifiedAccount]);

  useEffect(() => {
    if (!ready || !document) return;
    const next = editorStateToDocument(editor, document, new Date().toISOString());
    const key = contentKey(next);

    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    localTimerRef.current = setTimeout(() => {
      void saveStudioDraft(next).then(() => {
        setDocuments((current) => replaceDocument(current, next));
        if (!isVerifiedAccount) {
          setSyncState("local");
          setMessage("Saved on this device");
        }
      }).catch(() => {
        setSyncState("error");
        setMessage("Local draft storage is unavailable");
      });
    }, 750);

    if (isVerifiedAccount && key !== lastCloudKeyRef.current && syncStateRef.current !== "conflict") {
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
      setSyncState("unsaved");
      setMessage("Unsaved changes");
      cloudTimerRef.current = setTimeout(() => { void syncCloud(next).catch(() => {}); }, 2500);
    }

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    };
  }, [document, editor, isVerifiedAccount, ready, syncCloud]);

  const renameDocument = useCallback((title: string) => {
    setDocument((current) => {
      if (!current) return current;
      const next = { ...current, title: title.slice(0, 120) };
      documentRef.current = next;
      return next;
    });
  }, []);

  const openDocument = useCallback((id: string) => {
    const selected = documents.find((entry) => entry.id === id);
    if (!selected) return;
    applyDocument(selected, lookLinksRef.current.get(selected.id) ?? null);
    lastCloudKeyRef.current = cloudKeysRef.current.get(selected.id) ?? "";
    setSyncState(isVerifiedAccount && selected.revision > 0 ? "saved" : "local");
    setMessage(isVerifiedAccount && selected.revision > 0 ? "Saved to cloud" : "Saved on this device");
  }, [applyDocument, documents, isVerifiedAccount]);

  const newDocument = useCallback(() => {
    if (!userId) return;
    const next = createStudioDocument({ ownerId: userId });
    lastCloudKeyRef.current = "";
    applyDocument(next);
    setSyncState(isVerifiedAccount ? "unsaved" : "local");
    setMessage(isVerifiedAccount ? "New cloud draft" : "Guest draft · this device only");
  }, [applyDocument, isVerifiedAccount, userId]);

  const duplicateCurrent = useCallback(() => {
    const current = snapshot();
    if (!current) return;
    const next = duplicateStudioDocument(current);
    lastCloudKeyRef.current = "";
    applyDocument(next);
    setSyncState(isVerifiedAccount ? "unsaved" : "local");
    setMessage("Copy created");
  }, [applyDocument, isVerifiedAccount, snapshot]);

  const reloadRemote = useCallback(async () => {
    const current = documentRef.current;
    if (!current || !isVerifiedAccount || current.revision === 0) return;
    const response = await fetch(`/api/studio/documents/${current.id}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await responseError(response));
    const body = await response.json() as { document: unknown };
    const remote = parseStudioDocument(body.document);
    lastCloudKeyRef.current = contentKey(remote);
    cloudKeysRef.current.set(remote.id, lastCloudKeyRef.current);
    applyDocument(remote, lookLinksRef.current.get(remote.id) ?? lookId);
    await saveStudioDraft(remote);
    setSyncState("saved");
    setMessage("Reloaded the cloud version");
  }, [applyDocument, isVerifiedAccount, lookId]);

  const saveAsCopy = useCallback(() => {
    duplicateCurrent();
    setSyncState("unsaved");
    setMessage("Conflict copy ready to save");
  }, [duplicateCurrent]);

  const syncNow = useCallback(async () => {
    const current = snapshot();
    if (!current) return null;
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    if (!isVerifiedAccount) {
      await saveStudioDraft(current);
      setSyncState("local");
      setMessage("Saved on this device");
      return current;
    }
    return syncCloud(current);
  }, [isVerifiedAccount, snapshot, syncCloud]);

  const saveToLooks = useCallback(async (previewDataUrl: string): Promise<ManualLookResponse> => {
    if (!isVerifiedAccount) throw new Error("Sign in with a permanent account to save Looks across devices.");
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    if (cloudInFlightRef.current) await cloudInFlightRef.current.catch(() => null);
    const current = snapshot();
    if (!current) throw new Error("Outfit document is not ready.");
    const activeLookId = lookId ?? crypto.randomUUID();
    setSyncState("saving");
    setMessage("Saving to Looks…");
    const response = await fetch("/api/studio/looks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document: current, lookId: activeLookId, previewDataUrl }),
    });
    if (!response.ok) {
      const error = await responseError(response);
      if (response.status === 409) {
        setSyncState("conflict");
        setMessage("Another tab saved a newer version");
      } else {
        setSyncState("error");
        setMessage(error);
      }
      throw new Error(error);
    }
    const body = await response.json() as ManualLookResponse;
    const saved = parseStudioDocument(body.document);
    lastCloudKeyRef.current = contentKey(saved);
    cloudKeysRef.current.set(saved.id, lastCloudKeyRef.current);
    lookLinksRef.current.set(saved.id, body.look.id);
    documentRef.current = saved;
    setDocument(saved);
    setLookId(body.look.id);
    setDocuments((currentList) => replaceDocument(currentList, saved));
    await saveStudioDraft(saved).catch(() => null);
    setSyncState("saved");
    setMessage(body.previewUploaded ? "Saved to Looks" : "Saved to Looks · preview upload pending");
    return { ...body, document: saved };
  }, [isVerifiedAccount, lookId, snapshot]);

  const removeCurrent = useCallback(async () => {
    const current = documentRef.current;
    if (!current || !userId) return;
    if (current.revision > 0 && isVerifiedAccount) {
      const response = await fetch(`/api/studio/documents/${current.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response));
    }
    await deleteStudioDraft(userId, current.id).catch(() => null);
    const remaining = documents.filter((entry) => entry.id !== current.id);
    setDocuments(remaining);
    if (remaining[0]) applyDocument(remaining[0]);
    else {
      const next = createStudioDocument({ ownerId: userId });
      setEditor(createEditorState());
      applyDocument(next);
    }
  }, [applyDocument, documents, isVerifiedAccount, setEditor, userId]);

  const currentSnapshot = useMemo(() => document ? editorStateToDocument(editor, document, document.updatedAt) : null, [document, editor]);

  return {
    document,
    currentSnapshot,
    documents,
    lookId,
    ready,
    syncState,
    message,
    renameDocument,
    openDocument,
    newDocument,
    duplicateCurrent,
    reloadRemote,
    saveAsCopy,
    syncNow,
    saveToLooks,
    removeCurrent,
  };
}
