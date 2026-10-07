"use client";
import type { Item } from "@/lib/recommend";
import ModelViewer from "./ModelViewer";

type Avatar = { id: string; url: string };
type Props = {
  activeItem: Item | null; customPhoto: string | null; tryOnResult: string | null;
  mockPreview: { photo: string; garment: string; title: string } | null;
  isLoading: boolean; error: string | null;
  avatars: Avatar[]; activeAvatarId: string | null;
  onSelectAvatar: (id: string) => void; onRemoveAvatar: (id: string) => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTryOn: () => void;
  model3dUrl: string | null; is3dLoading: boolean;
  onSeeAs3D: () => void; onExit3D: () => void;
};

export default function AvatarStage({
  activeItem, customPhoto, tryOnResult, mockPreview, isLoading, error,
  avatars, activeAvatarId, onSelectAvatar, onRemoveAvatar, onPhotoUpload, onTryOn,
  model3dUrl, is3dLoading, onSeeAs3D, onExit3D,
}: Props) {
  const canConvert = !!(tryOnResult || mockPreview || customPhoto);
  return (
    <section className="flex flex-col rounded-3xl border border-[#E8E3DB] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E3DB]">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">Avatar & Preview</h2>
          <p className="text-xs text-[#8A8480] mt-0.5">Upload your photos — saved here and switchable anytime</p>
        </div>
        <label className="cursor-pointer rounded-lg bg-[#1A1A1A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333]">
          + Upload photo<input type="file" accept="image/*" onChange={onPhotoUpload} className="hidden" />
        </label>
      </div>

      {/* saved avatars strip (switchable) */}
      {avatars.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pt-4">
          {avatars.map((av) => (
            <div key={av.id} className="relative">
              <button
                onClick={() => onSelectAvatar(av.id)}
                className={`block h-14 w-14 overflow-hidden rounded-xl border transition ${av.id === activeAvatarId ? "border-[#1A1A1A] ring-2 ring-[#C4A882]" : "border-[#E8E3DB] hover:border-[#C4A882]"}`}
              >
                <img src={av.url} alt="avatar" className="h-full w-full object-cover" />
              </button>
              <button
                onClick={() => onRemoveAvatar(av.id)}
                aria-label="Remove avatar"
                className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-[#1A1A1A] text-[11px] leading-5 text-white"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="relative mx-6 my-4 flex flex-1 min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-[#E8E3DB] bg-[#F7F5F0]/60">
        {is3dLoading ? (
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-[#EDE5D8]" />
              <div className="absolute inset-0 rounded-full border-4 border-[#C4A882] border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Building 3D model…</p>
            <p className="text-xs text-[#8A8480]">Reconstructing from your photo</p>
          </div>
        ) : model3dUrl ? (
          <div className="w-full p-4">
            <ModelViewer src={model3dUrl} />
            <div className="mt-3 flex justify-center">
              <button onClick={onExit3D} className="rounded-xl border border-[#E8E3DB] bg-white px-4 py-2 text-xs font-medium text-[#1A1A1A] hover:border-[#C4A882]">← Back to photo</button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-[#EDE5D8]" />
              <div className="absolute inset-0 rounded-full border-4 border-[#C4A882] border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Generating Try-On…</p>
            <p className="text-xs text-[#8A8480]">Rendering apparel via YouCam Cloth-v4</p>
          </div>
        ) : mockPreview ? (
          <div className="flex flex-col items-center p-4 gap-3">
            <img src={mockPreview.garment} alt={mockPreview.title} className="max-h-[360px] w-full object-contain rounded-lg" />
            <div className="flex items-center gap-2 rounded-full border border-[#EDE5D8] bg-[#F7F5F0] px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C4A882]" />
              <span className="text-[11px] text-[#8A8480]">Mock mode — real render needs a live API key</span>
            </div>
          </div>
        ) : tryOnResult ? (
          <div className="flex flex-col items-center p-4">
            <img src={tryOnResult} alt="Try-on result" className="max-h-[400px] rounded-xl object-contain shadow-md" />
          </div>
        ) : customPhoto ? (
          <div className="flex flex-col items-center p-4">
            <img src={customPhoto} alt="Your avatar" className="max-h-[400px] rounded-xl object-contain shadow-sm" />
            <span className="mt-3 rounded-full bg-[#EDE5D8] px-3 py-1 text-[11px] font-medium text-[#8A8480]">Build a look below, then press Show on me</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center p-8">
            <div className="h-16 w-16 rounded-2xl bg-[#EDE5D8] flex items-center justify-center">
              <svg className="h-8 w-8 text-[#C4A882]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
            <p className="text-sm font-semibold text-[#1A1A1A]">No avatar yet</p>
            <p className="text-xs text-[#8A8480] max-w-[220px]">Upload a full-body photo to start — it&apos;s saved so you can switch between looks.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-3 border-t border-[#E8E3DB]">
        <button
          onClick={onSeeAs3D}
          disabled={!canConvert || is3dLoading || isLoading}
          title={canConvert ? "Reconstruct a 3D model" : "Render a look or upload a photo first"}
          className="rounded-xl border border-[#E8E3DB] bg-white px-4 py-2.5 text-sm font-medium text-[#1A1A1A] transition hover:border-[#C4A882] active:scale-95 disabled:opacity-40"
        >
          {is3dLoading ? "Building 3D…" : "See as 3D"}
        </button>
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
