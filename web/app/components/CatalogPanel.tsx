"use client";
import { useState } from "react";
import type { Item } from "@/lib/recommend";
const CATS = [{ id: "all", label: "All" }, { id: "tops", label: "Tops" }, { id: "bottoms", label: "Bottoms" }, { id: "outerwear", label: "Outerwear" }];
type Props = { catalog: Item[]; equipped: Item[]; activeId: string | null; onToggle: (item: Item) => void; };
export default function CatalogPanel({ catalog, equipped, activeId, onToggle }: Props) {
  const [cat, setCat] = useState("all");
  const filtered = catalog.filter((item) => {
    if (cat === "all") return true;
    if (cat === "tops") return item.category === "upper";
    if (cat === "bottoms") return item.category === "bottom";
    if (cat === "outerwear") return item.layer === "outer";
    return true;
  });
  return (
    <section className="rounded-3xl border border-[#E8E3DB] bg-white shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E8E3DB]">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">Catalog</h2>
          <p className="text-xs text-[#8A8480] mt-0.5">Click any piece to add it to your outfit</p>
        </div>
        <div className="flex gap-2">
          {CATS.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${cat === c.id ? "bg-[#1A1A1A] text-white shadow-sm" : "bg-[#F7F5F0] text-[#8A8480] hover:bg-[#EDE5D8] hover:text-[#1A1A1A]"}`}>{c.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filtered.map((item) => {
          const isEquipped = equipped.some((i) => i.id === item.id);
          return (
            <button key={item.id} onClick={() => onToggle(item)} className={`group relative flex flex-col rounded-2xl border p-3 text-left transition-all duration-200 ${isEquipped ? "border-[#1A1A1A] bg-[#F7F5F0] shadow-md ring-1 ring-[#1A1A1A]/10" : "border-[#E8E3DB] bg-white hover:border-[#C4A882]/60 hover:shadow-sm"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="rounded-md bg-[#F7F5F0] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#8A8480]">{item.slot}</span>
                {isEquipped && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1A1A1A] text-[9px] text-white">✓</span>}
              </div>
              <div className="flex h-28 items-center justify-center p-1">
                <img src={item.image} alt={item.title} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div className="mt-2">
                <p className="truncate text-xs font-semibold text-[#1A1A1A]">{item.title}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] capitalize text-[#8A8480]">{item.palette}</span>
                  <span className="rounded bg-[#F7F5F0] px-1 py-0.5 text-[9px] font-medium text-[#8A8480]">F{item.formality ?? 1}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
