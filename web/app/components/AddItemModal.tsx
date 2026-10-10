"use client";
import { useEffect, useRef, useState } from "react";
import type { Item } from "@/lib/recommend";

export type RowKey = "tops" | "bottoms" | "accessories";

type Props = {
  open: boolean;
  category: RowKey;
  onClose: () => void;
  onSave: (item: Item) => void;
};

const SLOT_FOR_ROW: Record<RowKey, { slot: string; category: string; layer: string | null }> = {
  tops: { slot: "top", category: "upper", layer: "base" },
  bottoms: { slot: "bottom", category: "bottom", layer: null },
  accessories: { slot: "accessory", category: "accessory", layer: null },
};

const LABEL_FOR_ROW: Record<RowKey, string> = {
  tops: "Top",
  bottoms: "Bottom",
  accessories: "Accessory",
};

type GarmentAnalysis = {
  title: string;
  category: "upper" | "bottom" | "shoe" | "accessory" | "dress";
  subcategory: string;
  layer: "base" | "mid" | "outer" | null;
  dominantColor: string;
  palette: "warm" | "cool" | "neutral";
  colorRole: "neutral" | "accent";
  fit: "slim" | "regular" | "relaxed" | "baggy";
  formality: number;
  seasons: string[];
  styles: string[];
  material: string;
  description: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downscaleDataUrl(src: string, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function removeBg(dataUrl: string): Promise<string> {
  // Dynamic import so the heavy WASM bundle only loads when needed
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(dataUrl, { output: { format: "image/png", quality: 0.9 } });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function analyzeGarment(dataUrl: string, rowHint: RowKey, fallbackName: string): Promise<GarmentAnalysis> {
  const res = await fetch("/api/wardrobe/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64: dataUrl, rowHint, fallbackName }),
  });
  const data = await res.json();
  if (!res.ok || !data.analysis) throw new Error(data.error ?? "Could not analyze garment");
  return data.analysis as GarmentAnalysis;
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

export default function AddItemModal({ open, category, onClose, onSave }: Props) {
  const [mode, setMode] = useState<"device" | "link">("device");
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GarmentAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function resetAndClose() {
    setPreview(null); setTitle(""); setLinkUrl(""); setAnalysis(null); setError(null);
    setMode("device"); setWorking(false); setStep(null);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") resetAndClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  async function processImage(rawDataUrl: string, fallbackName: string) {
    setError(null); setWorking(true);

    try {
      // 1. Downscale first so bg-removal is faster
      setStep("Preparing image…");
      const scaled = await downscaleDataUrl(rawDataUrl);

      // 2. Remove background
      setStep("Removing background…");
      let processed = scaled;
      try {
        processed = await removeBg(scaled);
      } catch {
        // bg removal failed (WASM not supported etc.) — continue with original
      }

      setPreview(processed);

      // 3. Gemini Vision creates the complete catalog record. The original
      // pixels are never persisted; only the processed transparent cutout is saved.
      setStep("Analyzing category, color and style…");
      const meta = await analyzeGarment(scaled, category, fallbackName);
      setAnalysis(meta);
      setTitle(meta.title || fallbackName);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setWorking(false); setStep(null);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await fileToDataUrl(file);
    const fallback = file.name.replace(/\.[^.]+$/, "");
    await processImage(raw, fallback);
  }

  async function fetchFromLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setError(null); setWorking(true); setStep("Fetching image…");
    try {
      const raw = await fetchImageUrl(url);
      const dataUrl = await downscaleDataUrl(raw);
      const fallback = url.split("/").pop()?.split("?")[0]?.replace(/\.[^.]+$/, "") ?? "Item";
      await processImage(dataUrl, fallback);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch that URL (CORS or bad link).");
      setWorking(false); setStep(null);
    }
  }

  function save() {
    if (!preview) { setError("Pick an image first."); return; }
    const hinted = SLOT_FOR_ROW[category];
    const detectedCategory = analysis?.category ?? hinted.category;
    const slot = detectedCategory === "bottom" ? "bottom"
      : detectedCategory === "shoe" ? "shoe"
      : detectedCategory === "accessory" ? "accessory"
      : detectedCategory === "dress" ? "dress"
      : analysis?.layer === "outer" ? "outerwear" : "top";
    const item: Item = {
      id: `user_${detectedCategory}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      slot,
      title: title.trim() || analysis?.title || LABEL_FOR_ROW[category],
      color: analysis?.dominantColor ?? "#8A8480",
      palette: analysis?.palette ?? "neutral",
      image: preview,
      category: detectedCategory,
      layer: analysis?.layer ?? hinted.layer,
      formality: analysis?.formality ?? 2,
      fit: analysis?.fit ?? "regular",
      color_role: analysis?.colorRole ?? "neutral",
      subcategory: analysis?.subcategory,
      seasons: analysis?.seasons,
      styles: analysis?.styles,
      material: analysis?.material,
      description: analysis?.description,
      source: "user",
    };
    onSave(item);
    resetAndClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={resetAndClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Add new ${LABEL_FOR_ROW[category]}`}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Add a {LABEL_FOR_ROW[category].toLowerCase()}</h2>
            <p className="text-xs text-[#8A8480] mt-0.5">Background will be removed automatically.</p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] text-[#8A8480] hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition"
            aria-label="Close"
          >×</button>
        </div>

        <div className="mt-5 inline-flex rounded-xl bg-[#F7F5F0] p-1 w-full">
          <button
            type="button"
            onClick={() => setMode("device")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === "device" ? "bg-white shadow-sm text-[#1A1A1A]" : "text-[#8A8480]"}`}
          >From device</button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === "link" ? "bg-white shadow-sm text-[#1A1A1A]" : "text-[#8A8480]"}`}
          >From link</button>
        </div>

        <div className="mt-5">
          {mode === "device" ? (
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
                  <div className="h-10 w-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xl">↑</div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Click to choose a file</p>
                  <p className="text-[11px] text-[#8A8480]">PNG or JPG · background removed automatically</p>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
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
                >{working ? "…" : "Fetch"}</button>
              </div>
              {working && <p className="text-xs text-[#8A8480]">{step}</p>}
            </div>
          )}
        </div>

        {preview && (
          <div className="mt-5 flex gap-4 rounded-2xl border border-[#E8E3DB] p-3">
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-[#F7F5F0]">
              <img src={preview} alt="preview" className="h-full w-full object-contain rounded-lg" />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase text-[#8A8480]">Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={LABEL_FOR_ROW[category]}
                className="rounded-xl border border-[#E8E3DB] px-3 py-2 text-sm outline-none focus:border-[#1A1A1A]"
              />
              <p className="text-[10px] text-[#8A8480]">
                {analysis ? (
                  <>Detected <span className="font-semibold">{analysis.subcategory}</span> · {analysis.palette} · {analysis.fit}</>
                ) : (
                  <>Saved to <span className="font-semibold capitalize">{category}</span>.</>
                )}
              </p>
              {analysis && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {[analysis.category, analysis.layer, ...analysis.styles.slice(0, 2)].filter(Boolean).map((tag) => (
                    <span key={tag} className="rounded-full bg-[#F3EADA] px-2 py-0.5 text-[9px] font-semibold text-[#735F43]">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-[#C44]">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-[#8A8480] hover:text-[#1A1A1A] transition"
          >Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={!preview || working}
            className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >Add to wardrobe</button>
        </div>
      </div>
    </div>
  );
}
