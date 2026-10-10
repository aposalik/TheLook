"use client";
import type { Item } from "@/lib/recommend";

type Avatar = { id: string; url: string };
type Props = {
  activeItem: Item | null; customPhoto: string | null; tryOnResult: string | null;
  mockPreview: { photo: string; garment: string; title: string } | null;
  isLoading: boolean; error: string | null;
  avatars: Avatar[]; activeAvatarId: string | null;
  onSelectAvatar: (id: string) => void; onRemoveAvatar: (id: string) => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTryOn: () => void;
  onPrevAvatar: () => void; onNextAvatar: () => void;
  onSaveLook: () => void; onOpenLook: () => void;
};

export default function AvatarStage({
  activeItem, customPhoto, tryOnResult, mockPreview, isLoading, error,
  avatars, activeAvatarId, onSelectAvatar, onRemoveAvatar, onPhotoUpload, onTryOn,
  onPrevAvatar, onNextAvatar, onSaveLook, onOpenLook,
}: Props) {
  const resultImg = tryOnResult ?? mockPreview?.garment ?? null; // a rendered look (clickable + savable)
  const previewImg = resultImg ?? customPhoto;                   // what fills the 9:16 stage
  const canSwitch = avatars.length > 1;

  return (
    <section className="flex flex-col rounded-3xl border border-[#E8E3DB] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E3DB]">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">Avatar &amp; Preview</h2>
          <p className="text-xs text-[#8A8480] mt-0.5">Upload 9:16 photos — saved &amp; switchable</p>
        </div>
        <label className="cursor-pointer rounded-lg bg-[#1A1A1A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333]">
          + Upload photo<input type="file" accept="image/*" onChange={onPhotoUpload} className="hidden" />
        </label>
      </div>

      {/* 9:16 portrait stage */}
      <div className="relative mx-auto my-4 w-full max-w-[360px] px-4">
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0]" style={{ aspectRatio: "9 / 16" }}>
          {isLoading ? (
            <div className="tryon-generator absolute inset-0 isolate overflow-hidden bg-[#171715] text-center text-white" role="status" aria-live="polite">
              {customPhoto && <img src={customPhoto} alt="" className="tryon-generator__photo" aria-hidden="true" />}
              <div className="tryon-generator__veil" />
              <div className="tryon-generator__grain" />
              <div className="tryon-generator__scan" />
              <span className="tryon-generator__corner tryon-generator__corner--tl" />
              <span className="tryon-generator__corner tryon-generator__corner--tr" />
              <span className="tryon-generator__corner tryon-generator__corner--bl" />
              <span className="tryon-generator__corner tryon-generator__corner--br" />

              <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
                <div className="tryon-generator__halo">
                  <img src="/brand/thelook-logo-dark.png" alt="TheLook" className="w-36 object-contain" />
                </div>
                <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.34em] text-[#D9C6A8]">Virtual atelier</p>
                <h3 className="mt-2 text-xl font-medium tracking-[-0.02em]">Generating your try-on</h3>
                <p className="mt-2 max-w-[230px] text-xs leading-relaxed text-white/55">Draping your selected pieces and refining the final silhouette.</p>

                <div className="tryon-generator__progress mt-7" aria-hidden="true"><span /></div>
                <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/45" aria-hidden="true">
                  <span className="tryon-generator__step">Fit</span>
                  <span>·</span>
                  <span className="tryon-generator__step tryon-generator__step--two">Layers</span>
                  <span>·</span>
                  <span className="tryon-generator__step tryon-generator__step--three">Finish</span>
                </div>
                <p className="mt-7 text-[10px] tracking-wide text-white/35">Powered by YouCam Cloth-v4</p>
              </div>
            </div>
          ) : resultImg ? (
            <button onClick={onOpenLook} className="group absolute inset-0 h-full w-full" title="See the pieces in this look">
              <img src={resultImg} alt="Try-on result" className="h-full w-full object-cover" />
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">Tap to see the pieces</span>
              {mockPreview && <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">Mock</span>}
            </button>
          ) : previewImg ? (
            <img src={previewImg} alt="Your avatar" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="h-16 w-16 rounded-2xl bg-[#EDE5D8] flex items-center justify-center">
                <svg className="h-8 w-8 text-[#C4A882]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <p className="text-sm font-semibold text-[#1A1A1A]">No avatar yet</p>
              <p className="text-xs text-[#8A8480] max-w-[200px]">Upload a full-body 9:16 photo to start.</p>
            </div>
          )}

          {/* carousel arrows (switch avatars) */}
          {canSwitch && !isLoading && (
            <>
              <button onClick={onPrevAvatar} aria-label="Previous avatar" className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1A1A1A] shadow hover:bg-white">‹</button>
              <button onClick={onNextAvatar} aria-label="Next avatar" className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1A1A1A] shadow hover:bg-white">›</button>
            </>
          )}
        </div>
      </div>

      {/* saved avatars strip */}
      {avatars.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-6">
          {avatars.map((av) => (
            <div key={av.id} className="relative">
              <button onClick={() => onSelectAvatar(av.id)} className={`block h-12 w-12 overflow-hidden rounded-lg border transition ${av.id === activeAvatarId ? "border-[#1A1A1A] ring-2 ring-[#C4A882]" : "border-[#E8E3DB] hover:border-[#C4A882]"}`}>
                <img src={av.url} alt="avatar" className="h-full w-full object-cover" />
              </button>
              <button onClick={() => onRemoveAvatar(av.id)} aria-label="Remove avatar" className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-[#1A1A1A] text-[11px] leading-5 text-white">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 px-6 pb-5 pt-3 border-t border-[#E8E3DB]">
        <button onClick={onSaveLook} disabled={!resultImg} title={resultImg ? "Save to your lookbook" : "Render a look first"} className="rounded-xl border border-[#E8E3DB] bg-white px-4 py-2.5 text-sm font-medium text-[#1A1A1A] transition hover:border-[#C4A882] active:scale-95 disabled:opacity-40">Save look</button>
        <button onClick={onTryOn} disabled={isLoading || !customPhoto} className="flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#333] active:scale-95 disabled:opacity-40">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {isLoading ? "Rendering…" : "Show On Me"}
        </button>
      </div>
      {error && <p className="px-6 pb-4 text-xs text-red-500">{error}</p>}
    </section>
  );
}
