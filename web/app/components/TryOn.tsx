"use client";
import { useState } from "react";

type Item = { id: string; slot: string; title: string; image: string };

export default function TryOn({ catalog }: { catalog: Item[] }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result as string);
    r.readAsDataURL(f);
  }

  async function tryOn() {
    if (!photo || !sel) return;
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/tryon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoBase64: photo, garmentId: sel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "request failed");
      setRes(j.resultUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">FitRoom — walking skeleton</h1>
      <p className="text-sm text-neutral-500 mb-6">Upload a full-body photo, pick one garment, render it on yourself.</p>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">1 · Your photo</label>
            <input type="file" accept="image/*" onChange={onFile} className="text-sm" />
            {photo && <img src={photo} alt="you" className="mt-2 w-full rounded-lg border" />}
          </div>
          <button
            onClick={tryOn}
            disabled={!photo || !sel || loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40"
          >
            {loading ? "Rendering…" : "Try it on"}
          </button>
          {err && <p className="text-sm text-red-600 break-words">{err}</p>}
        </section>

        <section>
          <label className="block text-sm font-medium mb-2">2 · Pick a garment</label>
          <div className="grid grid-cols-3 gap-3">
            {catalog.map((it) => (
              <button
                key={it.id}
                onClick={() => setSel(it.id)}
                className={`rounded-lg border p-2 text-left ${sel === it.id ? "ring-2 ring-black" : ""}`}
              >
                <img src={it.image} alt={it.title} className="aspect-square w-full object-contain" />
                <div className="mt-1 truncate text-xs">{it.title}</div>
                <div className="text-[10px] uppercase text-neutral-400">{it.slot}</div>
              </button>
            ))}
          </div>

          <label className="mt-6 block text-sm font-medium mb-2">3 · Result</label>
          <div className="min-h-64 rounded-lg border bg-neutral-50 p-2">
            {res ? <img src={res} alt="result" className="mx-auto max-h-[70vh] rounded" /> : <p className="p-6 text-sm text-neutral-400">Your try-on will appear here.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
