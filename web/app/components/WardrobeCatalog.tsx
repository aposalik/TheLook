"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/recommend";

type RowKey = "tops" | "bottoms" | "accessories";
type Row = { key: RowKey; label: string; hint: string; display: "rack" | "shelf"; items: Item[] };

type Props = {
  catalog: Item[];
  userItems: Item[];
  equipped: Item[];
  activeId: string | null;
  onToggle: (item: Item) => void;
  onAdd: (category: RowKey) => void;
  onRemoveUserItem: (id: string) => void;
};

function partition(all: Item[]): Record<RowKey, Item[]> {
  const tops: Item[] = [], bottoms: Item[] = [], accessories: Item[] = [];
  for (const it of all) {
    const cat = it.category ?? it.slot;
    if (cat === "upper" || it.slot === "top" || it.slot === "outerwear") tops.push(it);
    else if (cat === "bottom") bottoms.push(it);
    else accessories.push(it);
  }
  return { tops, bottoms, accessories };
}

export default function WardrobeCatalog({ catalog, userItems, equipped, activeId: _activeId, onToggle, onAdd, onRemoveUserItem }: Props) {
  void _activeId;
  const [manageOpen, setManageOpen] = useState(false);
  const merged = useMemo(() => [...catalog, ...userItems], [catalog, userItems]);
  const rows: Row[] = useMemo(() => {
    const p = partition(merged);
    return [
      { key: "tops", label: "Tops", hint: "shirts · tees · knits · outerwear", display: "rack", items: p.tops },
      { key: "bottoms", label: "Bottoms", hint: "trousers · jeans · skirts", display: "rack", items: p.bottoms },
      { key: "accessories", label: "Shoes & accessories", hint: "shoes · bags · belts", display: "shelf", items: p.accessories },
    ];
  }, [merged]);

  const userIds = useMemo(() => new Set(userItems.map((i) => i.id)), [userItems]);

  return (
    <>
      <section className="rounded-3xl border border-[#E8E3DB] bg-white shadow-sm p-6">
        <header className="flex items-start justify-between gap-4 pb-5 border-b border-[#E8E3DB]">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Your wardrobe</h2>
            <p className="text-xs text-[#8A8480] mt-0.5">Tap a piece to add it to your outfit. Swipe each rail to see more.</p>
          </div>
          <div className="flex items-center gap-2">
            {userItems.length > 0 && (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-[#E8E3DB] px-3.5 py-1.5 text-xs font-semibold text-[#8A8480] hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition"
              >
                ⚙ Manage
              </button>
            )}
            <AddNewMenu onAdd={onAdd} />
          </div>
        </header>

        <div className="mt-6 space-y-8">
          {rows.map((row) => (
            <WardrobeRow
              key={row.key}
              row={row}
              equipped={equipped}
              userIds={userIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      </section>

      {manageOpen && (
        <ManageDrawer
          userItems={userItems}
          onRemove={onRemoveUserItem}
          onClose={() => setManageOpen(false)}
        />
      )}
    </>
  );
}

// ── Manage drawer ──────────────────────────────────────────────────────────────

function ManageDrawer({ userItems, onRemove, onClose }: {
  userItems: Item[];
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Manage your items</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] text-[#8A8480] hover:text-[#1A1A1A] transition"
            aria-label="Close"
          >×</button>
        </div>

        {userItems.length === 0 ? (
          <p className="text-sm text-[#8A8480] text-center py-8">No custom items yet.</p>
        ) : (
          <ul className="overflow-y-auto divide-y divide-[#F0EDE8] -mx-2">
            {userItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-2 py-2.5">
                <div className="h-12 w-12 rounded-xl bg-[#F7F5F0] flex items-center justify-center shrink-0">
                  <img src={item.image} alt={item.title} className="h-full w-full object-contain rounded-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1A1A1A] truncate">{item.title}</p>
                  <p className="text-[11px] text-[#8A8480] uppercase tracking-wide">{item.slot}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 rounded-xl border border-[#E8E3DB] px-3 py-1.5 text-xs font-semibold text-[#8A8480] hover:text-[#C44] hover:border-[#C44] transition"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Add new menu ───────────────────────────────────────────────────────────────

function AddNewMenu({ onAdd }: { onAdd: (c: RowKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full bg-[#1A1A1A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-black transition shadow-sm"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-sm leading-none">+</span>
        Add new
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-[#E8E3DB] bg-white shadow-lg z-20"
        >
          {(["tops", "bottoms", "accessories"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => { setOpen(false); onAdd(key); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#1A1A1A] hover:bg-[#F7F5F0]"
              role="menuitem"
            >
              {{ tops: "Top", bottoms: "Bottom", accessories: "Shoe / accessory" }[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wardrobe row ───────────────────────────────────────────────────────────────

function WardrobeRow({
  row, equipped, userIds, onToggle,
}: {
  row: Row;
  equipped: Item[];
  userIds: Set<string>;
  onToggle: (item: Item) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<{ x: number; t: number } | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateSway(angle: number) {
    scrollerRef.current?.style.setProperty("--sway", `${angle.toFixed(2)}deg`);
  }

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const t = performance.now();
    const x = e.currentTarget.scrollLeft;
    const prev = lastRef.current;
    lastRef.current = { x, t };
    if (!prev) return;
    const dt = Math.max(16, t - prev.t);
    const vx = (x - prev.x) / dt;
    updateSway(Math.max(-11, Math.min(11, -vx * 7)));
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => updateSway(0), 180);
  }

  useEffect(() => () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); }, []);

  const nudge = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * Math.max(240, (scrollerRef.current.clientWidth ?? 0) * 0.6), behavior: "smooth" });
  };

  const isRack = row.display === "rack";

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-1.5">
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A1A]">{row.label}</h3>
          <p className="text-[11px] text-[#8A8480]">{row.hint} · {row.items.length} items</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => nudge(-1)} aria-label={`Scroll ${row.label} left`}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] bg-white text-[#8A8480] hover:text-[#1A1A1A] hover:border-[#C4A882] transition flex items-center justify-center">‹</button>
          <button type="button" onClick={() => nudge(1)} aria-label={`Scroll ${row.label} right`}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] bg-white text-[#8A8480] hover:text-[#1A1A1A] hover:border-[#C4A882] transition flex items-center justify-center">›</button>
        </div>
      </div>

      <div className="relative">
        {isRack ? (
          <div aria-hidden className="absolute left-0 right-0 top-[22px] h-[3px] rounded-full bg-gradient-to-r from-[#B9A98A] via-[#8E7D5F] to-[#B9A98A] shadow-[0_1px_1px_rgba(0,0,0,0.08)]" />
        ) : (
          <div aria-hidden className="absolute left-0 right-0 bottom-0 h-[14px] rounded-[3px] bg-gradient-to-b from-[#D7B98A] via-[#A98253] to-[#6E4A24] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_6px_rgba(0,0,0,0.08)]">
            <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[3px] bg-gradient-to-b from-[#F0DBB7] to-transparent opacity-70" />
          </div>
        )}

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className={`flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 ${isRack ? "pt-7" : "pt-6"} px-2`}
          style={{ scrollbarWidth: "thin", ["--sway" as never]: "0deg" }}
        >
          {row.items.map((item, idx) =>
            isRack ? (
              <HangingItem
                key={item.id}
                item={item}
                index={idx}
                equipped={equipped.some((i) => i.id === item.id)}
                isUserOwned={userIds.has(item.id)}
                onToggle={() => onToggle(item)}
              />
            ) : (
              <ShelfItem
                key={item.id}
                item={item}
                equipped={equipped.some((i) => i.id === item.id)}
                isUserOwned={userIds.has(item.id)}
                onToggle={() => onToggle(item)}
              />
            )
          )}
          {row.items.length === 0 && (
            <div className="flex items-center justify-center text-xs text-[#B5ADA3] italic snap-start min-w-[200px] py-12">
              Nothing here yet. Use <span className="mx-1 font-semibold">+ Add new</span> above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hanger SVG ─────────────────────────────────────────────────────────────────

function HangerSVG({ className = "" }: { className?: string }) {
  return (
    <img src="/wardrobe/aski.png" alt="" aria-hidden className={className} draggable={false} />
  );
}

// ── Hanging item with pendulum physics on hover ────────────────────────────────

function HangingItem({ item, index, equipped, isUserOwned, onToggle }: {
  item: Item;
  index: number;
  equipped: boolean;
  isUserOwned: boolean;
  onToggle: () => void;
}) {
  const phase = ((index % 5) - 2) * 0.08;
  const angleRef = useRef(0);       // current angle (deg)
  const velRef = useRef(0);         // angular velocity (deg/frame)
  const rafRef = useRef<number | null>(null);
  const pivotRef = useRef<HTMLDivElement | null>(null);
  const hovering = useRef(false);

  // Pendulum spring constants
  const GRAVITY = 0.045;   // restoring force (like g/L)
  const DAMPING = 0.88;    // per-frame velocity multiplier (< 1 = damped)
  const KICK = 6;          // initial kick angle on hover-enter (deg)

  function tick() {
    // Spring: acceleration = -GRAVITY * angle
    velRef.current += -GRAVITY * angleRef.current;
    velRef.current *= DAMPING;
    angleRef.current += velRef.current;

    if (pivotRef.current) {
      const rowEl = pivotRef.current.closest<HTMLElement>("[style*='--sway']");
      const scrollSway = parseFloat(rowEl?.style.getPropertyValue("--sway") ?? "0") || 0;
      const total = angleRef.current * (1 + phase) + scrollSway * (1 + phase);
      pivotRef.current.style.transform = `rotate(${total.toFixed(3)}deg)`;
    }

    // Keep animating while swinging or hovering
    if (Math.abs(angleRef.current) > 0.05 || Math.abs(velRef.current) > 0.05 || hovering.current) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      angleRef.current = 0; velRef.current = 0;
      if (pivotRef.current) pivotRef.current.style.transform = `rotate(0deg)`;
      rafRef.current = null;
    }
  }

  function startSwing(kickAngle: number) {
    velRef.current += kickAngle;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }

  function onMouseEnter() {
    hovering.current = true;
    startSwing(KICK);
  }

  function onMouseLeave() {
    hovering.current = false;
    // Let it swing back naturally — tick() will stop when settled
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div className="snap-start shrink-0 w-[128px] relative group">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={equipped}
        aria-label={`${equipped ? "Remove" : "Add"} ${item.title}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="relative flex w-full flex-col items-center bg-transparent border-0 p-0 cursor-pointer focus-visible:outline-none"
      >
        <div
          ref={pivotRef}
          className="sway-pivot relative flex flex-col items-center"
          style={{ transformOrigin: "50% 0%", willChange: "transform" }}
        >
          <HangerSVG className="w-[110px] h-[48px] -mb-5 drop-shadow-[0_2px_1px_rgba(0,0,0,0.12)]" />
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className={`w-[112px] h-[128px] object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.14)] ${equipped ? "scale-[1.04]" : ""}`}
          />
        </div>
        <div className="mt-2 w-full text-center">
          <p className={`truncate text-[12px] font-semibold ${equipped ? "text-[#1A1A1A]" : "text-[#2A2622]"}`}>{item.title}</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-[#8A8480]">{item.slot}{item.palette ? ` · ${item.palette}` : ""}</p>
          {equipped && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1A1A1A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A1A1A]" /> in look
            </span>
          )}
        </div>
      </button>
      {isUserOwned && (
        <span className="absolute top-10 right-1 rounded bg-[#C4A882]/95 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white shadow-sm">Yours</span>
      )}
    </div>
  );
}

// ── Shelf item ─────────────────────────────────────────────────────────────────

function ShelfItem({ item, equipped, isUserOwned, onToggle }: {
  item: Item;
  equipped: boolean;
  isUserOwned: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="snap-start shrink-0 w-[128px] relative group">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={equipped}
        aria-label={`${equipped ? "Remove" : "Add"} ${item.title}`}
        className="relative flex w-full flex-col items-center bg-transparent border-0 p-0 cursor-pointer focus-visible:outline-none"
      >
        <div className="relative flex items-end justify-center h-[108px]">
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className={`max-h-[104px] max-w-[118px] object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,0.18)] transition-transform duration-300 group-hover:-translate-y-1 ${equipped ? "scale-[1.05]" : ""}`}
          />
        </div>
        <div className="mt-2 w-full text-center">
          <p className={`truncate text-[12px] font-semibold ${equipped ? "text-[#1A1A1A]" : "text-[#2A2622]"}`}>{item.title}</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-[#8A8480]">{item.slot}{item.palette ? ` · ${item.palette}` : ""}</p>
          {equipped && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1A1A1A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A1A1A]" /> in look
            </span>
          )}
        </div>
      </button>
      {isUserOwned && (
        <span className="absolute top-1 right-1 rounded bg-[#C4A882]/95 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white shadow-sm">Yours</span>
      )}
    </div>
  );
}
