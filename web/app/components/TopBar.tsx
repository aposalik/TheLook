"use client";
import { useState } from "react";
import type { WeatherContext } from "@/lib/recommend";

type Props = {
  cartCount: number;
  onBagClick: () => void;
  savedCount: number;
  onLookbookClick: () => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  locationPromptEnabled: boolean;
  onLocationPromptToggle: (enabled: boolean) => void;
  activeWeather?: WeatherContext | null;
  onClearWeather?: () => void;
  accountLabel: string;
  isGuest: boolean;
  onAccountClick: () => void;
};

export default function TopBar({
  cartCount,
  onBagClick,
  savedCount,
  onLookbookClick,
  soundEnabled,
  onSoundToggle,
  locationPromptEnabled,
  onLocationPromptToggle,
  activeWeather,
  onClearWeather,
  accountLabel,
  isGuest,
  onAccountClick,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E3DB] bg-[#F7F5F0]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-1.5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/brand/thelook-logo-light.png"
            alt="TheLook"
            className="h-14 w-[94px] shrink-0 object-contain"
          />
          <span className="hidden rounded-full bg-[#EDE5D8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#8A8480] sm:inline-flex">Fitting Room</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onAccountClick}
            title={accountLabel}
            className="flex max-w-40 items-center gap-2 rounded-xl border border-[#E8E3DB] bg-white px-3 py-2 text-sm font-medium text-[#1A1A1A] shadow-sm transition hover:border-[#C4A882] active:scale-95"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${isGuest ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden="true" />
            <span className="hidden truncate md:inline">{accountLabel}</span>
            <span className="md:hidden" aria-hidden="true">Account</span>
          </button>

          {/* Settings popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              aria-label="Open settings"
              title="Settings (Location & Weather, Sound)"
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition active:scale-95 ${
                settingsOpen
                  ? "border-[#C4A882] bg-[#1A1A1A] text-white"
                  : "border-[#E8E3DB] bg-white text-[#1A1A1A] hover:border-[#C4A882]"
              }`}
            >
              <span aria-hidden="true">⚙️</span>
              <span className="hidden lg:inline">Settings</span>
              {locationPromptEnabled && (
                <span className="h-2 w-2 rounded-full bg-emerald-500" title="Location & Weather enabled" />
              )}
            </button>

            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <div className="absolute right-0 mt-2 z-50 w-80 rounded-2xl border border-[#E8E3DB] bg-white p-4 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E8E3DB] pb-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">Fitting Room Settings</p>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(false)}
                      className="text-xs text-[#8A8480] hover:text-[#1A1A1A]"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Location & Weather Setting */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#1A1A1A]">Ask for Location &amp; Weather</p>
                      <p className="text-[11px] text-[#8A8480] mt-0.5 leading-snug">
                        Prompt for your location &amp; live forecast every time you generate outfits.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={locationPromptEnabled}
                      onClick={() => onLocationPromptToggle(!locationPromptEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        locationPromptEnabled ? "bg-[#1A1A1A]" : "bg-[#E8E3DB]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          locationPromptEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {activeWeather && (
                    <div className="flex items-center justify-between rounded-xl bg-[#F7F5F0] px-3 py-2 text-[11px]">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-[#1A1A1A]">📍 {activeWeather.location}</span>
                        <span className="text-[#8A8480] ml-1">
                          · {activeWeather.tempCurrent ?? `${activeWeather.tempMin}–${activeWeather.tempMax}`}°C, {activeWeather.condition}
                        </span>
                      </div>
                      {onClearWeather && (
                        <button
                          type="button"
                          onClick={onClearWeather}
                          className="shrink-0 text-[10px] font-semibold text-rose-600 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* Sound Setting */}
                  <div className="flex items-center justify-between border-t border-[#E8E3DB] pt-3">
                    <div>
                      <p className="text-xs font-semibold text-[#1A1A1A]">Sound Effects</p>
                      <p className="text-[11px] text-[#8A8480]">UI clicks and try-on audio cues</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={soundEnabled}
                      onClick={onSoundToggle}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        soundEnabled ? "bg-[#1A1A1A]" : "bg-[#E8E3DB]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          soundEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button onClick={onLookbookClick} className="relative flex items-center gap-2 rounded-xl border border-[#E8E3DB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] shadow-sm transition hover:border-[#C4A882] active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Looks
            {savedCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-white">{savedCount}</span>}
          </button>
          <button onClick={onBagClick} className="relative flex items-center gap-2 rounded-xl border border-[#E8E3DB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] shadow-sm transition hover:border-[#C4A882] active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Bag
            {cartCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-white">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
