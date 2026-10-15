"use client";

import type { Item, Look, StylePreferences } from "@/lib/recommend";

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
  recommendedLooks: Look[];
  onSelectLook: (look: Look) => void;
  onClearSuggestions?: () => void;
  onClearAll?: () => void;
};

export default function WearingPanel({
  equipped,
  currentLook,
  isGenerating,
  generateError,
  onGenerate,
  onRemove,
  onAddToBag,
  preferences,
  onPreferencesChange,
  stylistSource,
  recommendedLooks,
  onSelectLook,
  onClearSuggestions,
  onClearAll,
}: Props) {
  return (
    <section className="flex flex-col rounded-3xl border border-[#E8E3DB] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E3DB]">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">You Are Wearing</h2>
          <p className="text-xs text-[#8A8480] mt-0.5">{equipped.length} piece{equipped.length !== 1 ? "s" : ""} selected</p>
        </div>
        <div className="flex items-center gap-2">
          {(equipped.length > 0 || recommendedLooks.length > 0) && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              title="Clear all equipped items and suggestions"
              className="flex items-center gap-1 rounded-xl border border-[#E8E3DB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#8A8480] transition hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50 active:scale-95"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
          )}
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
      </div>

      {/* Generate error */}
      {generateError && (
        <div className="mx-6 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
          {generateError}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 px-6 pt-4">
        <label className="text-[10px] font-bold uppercase tracking-wide text-[#8A8480]">
          Gender
          <select
            value={preferences.gender ?? "all"}
            onChange={(e) => onPreferencesChange({ ...preferences, gender: e.target.value as StylePreferences["gender"] })}
            className="mt-1 w-full rounded-xl border border-[#E8E3DB] bg-white px-2 py-2 text-xs font-medium normal-case tracking-normal text-[#1A1A1A] outline-none focus:border-[#C4A882]"
          >
            <option value="all">All</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-[#8A8480]">
          Occasion
          <select
            value={preferences.occasion ?? "any"}
            onChange={(e) => onPreferencesChange({ ...preferences, occasion: e.target.value as StylePreferences["occasion"] })}
            className="mt-1 w-full rounded-xl border border-[#E8E3DB] bg-white px-2 py-2 text-xs font-medium normal-case tracking-normal text-[#1A1A1A] outline-none focus:border-[#C4A882]"
          >
            <option value="any">Any</option>
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
            className="mt-1 w-full rounded-xl border border-[#E8E3DB] bg-white px-2 py-2 text-xs font-medium normal-case tracking-normal text-[#1A1A1A] outline-none focus:border-[#C4A882]"
          >
            <option value="balanced">Balanced</option>
            <option value="define-waist">Waist</option>
            <option value="vertical-line">Vertical</option>
            <option value="shoulder-structure">Shoulder</option>
          </select>
        </label>
      </div>

      {recommendedLooks.length > 0 && (
        <div className="px-6 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#8A8480]">Top 3 suggestions</p>
              {onClearSuggestions && (
                <button
                  type="button"
                  onClick={onClearSuggestions}
                  title="Clear generated outfit suggestions to generate again"
                  className="inline-flex items-center gap-1 rounded-full border border-[#E8E3DB] bg-[#F7F5F0] px-2 py-0.5 text-[9px] font-semibold text-[#8A8480] transition hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50"
                >
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear suggestions
                </button>
              )}
            </div>
            <p className="text-[10px] text-[#8A8480]">Choose before “Show on me”</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {recommendedLooks.map((look, index) => {
              const selected = currentLook === look;
              return (
                <button
                  key={`${look.formula}-${look.items.map((item) => item.id).join("-")}`}
                  type="button"
                  onClick={() => onSelectLook(look)}
                  aria-pressed={selected}
                  className={`rounded-2xl border p-2 text-left transition ${selected ? "border-[#C4A882] bg-[#EDE5D8] shadow-sm" : "border-[#E8E3DB] bg-white hover:border-[#C4A882]/70"}`}
                >
                  <div className="mb-2 flex -space-x-2 overflow-hidden">
                    {look.items.slice(0, 4).map((item) => (
                      <span key={item.id} className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-[#F7F5F0] p-0.5 flex items-center justify-center">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px]" aria-hidden="true">👕</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="truncate text-[11px] font-semibold text-[#1A1A1A]">{index + 1}. {look.stylistTitle ?? look.formula}</p>
                  <p className="mt-0.5 text-[10px] text-[#8A8480]">{(look.cohesion * 100).toFixed(0)}% cohesion</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Equipped items */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[200px] max-h-[360px]">
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
          (() => {
            const isRenderable = (item: Item) => !["shoe", "accessory"].includes(item.category ?? item.slot);
            const renderables = equipped.filter(isRenderable);
            const accents = equipped.filter((i) => !isRenderable(i));

            const renderCard = (item: Item, isAccent: boolean) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0]/60 p-2.5 transition hover:border-[#C4A882]/40">
                <div className="h-12 w-12 shrink-0 rounded-xl border border-[#E8E3DB] bg-white p-1 flex items-center justify-center">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-base text-[#8A8480]" aria-hidden="true">🧥</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-[#1A1A1A] truncate">{item.title}</span>
                    <span className="shrink-0 rounded bg-[#EDE5D8] px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-[#8A8480]">{item.slot}</span>
                    {item.gender && (
                      <span className="shrink-0 rounded bg-stone-100 px-1 py-0.5 text-[8px] font-medium text-[#735F43]">{item.gender === "men" ? "Men" : "Women"}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#8A8480] mt-0.5 capitalize">
                    {isAccent ? "Style accent · Not rendered on photo" : `${item.palette} · ${item.fit ?? "regular"} fit`}
                  </p>
                </div>
                <button onClick={() => onRemove(item)} aria-label={`Remove ${item.title}`} className="shrink-0 rounded-lg p-1 text-[#8A8480] hover:bg-[#E8E3DB] hover:text-[#1A1A1A] transition">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );

            return (
              <>
                {renderables.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8480]">Renderable Clothing ({renderables.length})</p>
                      <span className="text-[9px] text-emerald-700 font-medium">Applied in virtual try-on</span>
                    </div>
                    {renderables.map((item) => renderCard(item, false))}
                  </div>
                )}

                {accents.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-[#E8E3DB]/70">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A8480]">Style Accents ({accents.length})</p>
                      <span className="text-[9px] text-[#8A8480]">Shoes &amp; accessories</span>
                    </div>
                    {accents.map((item) => renderCard(item, true))}
                  </div>
                )}
              </>
            );
          })()
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
