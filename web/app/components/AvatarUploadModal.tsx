"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaveAvatar: (url: string, isCutout: boolean) => void;
};

function downscaleDataUrl(src: string, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
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

async function removeBgFromImage(dataUrl: string): Promise<string> {
  const scaled = await downscaleDataUrl(dataUrl, 900);
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(scaled, {
    output: { format: "image/png", quality: 0.9 },
  });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export default function AvatarUploadModal({ open, onClose, onSaveAvatar }: Props) {
  const [rawPreview, setRawPreview] = useState<string | null>(null);
  const [cutoutPreview, setCutoutPreview] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);
    setStatusText("Preparing photo…");

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setRawPreview(dataUrl);

      if (removeBg) {
        setStatusText("Removing background with AI…");
        try {
          const cutout = await removeBgFromImage(dataUrl);
          setCutoutPreview(cutout);
        } catch (err) {
          setError(
            err instanceof Error
              ? `Background removal failed: ${err.message}`
              : "Could not remove background. You can save the original photo."
          );
        } finally {
          setIsProcessing(false);
          setStatusText("");
        }
      } else {
        setIsProcessing(false);
        setStatusText("");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleToggleRemoveBg() {
    const nextState = !removeBg;
    setRemoveBg(nextState);

    if (nextState && rawPreview && !cutoutPreview && !isProcessing) {
      setIsProcessing(true);
      setError(null);
      setStatusText("Removing background with AI…");
      try {
        const cutout = await removeBgFromImage(rawPreview);
        setCutoutPreview(cutout);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Background removal failed: ${err.message}`
            : "Could not remove background. You can save the original photo."
        );
      } finally {
        setIsProcessing(false);
        setStatusText("");
      }
    }
  }

  async function handleConfirm() {
    if (!rawPreview) return;

    if (removeBg && cutoutPreview) {
      onSaveAvatar(cutoutPreview, true);
      handleClose();
    } else if (removeBg && !cutoutPreview) {
      // Process if not yet processed
      setIsProcessing(true);
      setStatusText("Removing background…");
      try {
        const cutout = await removeBgFromImage(rawPreview);
        onSaveAvatar(cutout, true);
        handleClose();
      } catch {
        // Fallback to original
        onSaveAvatar(rawPreview, false);
        handleClose();
      } finally {
        setIsProcessing(false);
        setStatusText("");
      }
    } else {
      // Original photo without background removal
      const scaled = await downscaleDataUrl(rawPreview, 1200);
      onSaveAvatar(scaled, false);
      handleClose();
    }
  }

  function handleClose() {
    setRawPreview(null);
    setCutoutPreview(null);
    setIsProcessing(false);
    setStatusText("");
    setError(null);
    onClose();
  }

  const activeDisplayUrl = removeBg && cutoutPreview ? cutoutPreview : rawPreview;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Upload Avatar Photo</h2>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] text-[#8A8480] hover:text-[#1A1A1A] transition flex items-center justify-center text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!rawPreview ? (
          <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#C4A882] bg-[#FBF8F1] p-8 text-center hover:bg-[#F3EADA] cursor-pointer transition">
            <div className="h-12 w-12 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-xl">
              ↑
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Select 9:16 Photo</p>
              <p className="text-[11px] text-[#8A8480] mt-1">Full-body portrait works best</p>
            </div>
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            {/* Preview Stage */}
            <div
              className={`relative mx-auto w-44 overflow-hidden rounded-2xl border aspect-[9/16] flex items-center justify-center ${
                removeBg && cutoutPreview
                  ? "bg-[#F7F5F0] border-emerald-300 shadow-sm"
                  : "bg-neutral-100 border-[#E8E3DB]"
              }`}
            >
              {activeDisplayUrl && (
                <img
                  src={activeDisplayUrl}
                  alt="Avatar preview"
                  className={`h-full w-full ${
                    removeBg && cutoutPreview ? "object-contain p-2" : "object-cover"
                  }`}
                />
              )}

              {/* Badges */}
              {removeBg && cutoutPreview && (
                <div className="absolute top-2 left-2 rounded-full bg-emerald-600/90 text-white px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase shadow-xs">
                  ✓ Cutout Ready
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex flex-col items-center justify-center text-white text-center p-3 gap-2">
                  <span className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <p className="text-xs font-medium">{statusText || "Processing…"}</p>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 text-center">
                {error}
              </div>
            )}

            {/* Background removal toggle switch */}
            <div className="flex items-center justify-between rounded-2xl border border-[#E8E3DB] p-3.5 bg-[#F7F5F0]/60">
              <div>
                <p className="text-xs font-semibold text-[#1A1A1A]">Remove Background</p>
                <p className="text-[10px] text-[#8A8480] mt-0.5">
                  {removeBg ? "Clean person cutout without borders" : "Keep original photo background"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleRemoveBg}
                disabled={isProcessing}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none ${
                  removeBg ? "bg-[#1A1A1A]" : "bg-[#E8E3DB]"
                }`}
                aria-pressed={removeBg}
                aria-label="Toggle background removal"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    removeBg ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRawPreview(null);
                  setCutoutPreview(null);
                  setError(null);
                }}
                disabled={isProcessing}
                className="flex-1 rounded-xl border border-[#E8E3DB] py-2.5 text-xs font-semibold text-[#8A8480] hover:text-[#1A1A1A] hover:bg-[#F7F5F0] transition"
              >
                Choose Other
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-[#1A1A1A] py-2.5 text-xs font-semibold text-white hover:bg-black transition shadow-xs disabled:opacity-50"
              >
                Save Avatar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
