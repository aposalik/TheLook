"use client";
import type { Item } from "@/lib/recommend";

export type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      stylistTitle?: string;
      weatherSummary?: string | null;
      location?: string | null;
      date?: string | null;
      items?: Item[];
      noOutfit?: boolean;
      /** A newer outfit card replaced this one (follow-up refinement). */
      superseded?: boolean;
    }
  | { role: "error"; text: string };

type Props = {
  message: Message;
  onWear: (items: Item[]) => void;
};

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export default function ChatMessage({ message, onWear }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[#1A1A1A] px-4 py-2.5 text-sm text-white">
          {message.text}
        </div>
      </div>
    );
  }

  if (message.role === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {message.text}
        </div>
      </div>
    );
  }

  const items = message.items ?? [];
  const hasOutfit = !message.noOutfit && items.length > 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        {/* Avatar + text */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C4A882] text-[10px] font-bold text-white">✦</div>
          <div className="rounded-2xl rounded-tl-sm border border-[#E8E3DB] bg-[#F7F5F0] px-4 py-2.5 text-sm leading-relaxed text-[#1A1A1A]">
            {message.text}
          </div>
        </div>

        {/* Weather card */}
        {message.weatherSummary && (
          <div className="ml-8 rounded-xl border border-[#E8E3DB] bg-white px-3 py-2 text-xs text-[#8A8480]">
            <div className="flex items-center gap-1.5">
              <span>📍</span>
              <span className="font-medium text-[#1A1A1A]">{message.location ?? "Your destination"}</span>
              {message.date && <span>· {prettyDate(message.date)}</span>}
            </div>
            <div className="mt-0.5 pl-5 text-[#1A1A1A]">{message.weatherSummary}</div>
          </div>
        )}

        {/* Outfit card */}
        {hasOutfit && (
          <div className={`ml-8 space-y-2 rounded-2xl border border-[#E8E3DB] bg-white p-3 transition ${message.superseded ? "opacity-50" : ""}`}>
            {message.stylistTitle && (
              <p className="text-xs font-semibold text-[#1A1A1A]">{message.stylistTitle}</p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {items.map((item) => (
                <div key={item.id} className="flex shrink-0 flex-col items-center gap-1">
                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-[#E8E3DB] bg-[#F7F5F0]">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.title} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-[#C4A882]">👕</div>
                    )}
                  </div>
                  <span className="max-w-[64px] truncate text-center text-[9px] text-[#8A8480]">{item.title}</span>
                </div>
              ))}
            </div>
            {message.superseded ? (
              <p className="text-center text-[10px] text-[#8A8480]">Replaced by the newer look below</p>
            ) : (
              <button
                type="button"
                onClick={() => onWear(items)}
                className="w-full rounded-xl bg-[#1A1A1A] py-2 text-xs font-semibold text-white transition hover:bg-[#333] active:scale-95"
              >
                Wear this look →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
