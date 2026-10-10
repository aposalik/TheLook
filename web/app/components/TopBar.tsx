"use client";
type Props = {
  cartCount: number;
  onBagClick: () => void;
  savedCount: number;
  onLookbookClick: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
};
export default function TopBar({ cartCount, onBagClick, savedCount, onLookbookClick, soundEnabled, onSoundToggle }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E3DB] bg-[#F7F5F0]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-1.5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/brand/thelook-logo-light.png"
            alt="TheLook"
            className="h-14 w-[94px] shrink-0 object-contain"
          />
          <span className="hidden rounded-full bg-[#EDE5D8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#8A8480] sm:inline-flex">Fitting Room</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onSoundToggle}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
            title={soundEnabled ? "Sound on" : "Sound off"}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition active:scale-95 ${soundEnabled ? "border-[#C4A882] bg-[#1A1A1A] text-white" : "border-[#E8E3DB] bg-white text-[#1A1A1A] hover:border-[#C4A882]"}`}
          >
            <span aria-hidden="true">{soundEnabled ? "🔊" : "🔇"}</span>
            <span className="hidden lg:inline">Sound {soundEnabled ? "on" : "off"}</span>
          </button>
          <button onClick={onLookbookClick} className="relative flex items-center gap-2 rounded-xl border border-[#E8E3DB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] shadow-sm transition hover:border-[#C4A882] active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Looks
            {savedCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-white">{savedCount}</span>}
          </button>
          <button onClick={onBagClick} className="relative flex items-center gap-2 rounded-xl border border-[#E8E3DB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] shadow-sm transition hover:border-[#C4A882] active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Bag
            {cartCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-white">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
