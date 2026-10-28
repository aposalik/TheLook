"use client";
import { useEffect, useRef, useState } from "react";
import type { Item } from "@/lib/recommend";
import type { WardrobeAnalysis as GarmentAnalysis } from "@/lib/wardrobe-analysis";

export type RowKey = "tops" | "bottoms" | "accessories" | "single" | "bulk";

export type GarmentKind =
  | "innerwear"
  | "top"
  | "outerwear"
  | "bottom"
  | "dress"
  | "shoe"
  | "accessory";

export const KIND_OPTIONS: Array<{
  kind: GarmentKind;
  label: string;
  slot: string;
  category: "upper" | "bottom" | "shoe" | "accessory" | "dress";
  layer: "base" | "mid" | "outer" | null;
}> = [
  { kind: "innerwear", label: "Innerwear", slot: "innerwear", category: "upper", layer: "base" },
  { kind: "top", label: "Top", slot: "top", category: "upper", layer: "base" },
  { kind: "outerwear", label: "Outerwear", slot: "outerwear", category: "upper", layer: "outer" },
  { kind: "bottom", label: "Bottom", slot: "bottom", category: "bottom", layer: null },
  { kind: "dress", label: "Dress", slot: "dress", category: "dress", layer: null },
  { kind: "shoe", label: "Shoe", slot: "shoe", category: "shoe", layer: null },
  { kind: "accessory", label: "Accessory", slot: "accessory", category: "accessory", layer: null },
];

const MAX_SELECTED_KINDS = 3;

function toggleKindSelection(current: GarmentKind[], clicked: GarmentKind): GarmentKind[] {
  if (current.includes(clicked)) {
    if (current.length <= 1) return current;
    return current.filter((k) => k !== clicked);
  }
  if (current.length < MAX_SELECTED_KINDS) {
    return [...current, clicked];
  }
  // Keep up to 3 categories by replacing the oldest selection
  return [...current.slice(1), clicked];
}

function analysisToKinds(analysis: GarmentAnalysis | null): GarmentKind[] {
  if (!analysis) return ["top"];
  if (Array.isArray(analysis.roles) && analysis.roles.length > 0) {
    return analysis.roles.slice(0, MAX_SELECTED_KINDS);
  }
  if (analysis.category === "bottom") return ["bottom"];
  if (analysis.category === "shoe") return ["shoe"];
  if (analysis.category === "accessory") return ["accessory"];
  if (analysis.category === "dress") return ["dress"];

  const text = `${analysis.subcategory ?? ""} ${analysis.title ?? ""}`.toLowerCase();
  if (/undershirt|tank|camisole|thermal|innerwear|base\s*layer|singlet|bodysuit/.test(text)) {
    return ["innerwear", "top"];
  }
  if (/overshirt|shacket|cardigan|hoodie|half-zip|quarter-zip|flannel|vest|zip-up/.test(text) || analysis.layer === "mid" || analysis.semantics.canWearOpen) {
    return ["top", "outerwear"];
  }
  if (/t-shirt|tee|henley|turtleneck/.test(text)) {
    return ["top", "innerwear"];
  }
  if (analysis.layer === "outer") return ["outerwear"];
  return ["top"];
}

type Props = {
  open: boolean;
  category?: RowKey;
  onClose: () => void;
  onSave: (item: Item | Item[]) => void;
};

type BulkEntry = {
  id: string;
  fallbackName: string;
  preview: string | null;
  title: string;
  selectedKinds: GarmentKind[];
  analysis: GarmentAnalysis | null;
  tagSource: "gemini" | "fallback" | null;
  status: "processing" | "ready" | "error";
  stepText: string;
  error?: string;
};

function downscaleFileOrUrl(src: string, max = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function removeBg(dataUrl: string): Promise<string> {
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(dataUrl, {
    model: "isnet_quint8",
    output: { format: "image/png", quality: 0.85 },
  });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function analyzeGarment(
  dataUrl: string,
  fallbackName: string
): Promise<{ analysis: GarmentAnalysis; source: "gemini" | "fallback"; warning?: string }> {
  const res = await fetch("/api/wardrobe/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64: dataUrl, rowHint: "auto", fallbackName }),
  });
  const data = await res.json();
  if (!res.ok || !data.analysis) throw new Error(data.error ?? "Could not analyze garment");
  return { analysis: data.analysis as GarmentAnalysis, source: data.source ?? "gemini", warning: data.warning };
}

async function fetchImageUrl(url: string): Promise<string> {
  const res = await fetch("/api/wardrobe/fetch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok || !data.dataUrl) throw new Error(data.error ?? "Could not fetch image");
  return data.dataUrl as string;
}

function buildItemFromAnalysis(
  preview: string,
  title: string,
  selectedKinds: GarmentKind[],
  analysis: GarmentAnalysis | null
): Item {
  const kinds: GarmentKind[] = selectedKinds.length > 0 ? selectedKinds.slice(0, MAX_SELECTED_KINDS) : ["top"];
  const primaryKind = kinds[0]!;
  const kindMeta = KIND_OPTIONS.find((k) => k.kind === primaryKind) ?? KIND_OPTIONS[1]!;

  const hasInner = kinds.includes("innerwear");
  const hasTop = kinds.includes("top");
  const hasOuter = kinds.includes("outerwear");

  const category =
    hasInner || hasTop || hasOuter
      ? "upper"
      : kindMeta.category;

  const layer =
    category === "upper"
      ? hasTop && hasOuter
        ? "mid"
        : hasOuter && !hasTop && !hasInner
          ? "outer"
          : hasInner && !hasTop && !hasOuter
            ? "base"
            : analysis?.layer === "mid"
              ? "mid"
              : "base"
      : null;

  return {
    id: crypto.randomUUID(),
    slot: kindMeta.slot,
    slots: kinds.map((k) => KIND_OPTIONS.find((o) => o.kind === k)?.slot ?? k),
    title: title.trim() || analysis?.title || kindMeta.label,
    color: analysis?.dominantColor ?? "#8A8480",
    palette: analysis?.palette ?? "neutral",
    image: preview,
    category,
    layer,
    formality: analysis?.formality ?? 2,
    fit: analysis?.fit === "baggy" ? "oversized" : (analysis?.fit ?? "regular"),
    color_role: analysis?.colorRole ?? "neutral",
    subcategory: analysis?.subcategory ?? kindMeta.label.toLowerCase(),
    seasons: analysis?.seasons,
    styles: analysis?.styles,
    material: analysis?.material,
    description: analysis?.description,
    source: "user",
    gender: analysis?.gender ?? "men",
    semantics: analysis?.semantics,
  };
}

export default function AddItemModal({ open, category = "single", onClose, onSave }: Props) {
  const [mode, setMode] = useState<"device" | "bulk" | "link">(
    category === "bulk" ? "bulk" : "device"
  );

  // Single / Link state
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedKinds, setSelectedKinds] = useState<GarmentKind[]>(["top"]);
  const [linkUrl, setLinkUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GarmentAnalysis | null>(null);
  const [tagSource, setTagSource] = useState<"gemini" | "fallback" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk state
  const [bulkItems, setBulkItems] = useState<BulkEntry[]>([]);
  const [bulkWorking, setBulkWorking] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const bulkFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setMode(category === "bulk" ? "bulk" : "device");
    }
  }, [open, category]);

  function resetAndClose() {
    setPreview(null);
    setTitle("");
    setSelectedKinds(["top"]);
    setLinkUrl("");
    setAnalysis(null);
    setTagSource(null);
    setError(null);
    setWorking(false);
    setStep(null);
    setBulkItems([]);
    setBulkWorking(false);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetAndClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  async function processSingleImage(srcUrl: string, fallbackName: string) {
    setError(null);
    setWorking(true);

    try {
      setStep("Preparing image…");
      const scaled = await downscaleFileOrUrl(srcUrl, 720);
      setPreview(scaled);

      // Run background removal and AI garment analysis in parallel for speed!
      setStep("Auto-detecting category & removing background…");
      const [cutoutResult, analyzeResult] = await Promise.allSettled([
        removeBg(scaled),
        analyzeGarment(scaled, fallbackName),
      ]);

      if (cutoutResult.status === "fulfilled") {
        setPreview(cutoutResult.value);
      }

      if (analyzeResult.status === "fulfilled") {
        const res = analyzeResult.value;
        setAnalysis(res.analysis);
        setTagSource(res.source);
        setTitle(res.analysis.title || fallbackName);
        setSelectedKinds(analysisToKinds(res.analysis));
      } else {
        setTitle(fallbackName);
        setSelectedKinds(["top"]);
      }
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setWorking(false);
      setStep(null);
    }
  }

  async function handleSingleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const fallback = file.name.replace(/\.[^.]+$/, "");
    try {
      await processSingleImage(objectUrl, fallback);
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleBulkFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setError(null);
    setBulkWorking(true);

    const entries: BulkEntry[] = files.map((f) => {
      const fallbackName = f.name.replace(/\.[^.]+$/, "");
      return {
        id: `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fallbackName,
        preview: null,
        title: fallbackName,
        selectedKinds: ["top"],
        analysis: null,
        tagSource: null,
        status: "processing",
        stepText: "Queued…",
      };
    });

    setBulkItems((prev) => [...prev, ...entries]);

    // Process files with concurrency of 2 so UI stays responsive and fast
    const queue = files.map((file, idx) => ({ file, entryId: entries[idx]!.id, fallbackName: entries[idx]!.fallbackName }));
    if (bulkFileRef.current) bulkFileRef.current.value = "";

    async function processOne(item: { file: File; entryId: string; fallbackName: string }) {
      const objectUrl = URL.createObjectURL(item.file);
      try {
        setBulkItems((prev) =>
          prev.map((b) => (b.id === item.entryId ? { ...b, stepText: "Preparing…" } : b))
        );
        const scaled = await downscaleFileOrUrl(objectUrl, 720);
        setBulkItems((prev) =>
          prev.map((b) => (b.id === item.entryId ? { ...b, preview: scaled, stepText: "AI analyzing…" } : b))
        );

        const [cutoutRes, analyzeRes] = await Promise.allSettled([
          removeBg(scaled),
          analyzeGarment(scaled, item.fallbackName),
        ]);

        const finalPreview = cutoutRes.status === "fulfilled" ? cutoutRes.value : scaled;
        const detected = analyzeRes.status === "fulfilled" ? analyzeRes.value : null;
        const suggestedKinds = detected ? analysisToKinds(detected.analysis) : (["top"] as GarmentKind[]);

        setBulkItems((prev) =>
          prev.map((b) =>
            b.id === item.entryId
              ? {
                  ...b,
                  preview: finalPreview,
                  title: detected?.analysis.title || item.fallbackName,
                  selectedKinds: suggestedKinds,
                  analysis: detected?.analysis ?? null,
                  tagSource: detected?.source ?? "fallback",
                  status: "ready",
                  stepText: "Ready",
                }
              : b
          )
        );
      } catch (err) {
        setBulkItems((prev) =>
          prev.map((b) =>
            b.id === item.entryId
              ? {
                  ...b,
                  status: "error",
                  stepText: "Failed",
                  error: err instanceof Error ? err.message : "Failed to process",
                }
              : b
          )
        );
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) await processOne(next);
      }
    });

    await Promise.all(workers);
    setBulkWorking(false);
  }

  async function fetchFromLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setError(null);
    setWorking(true);
    setStep("Fetching image…");
    try {
      const raw = await fetchImageUrl(url);
      const fallback = url.split("/").pop()?.split("?")[0]?.replace(/\.[^.]+$/, "") ?? "Item";
      await processSingleImage(raw, fallback);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch that URL (CORS or bad link).");
      setWorking(false);
      setStep(null);
    }
  }

  function saveSingle() {
    if (!preview) {
      setError("Pick an image first.");
      return;
    }
    const item = buildItemFromAnalysis(preview, title, selectedKinds, analysis);
    onSave(item);
    resetAndClose();
  }

  function saveBulk() {
    const readyEntries = bulkItems.filter((b) => b.status === "ready" && b.preview);
    if (!readyEntries.length) {
      setError("No ready items to add.");
      return;
    }
    const createdItems: Item[] = readyEntries.map((entry) =>
      buildItemFromAnalysis(entry.preview!, entry.title, entry.selectedKinds, entry.analysis)
    );
    onSave(createdItems);
    resetAndClose();
  }

  const readyBulkCount = bulkItems.filter((b) => b.status === "ready").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={resetAndClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add to wardrobe"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">
              {mode === "bulk" ? "Bulk Add to Wardrobe" : "Add to Your Wardrobe"}
            </h2>
            <p className="text-xs text-[#8A8480] mt-0.5">
              Upload your clothes — AI automatically suggests the category &amp; removes the background.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] text-[#8A8480] hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="mt-4 inline-flex rounded-xl bg-[#F7F5F0] p-1 w-full">
          <button
            type="button"
            onClick={() => setMode("device")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === "device" ? "bg-white shadow-sm text-[#1A1A1A]" : "text-[#8A8480]"
            }`}
          >
            Single Item
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === "bulk" ? "bg-white shadow-sm text-[#1A1A1A]" : "text-[#8A8480]"
            }`}
          >
            Bulk Upload
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              mode === "link" ? "bg-white shadow-sm text-[#1A1A1A]" : "text-[#8A8480]"
            }`}
          >
            From Link
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-0.5">
          {mode === "bulk" ? (
            <>
              <div
                onClick={() => !bulkWorking && bulkFileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C4A882] bg-[#FBF8F1] p-5 text-center hover:bg-[#F3EADA] cursor-pointer transition"
              >
                <div className="h-10 w-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-lg">
                  ++
                </div>
                <p className="text-sm font-semibold text-[#1A1A1A]">
                  {bulkItems.length > 0 ? "Select more clothes to add" : "Select multiple photos at once"}
                </p>
                <p className="text-[11px] text-[#8A8480]">
                  Pick tops, bottoms, shoes, or accessories together — AI will classify each one
                </p>
                <input
                  ref={bulkFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleBulkFiles}
                />
              </div>

              {bulkItems.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-[#1A1A1A]">
                      Selected Pieces ({bulkItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setBulkItems([])}
                      disabled={bulkWorking}
                      className="text-[11px] font-medium text-[#8A8480] hover:text-[#1A1A1A] disabled:opacity-40"
                    >
                      Clear list
                    </button>
                  </div>

                  {bulkItems.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex gap-3 rounded-2xl border border-[#E8E3DB] bg-white p-3 items-start"
                    >
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#F7F5F0] overflow-hidden border border-[#E8E3DB]">
                        {entry.preview ? (
                          <img src={entry.preview} alt={entry.title} className="h-full w-full object-contain p-1" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-[#C4A882] border-t-transparent animate-spin" />
                        )}
                        {entry.status === "processing" && entry.preview && (
                          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={entry.title}
                            onChange={(e) =>
                              setBulkItems((prev) =>
                                prev.map((b) => (b.id === entry.id ? { ...b, title: e.target.value } : b))
                              )
                            }
                            placeholder="Item name"
                            className="w-full rounded-lg border border-[#E8E3DB] px-2.5 py-1 text-xs font-medium text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                          />
                          <button
                            type="button"
                            onClick={() => setBulkItems((prev) => prev.filter((b) => b.id !== entry.id))}
                            className="h-6 w-6 shrink-0 rounded-full text-xs text-[#8A8480] hover:bg-[#F7F5F0] hover:text-[#1A1A1A]"
                            aria-label="Remove item"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Auto-suggested category selector pills (up to 3) */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {KIND_OPTIONS.map((opt) => {
                              const active = entry.selectedKinds.includes(opt.kind);
                              return (
                                <button
                                  key={opt.kind}
                                  type="button"
                                  onClick={() =>
                                    setBulkItems((prev) =>
                                      prev.map((b) =>
                                        b.id === entry.id
                                          ? { ...b, selectedKinds: toggleKindSelection(b.selectedKinds, opt.kind) }
                                          : b
                                      )
                                    )
                                  }
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                                    active
                                      ? "bg-[#1A1A1A] text-white"
                                      : "bg-[#F7F5F0] text-[#8A8480] hover:text-[#1A1A1A]"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-[#8A8480]">
                            Select 1–3 categories ({entry.selectedKinds.length}/{MAX_SELECTED_KINDS} selected)
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-[#8A8480]">
                          {entry.status === "processing" ? (
                            <span className="text-[#C4A882] font-medium">{entry.stepText}</span>
                          ) : entry.status === "error" ? (
                            <span className="text-[#C44]">{entry.error ?? "Error"}</span>
                          ) : (
                            <>
                              {entry.tagSource === "gemini" && (
                                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-700">
                                  ✦ Auto-suggested
                                </span>
                              )}
                              {entry.analysis && (
                                <span className="truncate">
                                  {entry.analysis.subcategory} · {entry.analysis.palette}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : mode === "device" ? (
            <div
              onClick={() => !working && fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C4A882] bg-[#FBF8F1] p-6 text-center hover:bg-[#F3EADA] cursor-pointer transition"
            >
              {working ? (
                <>
                  <div className="h-10 w-10 rounded-full border-2 border-[#C4A882] border-t-transparent animate-spin" />
                  <p className="text-sm font-semibold text-[#1A1A1A]">{step ?? "Working…"}</p>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xl">
                    ↑
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Click to choose a photo</p>
                  <p className="text-[11px] text-[#8A8480]">
                    Any top, bottom, dress, shoe, or accessory — AI auto-detects the category
                  </p>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSingleFile} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#1A1A1A]">Image URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…/garment.jpg"
                  className="flex-1 rounded-xl border border-[#E8E3DB] px-3 py-2 text-sm outline-none focus:border-[#1A1A1A]"
                />
                <button
                  type="button"
                  onClick={fetchFromLink}
                  disabled={!linkUrl || working}
                  className="rounded-xl bg-[#1A1A1A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {working ? "…" : "Fetch"}
                </button>
              </div>
              {working && <p className="text-xs text-[#8A8480]">{step}</p>}
            </div>
          )}

          {/* Single / Link Preview + Auto-Suggested Category Picker */}
          {mode !== "bulk" && preview && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E8E3DB] p-3.5 bg-white">
              <div className="flex gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-[#F7F5F0] border border-[#E8E3DB] p-1">
                  <img src={preview} alt="preview" className="h-full w-full object-contain rounded-lg" />
                </div>
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <label className="text-[11px] font-semibold uppercase text-[#8A8480]">Name</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Item name"
                    className="rounded-xl border border-[#E8E3DB] px-3 py-2 text-sm outline-none focus:border-[#1A1A1A]"
                  />
                  {analysis && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {tagSource === "gemini" ? (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                          ✦ AI auto-suggested
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                          Suggested tags
                        </span>
                      )}
                      <span className="text-[10px] text-[#8A8480]">
                        {analysis.subcategory} · {analysis.palette} · {analysis.fit}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Category selector after picking clothes (1–3 categories) */}
              <div className="pt-2 border-t border-[#E8E3DB]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8480]">
                    Categories {tagSource === "gemini" ? "(Auto-Suggested)" : ""}
                  </span>
                  <span className="text-[10px] text-[#8A8480]">
                    Select 1–3 ({selectedKinds.length}/{MAX_SELECTED_KINDS} selected)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {KIND_OPTIONS.map((opt) => {
                    const active = selectedKinds.includes(opt.kind);
                    return (
                      <button
                        key={opt.kind}
                        type="button"
                        onClick={() => setSelectedKinds((prev) => toggleKindSelection(prev, opt.kind))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? "bg-[#1A1A1A] text-white shadow-xs"
                            : "bg-[#F7F5F0] text-[#8A8480] hover:text-[#1A1A1A]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-[#C44]">{error}</p>}

        <div className="mt-5 pt-3 border-t border-[#E8E3DB] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-[#8A8480] hover:text-[#1A1A1A] transition"
          >
            Cancel
          </button>
          {mode === "bulk" ? (
            <button
              type="button"
              onClick={saveBulk}
              disabled={readyBulkCount === 0 || bulkWorking}
              className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {bulkWorking
                ? "Processing batch…"
                : `Add ${readyBulkCount > 0 ? `${readyBulkCount} ` : ""}to wardrobe`}
            </button>
          ) : (
            <button
              type="button"
              onClick={saveSingle}
              disabled={!preview || working}
              className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Add to wardrobe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
