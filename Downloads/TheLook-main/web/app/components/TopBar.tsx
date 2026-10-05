"use client";

type Props = { cartCount: number; onBagClick: () => void };

export default function TopBar({ cartCount, onBagClick }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E3DB] bg-[#F7F5F0]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-8 py-4">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#1A1A1A"/>
            <path d="M20 8 C20 8 20 6 22 6 C24 6 24 8 24 9.5" stroke="#C4A882" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
            <path d="M24 9.5 C26 11 30 15 31 17 C31.5 18 31 19 30 19 L10 19 C9 19 8.5 18 9 17 C10 15 14 11 16 9.5 C17.5 8.5 18.5 8 20 8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <line x1="10" y1="19" x2="30" y2="19" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
            <path d="M29 11 L29.5 12.5 L31 13 L29.5 13.5 L29 15 L28.5 13.5 L27 13 L28.5 12.5 Z" fill="#C4A882"/>
          </svg>
          <span className="text-lg font-semibold tracking-tight text-[#1A1A1A]">TheLook</span>
          <span className="rounded-full bg-[#EDE5D8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#8A8480]">
            Fitting Room
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#E8E3DB] bg-white px-3 py-1.5 text-xs text-[#8A8480]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C4A882]" />
            Mock Mode
          </span>
          <button
            onClick={onBagClick}
            className="relative flex items-center gap-2 rounded-xl border border-[#E8E3DB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] shadow-sm transition hover:border-[#C4A882] hover:shadow-md active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Bag
            {cartCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
