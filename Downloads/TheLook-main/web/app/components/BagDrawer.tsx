"use client";
type Item = { id: string; slot: string; title: string; palette: string; image: string };
type Props = { open: boolean; items: Item[]; onClose: () => void; onRemove: (id: string) => void; onClear: () => void; };
export default function BagDrawer({ open, items, onClose, onRemove, onClear }: Props) {
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
      <aside className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-[#E8E3DB] px-6 py-5">
          <div><h2 className="text-lg font-semibold text-[#1A1A1A]">Shopping Bag</h2><p className="text-xs text-[#8A8480] mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""}</p></div>
          <button onClick={onClose} className="rounded-xl border border-[#E8E3DB] p-2 text-[#8A8480] hover:bg-[#F7F5F0] transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-[#EDE5D8] flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-[#C4A882]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Your bag is empty</p>
              <button onClick={onClose} className="mt-6 rounded-xl border border-[#E8E3DB] px-5 py-2.5 text-sm font-medium text-[#1A1A1A] hover:bg-[#F7F5F0] transition">Back to Fitting Room</button>
            </div>
          ) : items.map((item, i) => (
            <div key={`${item.id}-${i}`} className="flex items-center gap-4 rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0]/50 p-4">
              <div className="h-16 w-16 shrink-0 rounded-xl border border-[#E8E3DB] bg-white p-2"><img src={item.image} alt={item.title} className="h-full w-full object-contain" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[#1A1A1A] truncate">{item.title}</p><p className="text-xs text-[#8A8480] mt-0.5 capitalize">{item.slot} · {item.palette}</p></div>
              <button onClick={() => onRemove(item.id)} className="shrink-0 rounded-lg p-1.5 text-[#8A8480] hover:bg-[#E8E3DB] transition">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="border-t border-[#E8E3DB] px-6 py-5 space-y-3">
            <button className="w-full rounded-2xl bg-[#1A1A1A] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#333] active:scale-[0.98]">Proceed to Checkout</button>
            <button onClick={onClear} className="w-full rounded-2xl border border-[#E8E3DB] py-2.5 text-sm font-medium text-[#8A8480] hover:bg-[#F7F5F0] transition">Clear Bag</button>
          </div>
        )}
      </aside>
    </>
  );
}
