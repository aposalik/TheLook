"use client";
import type { Item } from "@/lib/recommend";

export type SavedLook = {
  id: string;
  image: string;
  renderPath?: string | null;
  items: Item[];
  createdAt: number;
  formula?: string;
  stylistTitle?: string | null;
  cohesion?: number | null;
};

// Slide-over of saved outfits — review looks on other days; tap one for detail.
export default function Lookbook({
  open, looks, onClose, onOpen, onRemove,
}: {
  open: boolean; looks: SavedLook[]; onClose: () => void;
  onOpen: (l: SavedLook) => void; onRemove: (id: string) => void;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <aside className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-[#E8E3DB] px-6 py-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Your Lookbook <span className="text-[#8A8480]">({looks.length})</span></h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F5F0] text-lg text-[#8A8480] hover:text-[#1A1A1A]">×</button>
        </div>
        {looks.length === 0 ? (
          <p className="p-6 text-sm text-[#8A8480]">No saved looks yet. Render an outfit, then tap <b>Save look</b> to keep it here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 overflow-y-auto p-4">
            {looks.map((l) => (
              <div key={l.id} className="relative">
                <button onClick={() => onOpen(l)} className="block w-full overflow-hidden rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0]" style={{ aspectRatio: "9 / 16" }}>
                  {l.image ? (
                    <img src={l.image} alt="saved look" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-between p-3.5 text-[#8A8480] bg-[#F7F5F0]">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">✨</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C4A882]">Saved Look</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 w-full my-auto">
                        {l.items.slice(0, 4).map((it) => (
                          <div key={it.id} className="aspect-square rounded-lg bg-white border border-[#E8E3DB] p-1 flex items-center justify-center overflow-hidden">
                            {it.image ? (
                              <img src={it.image} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-xs">👕</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] font-medium text-[#1A1A1A] truncate w-full text-center">
                        {l.items.length} pieces
                      </p>
                    </div>
                  )}
                </button>
                <button onClick={() => onRemove(l.id)} aria-label="Remove" className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white">×</button>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
