"use client";

type Item = { id: string; title: string; image: string };

const AVATARS = [
  { id: "a1", label: "Alex" },
  { id: "a2", label: "Jordan" },
  { id: "a3", label: "Sam" },
];

type Props = {
  activeItem: Item | null;
  customPhoto: string | null;
  tryOnResult: string | null;
  mockPreview: { photo: string; garment: string; title: string } | null;
  isLoading: boolean;
  error: string | null;
  selectedAvatar: string;
  onAvatarChange: (id: string) => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearPhoto: () => void;
  onTryOn: () => void;
};

export default function AvatarStage({
  activeItem, customPhoto, tryOnResult, mockPreview,
  isLoading, error, selectedAvatar,
  onAvatarChange, onPhotoUpload, onClearPhoto, onTryOn,
}: Props) {
  const hasPhoto = !!customPhoto;

  return (
    <section className="flex flex-col rounded-3xl border border-[#E8E3DB] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E3DB]">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">Avatar & Preview</h2>
          <p className="text-xs text-[#8A8480] mt-0.5">Upload your photo — try-on renders automatically</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-[#F7F5F0] p-1">
          <button
            onClick={onClearPhoto}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${!hasPhoto ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#8A8480] hover:text-[#1A1A1A]"}`}
          >
            Avatars
          </button>
          <label className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${hasPhoto ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#8A8480] hover:text-[#1A1A1A]"}`}>
            Upload Photo
            <input type="file" accept="image/*" onChange={onPhotoUpload} className="hidden" />
          </label>
        </div>
      </div>

      {!hasPhoto && (
        <div className="flex gap-2 px-6 pt-4">
          {AVATARS.map((av) => (
            <button
              key={av.id}
              onClick={() => onAvatarChange(av.id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                selectedAvatar === av.id ? "border-[#1A1A1A] bg-[#1A1A1A] text-white" : "border-[#E8E3DB] bg-white text-[#8A8480] hover:border-[#C4A882]"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${selectedAvatar === av.id ? "bg-[#C4A882]" : "bg-[#E8E3DB]"}`} />
              {av.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative mx-6 my-4 flex flex-1 min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-[#E8E3DB] bg-[#F7F5F0]/60">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-[#EDE5D8]" />
              <div className="absolute inset-0 rounded-full border-4 border-[#C4A882] border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Generating Try-On…</p>
            <p className="text-xs text-[#8A8480]">Rendering apparel via YouCam Cloth-v4</p>
          </div>
        ) : mockPreview ? (
          <div className="flex flex-col items-center w-full p-4 gap-3">
            <div className="flex w-full gap-3 items-stretch">
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8480]">Your Photo</span>
                <div className="flex-1 w-full rounded-xl border border-[#E8E3DB] bg-[#F7F5F0] flex items-center justify-center p-2">
                  <img src={mockPreview.photo} alt="Your photo" className="max-h-[340px] w-full object-contain rounded-lg" />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="w-px flex-1 bg-[#E8E3DB]" />
                <span className="text-[10px] font-bold text-[#C4A882] bg-[#EDE5D8] rounded-full px-2 py-1">+</span>
                <div className="w-px flex-1 bg-[#E8E3DB]" />
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8480]">Selected Garment</span>
                <div className="flex-1 w-full rounded-xl border border-[#E8E3DB] bg-[#F7F5F0] flex items-center justify-center p-4">
                  <img src={mockPreview.garment} alt={mockPreview.title} className="max-h-[340px] w-full object-contain" />
                </div>
              </div>
            </div>
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
            <img src={customPhoto} alt="Your photo" className="max-h-[400px] rounded-xl object-contain shadow-sm" />
            <span className="mt-3 rounded-full bg-[#EDE5D8] px-3 py-1 text-[11px] font-medium text-[#8A8480]">
              Photo ready — pick any garment below to auto-render
            </span>
          </div>
        ) : activeItem ? (
          <div className="flex flex-col items-center p-6">
            <div className="h-72 w-72 rounded-2xl bg-white border border-[#E8E3DB] shadow-sm flex items-center justify-center p-6">
              <img src={activeItem.image} alt={activeItem.title} className="h-full w-full object-contain" />
            </div>
            <p className="mt-4 text-sm font-medium text-[#1A1A1A]">{activeItem.title}</p>
            <p className="text-xs text-[#8A8480] mt-1">Upload your photo or select an avatar to try this on</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center p-8">
            <div className="h-16 w-16 rounded-2xl bg-[#EDE5D8] flex items-center justify-center">
              <svg className="h-8 w-8 text-[#C4A882]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Your fitting room is empty</p>
            <p className="text-xs text-[#8A8480] max-w-[200px]">Pick a garment from the catalog below to get started</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-[#E8E3DB]">
        <p className="text-xs text-[#8A8480]">
          Anchor: <span className="font-medium text-[#1A1A1A]">{activeItem?.title ?? "None selected"}</span>
        </p>
        <button
          onClick={onTryOn}
          disabled={isLoading || (!customPhoto && !activeItem)}
          className="flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#333] active:scale-95 disabled:opacity-40"
        >
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
