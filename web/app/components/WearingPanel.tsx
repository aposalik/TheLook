"use client";

import type { Item, StylePreferences } from "@/lib/recommend";
type Look = { formula: string; cohesion: number; reason: string; aiReason?: string; stylistTitle?: string }; 

type Props = {
  equipped: Item[];
  currentLook: Look | null;
  isGenerating: boolean;
  generateError: string | null;
  onGenerate: () => void;
  onRemove: (item: Item) => void;
  onAddToBag: () => void;
  preferences: StylePreferences;
  onPreferencesChange: (preferences: StylePreferences) => void;
  stylistSource: "gemini" | "deterministic" | null;
};

export default function WearingPanel({ equipped, currentLook, isGenerating, generateError, onGenerate, onRemove, onAddToBag, preferences, onPreferencesChange, stylistSource }: Props) {
  return (
    <section className="flex flex-col rounded-3xl border border-[#E8E3DB] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E3DB]">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">You Are Wearing</h2>
          <p className="text-xs text-[#8A8480] mt-0.5">{equipped.length} piece{equipped.length !== 1 ? "s" : ""} selected</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 rounded-xl border border-[#E8E3DB] bg-[#F7F5F0] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:border-[#C4A882] hover:bg-[#EDE5D8] active:scale-95 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-[#C4A882] border-t-transparent animate-spin" />
              Styling…
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5 text-[#C4A882]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.57l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.57l7-10a1 1 0 011.12-.384z" clipRule="evenodd" />
              </svg>
              Generate Outfit
            </>
          )}
        </button>
      </div>

      {/* Generate error */}
      {generateError && (
        <div className="mx-6 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
          {generateError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 px-6 pt-4">
        <label className="text-[10px] font-bold uppercase tracking-wide text-[#8A8480]">
          Occasion
          <select
            value={preferences.occasion ?? "any"}
            onChange={(e) => onPreferencesChange({ ...preferences, occasion: e.target.value as StylePreferences["occasion"] })}
            className="mt-1 w-full rounded-xl border border-[#E8E3DB] bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-[#1A1A1A] outline-none focus:border-[#C4A882]"
          >
            <option value="any">Any occasion</option>
            <option value="casual">Casual</option>
            <option value="work">Work</option>
            <option value="evening">Evening</option>
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-[#8A8480]">
          Styling goal
          <select
            value={preferences.goal ?? "balanced"}
            onChange={(e) => onPreferencesChange({ ...preferences, goal: e.target.value as StylePreferences["goal"] })}
            className="mt-1 w-full rounded-xl border border-[#E8E3DB] bg-white px-2.5 py-2 text-xs font-medium normal-case tracking-normal text-[#1A1A1A] outline-none focus:border-[#C4A882]"
          >
            <option value="balanced">Balanced</option>
            <option value="define-waist">Define waist</option>
            <option value="vertical-line">Longer vertical line</option>
            <option value="shoulder-structure">Shoulder structure</option>
          </select>
        </label>
      </div>

      {/* Equipped items */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 min-h-[200px] max-h-[320px]">
        {equipped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[160px] rounded-2xl border border-dashed border-[#E8E3DB] text-center p-6">
            <div className="h-10 w-10 rounded-xl bg-[#EDE5D8] flex items-center justify-center mb-3">
              <svg className="h-5 w-5 text-[#C4A882]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-xs font-medium text-[#1A1A1A]">No pieces yet</p>
            <p className="text-[11px] text-[#8A8480] mt-1">Click any item in the catalog or hit Generate</p>
          </div>
        ) : (
          equipped.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0]/60 p-3 transition hover:border-[#C4A882]/40">
              <div className="h-14 w-14 shrink-0 rounded-xl border border-[#E8E3DB] bg-white p-1.5">
                <img src={item.image} alt={item.title} className="h-full w-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1A1A1A] truncate">{item.title}</span>
                  <span className="shrink-0 rounded bg-[#EDE5D8] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#8A8480]">{item.slot}</span>
                </div>
                <p className="text-[11px] text-[#8A8480] mt-0.5 capitalize">{item.palette} · {item.fit ?? "regular"} fit</p>
              </div>
              <button onClick={() => onRemove(item)} className="shrink-0 rounded-lg p-1.5 text-[#8A8480] hover:bg-[#E8E3DB] hover:text-[#1A1A1A] transition">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Stylist rationale */}
      {currentLook && (
        <div className="mx-6 mb-4 rounded-2xl border border-[#EDE5D8] bg-[#F7F5F0] p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[#EDE5D8] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8A8480]">{currentLook.formula}</span>
              {stylistSource && (
                <span className="rounded-full border border-[#D9C6A8] bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9B7A4A]">
                  {stylistSource === "gemini" ? "Gemini stylist" : "Outfit engine"}
                </span>
              )}
            </div>
            <span className="shrink-0 text-xs font-semibold text-[#C4A882]">{(currentLook.cohesion * 100).toFixed(0)}% cohesion</span>
          </div>
          {currentLook.stylistTitle && <p className="mb-1 text-sm font-semibold text-[#1A1A1A]">{currentLook.stylistTitle}</p>}
          <p className="text-xs leading-relaxed text-[#1A1A1A]/80">{currentLook.reason}</p>
        </div>
      )}

      <div className="px-6 pb-6 mt-auto">
        <button
          onClick={onAddToBag}
          disabled={equipped.length === 0}
          className="w-full rounded-2xl bg-[#1A1A1A] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#333] active:scale-[0.98] disabled:opacity-30"
        >
          {equipped.length === 0 ? "Add Outfit to Bag" : `Add ${equipped.length} Item${equipped.length !== 1 ? "s" : ""} to Bag`}
        </button>
      </div>
    </section>
  );
}
