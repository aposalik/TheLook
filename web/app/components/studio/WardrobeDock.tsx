"use client";
/* eslint-disable @next/next/no-img-element -- wardrobe thumbnails include runtime-signed private URLs */

import { useMemo, useState } from "react";
import type { Item } from "@/lib/recommend";
import { ARTBOARD_MIME } from "./StudioArtboard";

const FILTERS = ["All", "Tops", "Outerwear", "Bottoms", "Dresses", "Shoes", "Accessories"] as const;
type Filter = (typeof FILTERS)[number];

function belongsTo(item: Item, filter: Filter): boolean {
  if (filter === "All") return true;
  if (filter === "Bottoms") return item.category === "bottom" || item.slot === "bottom";
  if (filter === "Dresses") return item.category === "dress" || item.slot === "dress";
  if (filter === "Shoes") return item.category === "shoe" || item.slot === "shoe";
  if (filter === "Accessories") return item.category === "accessory" || item.slot === "accessory";
  if (filter === "Outerwear") return item.layer === "outer" || item.slot === "outerwear";
  return item.category === "upper" && item.layer !== "outer" && item.slot !== "outerwear";
}

export default function WardrobeDock({
  items,
  loading,
  onAdd,
}: {
  items: Item[];
  loading: boolean;
  onAdd: (item: Item) => void;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => belongsTo(item, filter) && (!normalized || item.title.toLowerCase().includes(normalized)));
  }, [filter, items, query]);

  return (
    <section className="border-t border-[#ded8cd] bg-[#f8f6f1] px-3 py-3 sm:px-5" aria-label="Wardrobe picker">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
            <span className="mr-1 shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7e7569]">Wardrobe</span>
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${filter === option ? "bg-[#25221e] text-white" : "border border-[#dfd9cf] bg-white text-[#686158] hover:border-[#af9b7c]"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <label className="relative block shrink-0 sm:w-56">
            <span className="sr-only">Search wardrobe</span>
            <svg aria-hidden="true" className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#948b80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pieces"
              className="h-9 w-full rounded-xl border border-[#dfd9cf] bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-[#aaa198] focus:border-[#9a8260] focus:ring-2 focus:ring-[#c9b99f]/30"
            />
          </label>
        </div>

        <div className="flex min-h-[112px] gap-2.5 overflow-x-auto pb-1">
          {loading && Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-[108px] w-[92px] shrink-0 animate-pulse rounded-2xl border border-[#e4dfd6] bg-white" />
          ))}
          {!loading && visible.map((item) => (
            <button
              key={`${item.source ?? "catalog"}-${item.id}`}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(ARTBOARD_MIME, item.id);
              }}
              onClick={() => onAdd(item)}
              title={`Add ${item.title}`}
              className="group relative h-[108px] w-[92px] shrink-0 overflow-hidden rounded-2xl border border-[#e1dbd1] bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#ad9673] hover:shadow-md active:translate-y-0"
            >
              <span className={`absolute right-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider ${item.source === "user" ? "bg-[#dceadf] text-[#2f6845]" : "bg-[#eee8de] text-[#786b59]"}`}>
                {item.source === "user" ? "Yours" : "Demo"}
              </span>
              <img src={item.image} alt="" crossOrigin="anonymous" draggable={false} className="h-[72px] w-full object-contain transition group-hover:scale-105" />
              <span className="block truncate text-[9px] font-semibold text-[#4a443d]">{item.title}</span>
            </button>
          ))}
          {!loading && !visible.length && (
            <div className="grid min-h-[108px] min-w-full place-items-center rounded-2xl border border-dashed border-[#d7d0c5] bg-white/60 text-xs text-[#8c8378]">
              No matching wardrobe pieces.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
