"use client";
/* eslint-disable @next/next/no-img-element -- signed private wardrobe URLs and transparent cutouts need native image loading */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useStudioPersistence } from "@/app/hooks/useStudioPersistence";
import type { Item } from "@/lib/recommend";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_STUDIO_NODES,
  addGarment,
  bringForward,
  clearCanvas,
  createEditorState,
  deleteSelected,
  redo,
  selectNode,
  sendBackward,
  toggleNodeLock,
  transformNode,
  undo,
  type StudioEditorState,
} from "@/lib/studio/editor";
import { exportStudioPreview } from "@/lib/studio/export-preview";
import { analyzeManualLook, type ManualLookAnalysis } from "@/lib/studio/analysis";
import StudioArtboard from "./StudioArtboard";
import WardrobeDock from "./WardrobeDock";

const WARDROBE_KEY = "thelook_wardrobe";

function userStorageKey(userId: string): string {
  return `${WARDROBE_KEY}:${userId}`;
}

function defaultSlot(category: string, layer: string | null): string {
  if (category === "bottom" || category === "shoe" || category === "accessory" || category === "dress") return category;
  return layer === "outer" ? "outerwear" : "top";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not encode the outfit preview."));
    reader.readAsDataURL(blob);
  });
}

function rowToItem(row: Record<string, unknown>, image: string): Item {
  const category = typeof row.category === "string" ? row.category : "upper";
  const layer = typeof row.layer === "string" ? row.layer : null;
  const styles = Array.isArray(row.styles) ? row.styles.filter((value): value is string => typeof value === "string") : [];
  const storedSlots = styles.filter((style) => style.startsWith("slot:")).map((style) => style.slice(5));
  const slot = storedSlots[0] ?? defaultSlot(category, layer);
  return {
    id: String(row.id),
    slot,
    slots: storedSlots.length ? storedSlots : [slot],
    title: typeof row.title === "string" ? row.title : "Wardrobe item",
    color: typeof row.dominant_color === "string" ? row.dominant_color : "#8A8480",
    palette: typeof row.palette === "string" ? row.palette : "neutral",
    image,
    category,
    layer,
    source: "user",
    styles: styles.filter((style) => !style.startsWith("slot:")),
    seasons: Array.isArray(row.seasons) ? row.seasons.filter((value): value is string => typeof value === "string") : [],
    description: typeof row.description === "string" ? row.description : undefined,
  };
}

function Icon({ name }: { name: "undo" | "redo" | "back" | "forward" | "trash" | "lock" | "export" | "clear" }) {
  const paths = {
    undo: <><path d="M9 7 4 12l5 5" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 7 5 5-5 5" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></>,
    back: <><path d="M8 7h9v9" /><path d="m17 7-10 10" /></>,
    forward: <><path d="M16 17H7V8" /><path d="M7 17 17 7" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3M7 7l1 13h8l1-13" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    export: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>,
    clear: <><path d="m5 5 14 14M19 5 5 19" /></>,
  };
  return <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function ToolButton({ label, icon, disabled, active, onClick }: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${active ? "border-[#756047] bg-[#2d2924] text-white" : "border-[#ddd7cc] bg-white text-[#514b43] hover:border-[#aa9677]"}`}
    >
      <Icon name={icon} /><span className="hidden xl:inline">{label}</span>
    </button>
  );
}

export default function OutfitStudio({ catalog }: { catalog: Item[] }) {
  const { user, isGuest, isVerifiedAccount } = useAuth();
  const [editor, setEditor] = useState<StudioEditorState>(() => createEditorState());
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [wardrobeLoading, setWardrobeLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [savingLook, setSavingLook] = useState(false);
  const [analysis, setAnalysis] = useState<ManualLookAnalysis | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadWardrobe() {
      if (!user) {
        if (active) setWardrobeLoading(false);
        return;
      }
      let cached: Item[] = [];
      try {
        cached = JSON.parse(window.localStorage.getItem(userStorageKey(user.id)) ?? "[]") as Item[];
        if (active) setUserItems(cached.filter((item) => Boolean(item.image)));
      } catch {
        cached = [];
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase.from("wardrobe_items").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        const loaded = await Promise.all((data ?? []).map(async (row: Record<string, unknown>) => {
          const response = await fetch(`/api/wardrobe/${row.id}/url`);
          if (!response.ok) throw new Error(`Could not load ${row.id}`);
          const body = await response.json() as { signedUrl?: string };
          return rowToItem(row, body.signedUrl ?? "");
        }));
        const usable = loaded.filter((item) => Boolean(item.image));
        const loadedIds = new Set(usable.map((item) => item.id));
        const merged = [...usable, ...cached.filter((item) => item.image && !loadedIds.has(item.id))];
        if (active) setUserItems(merged);
      } catch {
        if (active) setUserItems(cached.filter((item) => Boolean(item.image)));
      } finally {
        if (active) setWardrobeLoading(false);
      }
    }
    void loadWardrobe();
    return () => { active = false; };
  }, [user]);

  const wardrobe = useMemo(() => {
    const userIds = new Set(userItems.map((item) => item.id));
    return [...userItems, ...catalog.filter((item) => !userIds.has(item.id)).map((item) => ({ ...item, source: item.source ?? "catalog" as const }))];
  }, [catalog, userItems]);

  const persistence = useStudioPersistence({
    userId: user?.id ?? null,
    isVerifiedAccount,
    items: wardrobe,
    itemsLoading: wardrobeLoading,
    editor,
    setEditor,
  });

  const syncNow = persistence.syncNow;
  const selected = editor.present.nodes.find((node) => node.id === editor.present.selectedNodeId) ?? null;
  const orderedLayers = editor.present.nodes.slice().sort((a, b) => b.zIndex - a.zIndex);

  const addItem = useCallback((item: Item, position?: { x: number; y: number }) => {
    if (editor.present.nodes.length >= MAX_STUDIO_NODES) {
      showToast(`Outfit Studio supports up to ${MAX_STUDIO_NODES} pieces per look.`);
      return;
    }
    setEditor((current) => addGarment(current, item, position));
  }, [editor.present.nodes.length, showToast]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void syncNow().then(() => showToast(isVerifiedAccount ? "Draft synced." : "Draft saved on this device.")).catch((error) => {
          showToast(error instanceof Error ? error.message : "Draft save failed.");
        });
      } else if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setEditor((current) => event.shiftKey ? redo(current) : undo(current));
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        setEditor(deleteSelected);
      } else if (event.key === "[") {
        setEditor((current) => current.present.selectedNodeId ? sendBackward(current, current.present.selectedNodeId) : current);
      } else if (event.key === "]") {
        setEditor((current) => current.present.selectedNodeId ? bringForward(current, current.present.selectedNodeId) : current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVerifiedAccount, showToast, syncNow]);

  const analyzeCurrent = useCallback(async () => {
    const document = persistence.currentSnapshot;
    if (!document || !document.nodes.length) { showToast("Add garments before analyzing."); return; }
    const next = analyzeManualLook(document);
    setAnalysis(next);
    if (isVerifiedAccount && persistence.lookId) {
      const response = await fetch(`/api/studio/looks/${persistence.lookId}/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ document }) });
      if (!response.ok) throw new Error("Analysis could not be saved.");
    }
    showToast(next.hardValid ? "Deterministic analysis complete." : "Analysis found creative compatibility warnings.");
  }, [isVerifiedAccount, persistence.currentSnapshot, persistence.lookId, showToast]);

  async function saveToLooks() {
    if (!editor.present.nodes.length) {
      showToast("Add at least one wardrobe piece before saving.");
      return;
    }
    if (!isVerifiedAccount) {
      showToast("Sign in with a permanent account to save Looks across devices.");
      return;
    }
    setSavingLook(true);
    try {
      const blob = await exportStudioPreview(editor.present.nodes);
      const previewDataUrl = await blobToDataUrl(blob);
      const result = await persistence.saveToLooks(previewDataUrl);
      setAnalysis(analyzeManualLook(result.document));
      showToast(result.previewUploaded ? "Saved to Looks with a private preview." : "Look saved; preview upload can be retried later.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save this Look.");
    } finally {
      setSavingLook(false);
    }
  }

  async function exportPreview() {
    if (!editor.present.nodes.length) {
      showToast("Add at least one wardrobe piece before exporting.");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportStudioPreview(editor.present.nodes);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `thelook-outfit-${new Date().toISOString().slice(0, 10)}.webp`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Clean WebP preview exported.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Preview export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-[#efebe4] text-[#28241f]">
      <header className="z-40 border-b border-[#ded8cd] bg-[#faf8f4]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="shrink-0" aria-label="TheLook Fitting Room">
              <img src="/brand/thelook-logo-light.png" alt="TheLook" className="h-12 w-[82px] object-contain" />
            </Link>
            <nav className="hidden items-center gap-1 rounded-2xl border border-[#e1dbd0] bg-white p-1 sm:flex" aria-label="Product areas">
              <Link href="/" className="rounded-xl px-3 py-2 text-xs font-semibold text-[#756d63] transition hover:bg-[#f1ede6]">Fitting Room</Link>
              <span className="rounded-xl bg-[#292621] px-3 py-2 text-xs font-semibold text-white">Outfit Studio</span>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#9a9185]">Phase 2 · {persistence.syncState}</p>
              <p className="max-w-52 truncate text-[11px] font-semibold">{persistence.message}</p>
            </div>
            <button
              type="button"
              onClick={() => void saveToLooks()}
              disabled={savingLook || !editor.present.nodes.length || !persistence.ready}
              title={isGuest ? "Sign in to save Looks across devices" : "Save this editable outfit to Looks"}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#292621] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45 sm:px-3.5"
            >
              <span aria-hidden="true">◇</span><span className="hidden sm:inline">{savingLook ? "Saving…" : persistence.lookId ? "Update Look" : "Save to Looks"}</span>
            </button>
            <button type="button" onClick={() => void analyzeCurrent().catch((error) => showToast(error instanceof Error ? error.message : "Analysis failed."))} disabled={!editor.present.nodes.length} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#bfd0c5] bg-[#edf5f0] px-3 text-xs font-bold text-[#355f4e] disabled:opacity-45 sm:px-3.5"><span>✦</span><span className="hidden lg:inline">Analyze</span></button>
            <button
              type="button"
              aria-label={exporting ? "Exporting outfit preview" : "Export outfit as WebP"}
              onClick={() => void exportPreview()}
              disabled={exporting || !editor.present.nodes.length}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9d2c7] bg-white px-3 text-xs font-bold text-[#3f3932] shadow-sm transition hover:border-[#a78f6d] disabled:cursor-not-allowed disabled:opacity-45 sm:px-3.5"
            >
              <Icon name="export" /><span className="hidden xl:inline">{exporting ? "Exporting…" : "Export WebP"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto border-b border-[#ded8cd] bg-white px-3 py-2 sm:px-5">
        <div className="mx-auto flex w-max min-w-full max-w-[1600px] items-center gap-2">
          <select
            aria-label="Open outfit document"
            value={persistence.document?.id ?? ""}
            disabled={!persistence.ready}
            onChange={(event) => persistence.openDocument(event.target.value)}
            className="h-9 max-w-48 rounded-xl border border-[#ddd7cc] bg-[#f8f6f1] px-3 text-[11px] font-semibold outline-none focus:border-[#9d805a]"
          >
            {persistence.documents.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
          </select>
          <input
            aria-label="Outfit title"
            value={persistence.document?.title ?? ""}
            disabled={!persistence.ready}
            onChange={(event) => persistence.renameDocument(event.target.value)}
            className="h-9 w-48 rounded-xl border border-[#ddd7cc] bg-white px-3 text-[11px] font-semibold outline-none focus:border-[#9d805a] sm:w-64"
            placeholder="Outfit title"
            maxLength={120}
          />
          <button type="button" onClick={persistence.newDocument} disabled={!persistence.ready} className="h-9 rounded-xl border border-[#ddd7cc] bg-white px-3 text-[10px] font-bold hover:border-[#a88d67] disabled:opacity-40">New</button>
          <button type="button" onClick={persistence.duplicateCurrent} disabled={!persistence.document} className="h-9 rounded-xl border border-[#ddd7cc] bg-white px-3 text-[10px] font-bold hover:border-[#a88d67] disabled:opacity-40">Duplicate</button>
          <button
            type="button"
            onClick={() => void persistence.syncNow().then(() => showToast(isVerifiedAccount ? "Draft synced." : "Draft saved on this device.")).catch((error) => showToast(error instanceof Error ? error.message : "Draft save failed."))}
            disabled={!persistence.document || persistence.syncState === "saving"}
            className="h-9 rounded-xl border border-[#bfd0c5] bg-[#edf5f0] px-3 text-[10px] font-bold text-[#355f4e] hover:border-[#789b88] disabled:opacity-40"
          >
            {isVerifiedAccount ? "Save draft" : "Save locally"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Delete this outfit document? This cannot be undone.")) return;
              void persistence.removeCurrent().catch((error) => showToast(error instanceof Error ? error.message : "Could not delete the outfit."));
            }}
            disabled={!persistence.document}
            className="h-9 rounded-xl border border-[#ead0cb] bg-white px-3 text-[10px] font-bold text-[#9b4b40] hover:bg-[#fff5f3] disabled:opacity-40"
          >Delete</button>
          <span className="ml-auto text-[10px] font-semibold text-[#81786d] md:hidden">{persistence.message}</span>
          {persistence.syncState === "conflict" && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-2 py-1">
              <span className="text-[10px] font-semibold text-amber-800">Newer cloud version</span>
              <button type="button" onClick={() => void persistence.reloadRemote().catch((error) => showToast(error instanceof Error ? error.message : "Reload failed."))} className="rounded-lg bg-white px-2 py-1 text-[9px] font-bold text-amber-900">Reload</button>
              <button type="button" onClick={persistence.saveAsCopy} className="rounded-lg bg-white px-2 py-1 text-[9px] font-bold text-amber-900">Save copy</button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border-b border-[#ded8cd] bg-[#f7f4ef] px-3 py-2 sm:px-5">
        <div className="mx-auto flex w-max min-w-full max-w-[1600px] items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <ToolButton label="Undo" icon="undo" disabled={!editor.past.length} onClick={() => setEditor(undo)} />
            <ToolButton label="Redo" icon="redo" disabled={!editor.future.length} onClick={() => setEditor(redo)} />
            <span className="mx-1 h-6 w-px bg-[#d9d2c7]" />
            <ToolButton label="Backward" icon="back" disabled={!selected} onClick={() => selected && setEditor((current) => sendBackward(current, selected.id))} />
            <ToolButton label="Forward" icon="forward" disabled={!selected} onClick={() => selected && setEditor((current) => bringForward(current, selected.id))} />
            <ToolButton label={selected?.locked ? "Unlock" : "Lock"} icon="lock" active={selected?.locked} disabled={!selected} onClick={() => selected && setEditor((current) => toggleNodeLock(current, selected.id))} />
            <ToolButton label="Delete" icon="trash" disabled={!selected} onClick={() => setEditor(deleteSelected)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] font-medium text-[#8a8176] lg:inline">{editor.present.nodes.length}/{MAX_STUDIO_NODES} pieces · ⌘Z to undo</span>
            <ToolButton label="Clear" icon="clear" disabled={!editor.present.nodes.length} onClick={() => setEditor(clearCanvas)} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid min-h-0 min-w-0 w-full max-w-[1600px] flex-1 gap-3 p-3 sm:p-4 lg:grid-cols-[210px_minmax(420px,1fr)_230px]">
        <aside className="hidden min-h-0 overflow-hidden rounded-[24px] border border-[#ded8cd] bg-[#f8f6f1] lg:flex lg:flex-col">
          <div className="border-b border-[#e2ddd4] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#91877a]">Canvas order</p>
            <p className="mt-0.5 text-xs font-semibold">Layers</p>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {orderedLayers.map((node, index) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setEditor((current) => selectNode(current, node.id))}
                className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left transition ${node.id === selected?.id ? "border-[#a88d67] bg-[#eee6d9]" : "border-transparent hover:bg-white"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white"><img src={node.item.image} alt="" className="h-9 w-9 object-contain" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold">{node.item.title}</span><span className="text-[8px] uppercase tracking-wider text-[#958a7c]">Layer {orderedLayers.length - index}</span></span>
                {node.locked && <span aria-label="Locked" className="text-[10px]">🔒</span>}
              </button>
            ))}
            {!orderedLayers.length && <p className="px-3 py-8 text-center text-[10px] leading-4 text-[#968d82]">Added pieces appear here. The top row renders in front.</p>}
          </div>
        </aside>

        <StudioArtboard
          nodes={editor.present.nodes}
          selectedNodeId={editor.present.selectedNodeId}
          onSelect={(id) => setEditor((current) => selectNode(current, id))}
          onTransform={(id, transform) => setEditor((current) => transformNode(current, id, transform))}
          onDropItem={(itemId, position) => {
            const item = wardrobe.find((candidate) => candidate.id === itemId);
            if (item) addItem(item, position);
          }}
        />

        <aside className="hidden rounded-[24px] border border-[#ded8cd] bg-[#f8f6f1] p-4 lg:block">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#91877a]">Inspector</p>
          {selected ? (
            <div className="mt-4">
              <div className="flex items-center gap-3 border-b border-[#e2ddd4] pb-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white"><img src={selected.item.image} alt="" className="h-12 w-12 object-contain" /></span>
                <div className="min-w-0"><p className="truncate text-xs font-bold">{selected.item.title}</p><p className="mt-1 text-[9px] capitalize text-[#91877a]">{selected.item.category ?? selected.item.slot}</p></div>
              </div>
              <label className="mt-5 block">
                <span className="flex items-center justify-between text-[10px] font-semibold"><span>Rotation</span><span className="tabular-nums text-[#877867]">{Math.round(selected.rotation)}°</span></span>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={selected.rotation}
                  disabled={selected.locked}
                  onChange={(event) => setEditor((current) => transformNode(current, selected.id, { rotation: Number(event.target.value) }))}
                  className="mt-2 w-full accent-[#1f6b55]"
                />
              </label>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {[['X', selected.x], ['Y', selected.y], ['W', selected.width], ['H', selected.height]].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-[#e0d9cf] bg-white px-3 py-2"><p className="text-[8px] font-bold text-[#9a9084]">{label}</p><p className="mt-0.5 font-mono text-[10px]">{Math.round(Number(value) * 100)}%</p></div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-[#dce5df] bg-[#edf5f0] p-3 text-[9px] leading-4 text-[#496455]">
                Visual stacking and physical wearing roles are stored separately, so future analysis cannot confuse front/back order with how garments are worn.
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center text-[10px] leading-5 text-[#91877a]">Select a garment to resize, rotate, reorder, lock, or delete it.</div>
          )}
        </aside>
      </div>

      {analysis && <section aria-label="Outfit analysis" className="mx-auto mb-3 w-[calc(100%-1.5rem)] max-w-[1600px] rounded-2xl border border-[#ded8cd] bg-white p-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#8b8174]">Deterministic analysis</p><p className="mt-1 text-sm font-bold">{analysis.hardValid ? "Physically compatible" : "Creative look · compatibility warnings"} <span className="text-[#1f6b55]">{Math.round(analysis.scores.total * 100)}%</span></p></div><div className="flex gap-2">{analysis.tags.map((tag) => <span key={tag} className="rounded-full bg-[#f1ede6] px-2.5 py-1 text-[10px] font-semibold">{tag}</span>)}</div></div><p className="mt-2 text-xs text-[#675f55]">{analysis.explanation}</p>{analysis.issues.length > 0 && <ul className="mt-3 space-y-1 text-xs text-[#8d5145]">{analysis.issues.map((issue) => <li key={issue.code}>• {issue.message}</li>)}</ul>}<div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{Object.entries(analysis.scores).filter(([key]) => key !== "total").map(([key, value]) => <div key={key} className="rounded-lg bg-[#f8f6f1] px-2 py-1.5 text-center"><p className="text-[8px] uppercase text-[#91877a]">{key}</p><p className="text-xs font-bold">{Math.round(value * 100)}%</p></div>)}</div></section>}
      <WardrobeDock items={wardrobe} loading={wardrobeLoading} onAdd={(item) => addItem(item)} />

      {toast && <div role="status" className="fixed bottom-40 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#292621] px-4 py-2.5 text-xs font-semibold text-white shadow-xl">{toast}</div>}
    </main>
  );
}
