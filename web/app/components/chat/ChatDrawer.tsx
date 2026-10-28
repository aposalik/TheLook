"use client";
import { useEffect, useRef, useState } from "react";
import ChatMessage, { type Message } from "./ChatMessage";
import type { Item, WeatherContext } from "@/lib/recommend";

type Props = {
  /** The user's own wardrobe items (falls back to catalogItems if empty). */
  userItems: Item[];
  catalogItems?: Item[];
  userWeather?: WeatherContext | null;
  onEquip: (items: Item[]) => void;
};

type ChatResponse = {
  reply?: string;
  stylistTitle?: string;
  weatherSummary?: string | null;
  location?: string | null;
  date?: string | null;
  itemIds?: string[];
  noOutfit?: boolean;
  error?: string;
};

const SUGGESTIONS = [
  "Going to a wedding in Istanbul this Saturday",
  "Day trip to the mountains next weekend",
  "Work meeting tomorrow, need to look sharp",
];

/** yyyy-mm-dd in the browser's timezone, so "tomorrow" means the user's tomorrow. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Strip image bytes/URLs — the server only needs metadata, and base64 cutouts are large. */
function slim(item: Item): Omit<Item, "image"> & { image: string } {
  return { ...item, image: "" };
}

export default function ChatDrawer({ userItems, catalogItems = [], userWeather, onEquip }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasNewLook, setHasNewLook] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeWardrobe = userItems.length >= 2 ? userItems : [...userItems, ...catalogItems];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openDrawer() {
    setOpen(true);
    setHasNewLook(false);
    setTimeout(() => inputRef.current?.focus(), 150);
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    setInput("");

    // Text-only history for context (last 6 turns).
    const history = messages
      .filter((m): m is Extract<Message, { role: "user" | "assistant" }> => m.role === "user" || m.role === "assistant")
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          wardrobe: activeWardrobe.map(slim),
          today: localToday(),
          userWeather,
        }),
      });
      const data = await res.json() as ChatResponse;

      if (!res.ok || data.error) {
        setMessages((prev) => [...prev, { role: "error", text: data.error ?? `Something went wrong (HTTP ${res.status}).` }]);
        return;
      }

      // Map returned IDs back to the local items so cards show the real cutout images.
      const byId = new Map(activeWardrobe.map((i) => [i.id, i]));
      const items = (data.itemIds ?? []).map((id) => byId.get(id)).filter((i): i is Item => Boolean(i));
      const isOutfit = !data.noOutfit && items.length > 0;

      setMessages((prev) => [
        // A new look replaces the previous outfit card (follow-up refinement).
        ...(isOutfit ? prev.map((m) => (m.role === "assistant" && m.items?.length ? { ...m, superseded: true } : m)) : prev),
        {
          role: "assistant",
          text: data.reply ?? "",
          stylistTitle: data.stylistTitle,
          weatherSummary: data.weatherSummary,
          location: data.location,
          date: data.date,
          items,
          noOutfit: !isOutfit,
        },
      ]);
      if (isOutfit && !open) setHasNewLook(true);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "error", text: e instanceof Error ? e.message : "Network error." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleWear(items: Item[]) {
    onEquip(items);
    setOpen(false);
    setHasNewLook(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={openDrawer}
        aria-label="Open style assistant"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A] text-white shadow-xl transition hover:bg-[#333] active:scale-95"
      >
        <span className="text-xl">✦</span>
        {hasNewLook && (
          <span className="absolute right-1 top-1 h-3 w-3 animate-pulse rounded-full bg-[#C4A882] ring-2 ring-white" />
        )}
      </button>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />}

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Style assistant"
        inert={!open}
        className={`fixed bottom-0 left-0 z-50 flex h-[85vh] w-full max-w-sm flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 sm:bottom-4 sm:left-4 sm:rounded-3xl ${open ? "translate-y-0" : "translate-y-[110%]"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E8E3DB] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C4A882] text-xs font-bold text-white">✦</span>
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Style Assistant</p>
              <p className="text-[10px] text-[#8A8480]">Powered by Gemini + live weather</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="rounded-full px-2 py-1 text-[10px] font-semibold text-[#8A8480] transition hover:text-[#1A1A1A]"
              >New chat</button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F5F0] text-[#8A8480] transition hover:text-[#1A1A1A]">×</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="text-4xl">✦</span>
              <p className="text-sm font-semibold text-[#1A1A1A]">Tell me where you&apos;re going</p>
              <p className="text-xs leading-relaxed text-[#8A8480]">
                I&apos;ll check the weather and pick an outfit from your wardrobe.
              </p>
              {userItems.length === 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  Your wardrobe is empty — add a few of your own clothes first.
                </p>
              )}
              <div className="mt-2 flex w-full flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => void send(s)}
                    disabled={loading}
                    className="rounded-xl border border-[#E8E3DB] px-3 py-2 text-left text-xs text-[#8A8480] transition hover:border-[#C4A882] hover:text-[#1A1A1A] disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <ChatMessage key={i} message={m} onWear={handleWear} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#8A8480]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C4A882] text-[10px] font-bold text-white">✦</span>
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A882]" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A882]" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A882]" style={{ animationDelay: "300ms" }} />
              </span>
              <span>Checking the forecast and your wardrobe…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#E8E3DB] px-4 py-3">
          <div className="flex items-end gap-2 rounded-2xl border border-[#E8E3DB] bg-[#F7F5F0] px-3 py-2 transition focus-within:border-[#1A1A1A]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Where are you going and when?"
              rows={1}
              maxLength={1000}
              className="flex-1 resize-none bg-transparent text-sm text-[#1A1A1A] placeholder-[#8A8480] outline-none"
              style={{ maxHeight: "96px" }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || loading}
              aria-label="Send"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1A1A1A] text-white transition active:scale-95 disabled:opacity-40"
            >
              →
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[#C4A882]">Enter to send · Shift+Enter for new line</p>
        </div>
      </aside>
    </>
  );
}
