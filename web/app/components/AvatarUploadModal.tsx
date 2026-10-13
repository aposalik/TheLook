"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaveAvatar: (url: string, isCutout: boolean) => void;
};

export default function AvatarUploadModal({ open, onClose, onSaveAvatar }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPreview, setRawPreview] = useState<string | null>(null);
  const [cutoutPreview, setCutoutPreview] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");

  if (!open) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setCutoutPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      setRawPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleConfirm() {
    if (!rawPreview) return;
    setIsProcessing(true);

    try {
      if (removeBg) {
        setStatusText("Removing background…");
        // Run client-side WASM background removal
        const { removeBackground } = await import("@imgly/background-removal");
        const blob = await removeBackground(rawPreview, { output: { format: "image/png", quality: 0.9 } });
        const reader = new FileReader();
        reader.onload = () => {
          const cutoutUrl = reader.result as string;
          onSaveAvatar(cutoutUrl, true);
          handleClose();
        };
        reader.readAsDataURL(blob);
      } else {
        onSaveAvatar(rawPreview, false);
        handleClose();
      }
    } catch {
      // Fallback if background removal fails
      onSaveAvatar(rawPreview, false);
      handleClose();
    } finally {
      setIsProcessing(false);
      setStatusText("");
    }
  }

  function handleClose() {
    setSelectedFile(null);
    setRawPreview(null);
    setCutoutPreview(null);
    setIsProcessing(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
            className="h-8 w-8 rounded-full border border-[#E8E3DB] text-[#8A8480] hover:text-[#1A1A1A] transition"
            aria-label="Close"
          >
            ×
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
            <div className="relative mx-auto w-40 overflow-hidden rounded-2xl bg-[#F7F5F0] border border-[#E8E3DB] aspect-[9/16] flex items-center justify-center">
              <img
                src={rawPreview}
                alt="Avatar preview"
                className={`h-full w-full object-cover transition ${removeBg ? "filter brightness-95" : ""}`}
              />
              {removeBg && (
                <div className="absolute top-2 left-2 rounded-full bg-emerald-500/90 text-white px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase">
                  Cutout Mode
                </div>
              )}
            </div>

            {/* Background removal toggle switch */}
            <div className="flex items-center justify-between rounded-2xl border border-[#E8E3DB] p-3.5 bg-[#F7F5F0]/60">
              <div>
                <p className="text-xs font-semibold text-[#1A1A1A]">Remove Background</p>
                <p className="text-[10px] text-[#8A8480] mt-0.5">
                  {removeBg ? "Clean cutout without borders" : "Keep original photo background"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRemoveBg(!removeBg)}
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

            {statusText && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#8A8480] py-1">
                <span className="h-3 w-3 rounded-full border-2 border-[#C4A882] border-t-transparent animate-spin" />
                <span>{statusText}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-[#8A8480] hover:text-[#1A1A1A] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-[#1A1A1A] py-2.5 text-xs font-semibold text-white shadow transition hover:bg-[#333] disabled:opacity-40"
              >
                {isProcessing ? "Processing…" : "Use as Avatar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

