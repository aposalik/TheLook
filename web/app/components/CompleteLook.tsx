"use client";
import { useState } from "react";

type Item = { id: string; slot: string; title: string; image: string; category?: string; layer?: string | null };
type Look = { formula: string; items: Item[]; roles: string[]; score: number; cohesion: number; reason: string };

export default function CompleteLook({ catalog }: { catalog: Item[] }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [looks, setLooks] = useState<Look[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [renders, setRenders] = useState<Record<number, string>>({});
  const [rendering, setRendering] = useState<number | null>(null);
  const [renderErr, setRenderErr] = useState<Record<number, string>>({});

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  }

  async function pick(id: string) {
    setAnchor(id); setLoading(true); setLooks(null);
    const r = await fetch(`/api/recommend?anchor=${encodeURIComponent(id)}`);
    const j = await r.json();
    setLooks(j.looks as Look[]);
    setRenders({}); setRenderErr({});
    setLoading(false);
  }

  async function tryLook(L: Look, i: number) {
    if (!photo) return;
    setRendering(i);
    setRenderErr((e) => ({ ...e, [i]: "" }));
    try {
      const r = await fetch("/api/tryon-look", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoBase64: photo, itemIds: L.items.map((it) => it.id) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "render failed");
      setRenders((m) => ({ ...m, [i]: j.resultUrl }));
    } catch (e) {
      setRenderErr((m) => ({ ...m, [i]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setRendering(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">TheLook — Complete the Look</h1>
      <p className="mb-6 text-sm text-neutral-500">Pick one item you want to wear; TheLook builds the outfits that go with it.</p>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium">Your photo <span className="font-normal text-neutral-400">(for try-on, optional for now)</span></label>
        <input type="file" accept="image/*" onChange={onFile} className="text-sm" />
        {photo && <img src={photo} alt="you" className="mt-2 h-28 rounded-lg border object-cover" />}
      </div>

      <label className="mb-2 block text-sm font-medium">Pick an item to build around</label>
      <div className="grid grid-cols-5 gap-3">
        {catalog.map((it) => (
          <button key={it.id} onClick={() => pick(it.id)}
            className={`rounded-lg border p-2 ${anchor === it.id ? "ring-2 ring-black" : "hover:bg-neutral-50"}`}>
            <img src={it.image} alt={it.title} className="aspect-square w-full object-contain" />
            <div className="mt-1 truncate text-xs">{it.title}</div>
            <div className="text-[10px] uppercase text-neutral-400">{it.slot}</div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {loading && <p className="text-sm text-neutral-500">Building outfits…</p>}
        {looks && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Top {looks.length} looks</h2>
            {looks.map((L, i) => (
              <div key={i} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white">{L.formula}</span>
                  <span className="text-xs text-neutral-500">cohesion {(L.cohesion * 100).toFixed(0)}%</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {L.items.map((it, j) => (
                    <div key={it.id} className="w-24">
                      <img src={it.image} alt={it.title} className="aspect-square w-full object-contain" />
                      <div className="mt-1 text-center text-[10px] uppercase text-neutral-400">{L.roles[j]}</div>
                      <div className="truncate text-center text-xs">{it.title}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-neutral-700">{L.reason}</p>

                <div className="mt-4 flex items-start gap-4">
                  <button
                    onClick={() => tryLook(L, i)}
                    disabled={!photo || rendering !== null}
                    title={photo ? "" : "Upload a full-body photo first"}
                    className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
                  >
                    {rendering === i ? "Rendering…" : "Try this look on"}
                  </button>
                  {renderErr[i] && <p className="text-sm text-red-600 break-words">{renderErr[i]}</p>}
                  {renders[i] && (
                    <img src={renders[i]} alt="you in this look" className="max-h-80 rounded-lg border object-contain" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
