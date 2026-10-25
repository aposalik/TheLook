"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/recommend";

type RowKey = "tops" | "bottoms" | "accessories";
type Row = { key: RowKey; label: string; hint: string; display: "rack" | "shelf"; items: Item[] };

const DEMO_HIDDEN_KEY = "thelook_demo_hidden";

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
  const [demoHidden, setDemoHidden] = useState(false);

  useEffect(() => {
    // localStorage is an external store; hydrate once after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDemoHidden(localStorage.getItem(DEMO_HIDDEN_KEY) === "1");
  }, []);

  function toggleDemo() {
    const next = !demoHidden;
    setDemoHidden(next);
    localStorage.setItem(DEMO_HIDDEN_KEY, next ? "1" : "0");
  }

  const visibleCatalog = demoHidden ? [] : catalog;
  const merged = useMemo(() => [...visibleCatalog, ...userItems], [visibleCatalog, userItems]);
  const rows: Row[] = useMemo(() => {
    const p = partition(merged);
    return [
      { key: "tops", label: "Tops", hint: "shirts · tees · knits · outerwear", display: "rack", items: p.tops },
      { key: "bottoms", label: "Bottoms", hint: "trousers · jeans · skirts", display: "rack", items: p.bottoms },
      { key: "accessories", label: "Shoes & accessories", hint: "shoes · bags · belts", display: "shelf", items: p.accessories },
    ];
  }, [merged]);

  const userIds = useMemo(() => new Set(userItems.map((i) => i.id)), [userItems]);
  const catalogIds = useMemo(() => new Set(catalog.map((i) => i.id)), [catalog]);

  return (
    <>
      <section className="rounded-3xl border border-[#E8E3DB] bg-white shadow-sm p-6">
        <header className="flex items-start justify-between gap-4 pb-5 border-b border-[#E8E3DB]">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Your wardrobe</h2>
            <p className="text-xs text-[#8A8480] mt-0.5">Tap a piece to add it to your outfit. Swipe each rail to see more.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[#E8E3DB] px-3.5 py-1.5 text-xs font-semibold text-[#8A8480] hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition"
            >
              ⚙ Manage
            </button>
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
              catalogIds={catalogIds}
              demoHidden={demoHidden}
              onToggle={onToggle}
            />
          ))}
        </div>
      </section>

      {manageOpen && (
        <ManageDrawer
          userItems={userItems}
          demoHidden={demoHidden}
          demoCount={catalog.length}
          onToggleDemo={toggleDemo}
          onRemove={onRemoveUserItem}
          onAdd={onAdd}
          onClose={() => setManageOpen(false)}
        />
      )}
    </>
  );
}

// ── Manage drawer ──────────────────────────────────────────────────────────────

function ManageDrawer({
  userItems,
  demoHidden,
  demoCount,
  onToggleDemo,
  onRemove,
  onAdd,
  onClose,
}: {
  userItems: Item[];
  demoHidden: boolean;
  demoCount: number;
  onToggleDemo: () => void;
  onRemove: (id: string) => void;
  onAdd: (c: RowKey) => void;
  onClose: () => void;
}) {
  const [selectedCat, setSelectedCat] = useState<"all" | "tops" | "bottoms" | "accessories">("all");
  const [selectedGender, setSelectedGender] = useState<"all" | "men" | "women">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filteredItems = useMemo(() => {
    return userItems.filter((item) => {
      // Category filter
      if (selectedCat === "tops") {
        const cat = item.category ?? item.slot;
        if (!(cat === "upper" || item.slot === "top" || item.slot === "outerwear")) return false;
      } else if (selectedCat === "bottoms") {
        const cat = item.category ?? item.slot;
        if (cat !== "bottom") return false;
      } else if (selectedCat === "accessories") {
        const cat = item.category ?? item.slot;
        if (cat === "upper" || item.slot === "top" || item.slot === "outerwear" || cat === "bottom") return false;
      }

      // Gender filter (strictly men or women)
      if (selectedGender !== "all" && item.gender && item.gender !== selectedGender) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSlot = item.slot.toLowerCase().includes(q);
        const matchesCategory = item.category?.toLowerCase().includes(q) ?? false;
        const matchesMaterial = item.material?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesSlot && !matchesCategory && !matchesMaterial) return false;
      }

      return true;
    });
  }, [userItems, selectedCat, selectedGender, searchQuery]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E3DB]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#1A1A1A]">Manage Wardrobe</h2>
              <span className="rounded-full bg-[#F7F5F0] border border-[#E8E3DB] px-2.5 py-0.5 text-xs font-medium text-[#8A8480]">
                {userItems.length} custom {userItems.length === 1 ? "item" : "items"}
              </span>
            </div>
            <p className="text-xs text-[#8A8480] mt-0.5">Organize your uploaded clothing pieces and catalog settings</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-[#E8E3DB] text-[#8A8480] hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition flex items-center justify-center text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Demo clothes switch card */}
        <div className="my-4 flex items-center justify-between rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0]/60 p-3.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white border border-[#E8E3DB] flex items-center justify-center text-base">
              ✨
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1A1A1A]">
                {demoHidden ? "Demo Collection Hidden" : "Demo Collection Active"}
              </p>
              <p className="text-[11px] text-[#8A8480]">
                {demoCount} curated studio pieces · {demoHidden ? "turn on to see demo outfits" : "turn off to view only personal uploads"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleDemo}
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus-visible:outline-none ${
              demoHidden ? "bg-[#E8E3DB]" : "bg-[#1A1A1A]"
            }`}
            aria-pressed={!demoHidden}
            aria-label={demoHidden ? "Show demo clothes" : "Hide demo clothes"}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                demoHidden ? "translate-x-0.5" : "translate-x-[22px]"
              }`}
            />
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="space-y-3 pb-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your clothes by title or style…"
              className="w-full rounded-xl border border-[#E8E3DB] bg-[#F7F5F0] px-3.5 py-2 text-xs text-[#1A1A1A] placeholder-[#8A8480] focus:border-[#1A1A1A] focus:bg-white focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8A8480] hover:text-[#1A1A1A]"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(
                [
                  { id: "all", label: "All Items" },
                  { id: "tops", label: "Tops" },
                  { id: "bottoms", label: "Bottoms" },
                  { id: "accessories", label: "Shoes & Accs" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCat(tab.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    selectedCat === tab.id
                      ? "bg-[#1A1A1A] text-white"
                      : "bg-[#F7F5F0] text-[#8A8480] hover:text-[#1A1A1A]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Gender filter pills (strictly Men and Women) */}
            <div className="flex items-center gap-1 bg-[#F7F5F0] rounded-full p-0.5 border border-[#E8E3DB]">
              {(
                [
                  { id: "all", label: "All Genders" },
                  { id: "men", label: "Men" },
                  { id: "women", label: "Women" },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGender(g.id)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    selectedGender === g.id
                      ? "bg-white text-[#1A1A1A] shadow-xs"
                      : "text-[#8A8480] hover:text-[#1A1A1A]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content list / grid */}
        <div className="flex-1 overflow-y-auto py-2">
          {userItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="h-14 w-14 rounded-2xl bg-[#F7F5F0] border border-[#E8E3DB] flex items-center justify-center text-2xl">
                🧥
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">Your wardrobe is empty</p>
                <p className="text-xs text-[#8A8480] max-w-xs mt-1">
                  Upload photos of your real clothes to start trying them on and receiving personalized AI outfit recommendations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAdd("tops");
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#1A1A1A] px-4 py-2 text-xs font-semibold text-white hover:bg-black transition"
              >
                + Add First Item
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <p className="text-sm font-medium text-[#1A1A1A]">No matching pieces found</p>
              <p className="text-xs text-[#8A8480]">Try clearing your search query or switching filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCat("all");
                  setSelectedGender("all");
                  setSearchQuery("");
                }}
                className="mt-2 text-xs font-semibold text-[#C4A882] hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[#E8E3DB] bg-white p-3 hover:border-[#1A1A1A] hover:shadow-xs transition"
                >
                  <div>
                    {/* Item Image */}
                    <div className="relative aspect-square w-full rounded-xl bg-[#F7F5F0] overflow-hidden flex items-center justify-center p-2 mb-2.5">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-2xl text-[#8A8480]">👕</span>
                      )}
                      {/* Gender badge */}
                      {item.gender && (
                        <span
                          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                            item.gender === "men"
                              ? "bg-[#1A1A1A] text-white"
                              : "bg-[#C4A882] text-white"
                          }`}
                        >
                          {item.gender}
                        </span>
                      )}
                      {/* Category tag */}
                      <span className="absolute top-2 right-2 rounded-full bg-white/90 border border-[#E8E3DB] px-1.5 py-0.5 text-[9px] font-medium text-[#8A8480] uppercase">
                        {item.slot}
                      </span>
                    </div>

                    {/* Metadata */}
                    <h3 className="text-xs font-semibold text-[#1A1A1A] truncate" title={item.title}>
                      {item.title}
                    </h3>
                    <p className="text-[10px] text-[#8A8480] capitalize truncate mt-0.5">
                      {item.palette} · {item.fit ?? "regular fit"}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-xl border border-[#E8E3DB] py-1.5 text-[11px] font-medium text-[#8A8480] hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50/50 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Remove piece
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#E8E3DB] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onAdd("tops");
            }}
            className="flex items-center gap-1.5 rounded-full border border-[#E8E3DB] px-3.5 py-1.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F7F5F0] transition"
          >
            + Add New Piece
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#1A1A1A] px-5 py-1.5 text-xs font-semibold text-white hover:bg-black transition shadow-xs"
          >
            Done
          </button>
        </div>
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
  row, equipped, userIds, catalogIds, demoHidden, onToggle,
}: {
  row: Row;
  equipped: Item[];
  userIds: Set<string>;
  catalogIds: Set<string>;
  demoHidden: boolean;
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
                isDemo={catalogIds.has(item.id) && !demoHidden}
                onToggle={() => onToggle(item)}
              />
            ) : (
              <ShelfItem
                key={item.id}
                item={item}
                equipped={equipped.some((i) => i.id === item.id)}
                isUserOwned={userIds.has(item.id)}
                isDemo={catalogIds.has(item.id) && !demoHidden}
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

function HangingItem({ item, index, equipped, isUserOwned, isDemo, onToggle }: {
  item: Item;
  index: number;
  equipped: boolean;
  isUserOwned: boolean;
  isDemo: boolean;
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
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              className={`w-[112px] h-[128px] object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.14)] ${equipped ? "scale-[1.04]" : ""}`}
            />
          ) : (
            <div className="w-[112px] h-[128px] flex items-center justify-center text-3xl">👕</div>
          )}
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
      {isDemo && !isUserOwned && (
        <span className="absolute top-10 right-1 rounded bg-[#E8E3DB] px-1.5 py-0.5 text-[8px] font-semibold uppercase text-[#8A8480]">Demo</span>
      )}
    </div>
  );
}

// ── Shelf item ─────────────────────────────────────────────────────────────────

function ShelfItem({ item, equipped, isUserOwned, isDemo, onToggle }: {
  item: Item;
  equipped: boolean;
  isUserOwned: boolean;
  isDemo: boolean;
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
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              className={`max-h-[104px] max-w-[118px] object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,0.18)] transition-transform duration-300 group-hover:-translate-y-1 ${equipped ? "scale-[1.05]" : ""}`}
            />
          ) : (
            <div className="h-[104px] w-[118px] flex items-center justify-center text-2xl">👞</div>
          )}
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
      {isDemo && !isUserOwned && (
        <span className="absolute top-1 right-1 rounded bg-[#E8E3DB] px-1.5 py-0.5 text-[8px] font-semibold uppercase text-[#8A8480]">Demo</span>
      )}
    </div>
  );
}
