"use client";

type Props = { cartCount: number; onBagClick: () => void };

export default function TopBar({ cartCount, onBagClick }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E3DB] bg-[#F7F5F0]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-8 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1A1A]">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight text-[#1A1A1A]">TheLook</span>
          <span className="rounded-full bg-[#EDE5D8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#8A8480]">
            Fitting Room
          </span>
        </div>

        {/* Right actions */}
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
            <span>Bag</span>
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
