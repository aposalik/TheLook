"use client";
import type { Item } from "@/lib/recommend";

export type DetailLook = { image: string; items: Item[]; label?: string };

// Lookbook detail (inspired by the "LOOK.N" cards): the hero render + every
// piece it's wearing, labeled by slot.
export default function LookDetail({ look, onClose }: { look: DetailLook; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F5F0] text-lg text-[#8A8480] hover:text-[#1A1A1A]">×</button>
        <h3 className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#8A8480]">{look.label ?? "The Look"}</h3>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,300px)_1fr]">
          <div className="mx-auto w-full overflow-hidden rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0]" style={{ aspectRatio: "9 / 16" }}>
            <img src={look.image} alt="look" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-[#1A1A1A]">Wearing ({look.items.length})</p>
            <ul className="space-y-2.5">
              {look.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 rounded-xl border border-[#E8E3DB] p-2">
                  <img src={it.image} alt={it.title} className="h-14 w-14 rounded-lg bg-[#F7F5F0] object-contain p-1" />
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#8A8480]">{it.slot}</div>
                    <div className="text-sm text-[#1A1A1A]">{it.title}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
