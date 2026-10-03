"use client";
import { useEffect, useState } from "react";

type Item = { id: string; slot: string; title: string; image: string; category?: string; layer?: string | null };
type Look = { formula: string; items: Item[]; roles: string[]; score: number; cohesion: number; reason: string };
type Avatar = { id: string; url: string };

const AV_KEY = "thelook_avatars";
const AV_ACTIVE = "thelook_active_avatar";

// Catalog is shown grouped by these buckets, in this order.
const GROUPS: { key: string; label: string; match: (i: Item) => boolean }[] = [
  { key: "tops", label: "Tops", match: (i) => i.slot === "top" },
  { key: "bottoms", label: "Bottoms", match: (i) => i.slot === "bottom" },
  { key: "outerwear", label: "Outerwear", match: (i) => i.slot === "outerwear" },
  { key: "shoes", label: "Shoes", match: (i) => i.slot === "shoe" },
  { key: "accessories", label: "Accessories", match: (i) => i.slot === "accessory" },
  { key: "dresses", label: "Dresses", match: (i) => i.slot === "dress" },
];

/** Downscale an uploaded image to keep localStorage small and uploads fast. */
function downscale(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = r.result as string;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function CompleteLook({ catalog }: { catalog: Item[] }) {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [looks, setLooks] = useState<Look[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [render, setRender] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [err, setErr] = useState<string>("");

  // load saved avatars once (client-only)
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem(AV_KEY) || "[]") as Avatar[];
      setAvatars(a);
      setActiveId(localStorage.getItem(AV_ACTIVE) || a[0]?.id || null);
    } catch { /* ignore */ }
  }, []);

  function persist(next: Avatar[], active: string | null) {
    setAvatars(next); setActiveId(active);
    localStorage.setItem(AV_KEY, JSON.stringify(next));
    if (active) localStorage.setItem(AV_ACTIVE, active);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await downscale(f);
    const av = { id: crypto.randomUUID(), url };
    persist([...avatars, av], av.id);
  }

  function removeAvatar(id: string) {
    const next = avatars.filter((a) => a.id !== id);
    persist(next, activeId === id ? next[0]?.id ?? null : activeId);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function suggest() {
    if (!selected.length) return;
    setLoading(true); setLooks(null); setChosen(null); setRender(null); setErr("");
    try {
      const r = await fetch(`/api/recommend?anchors=${encodeURIComponent(selected.join(","))}`);
      const j = await r.json();
      setLooks(j.looks as Look[]);
    } finally {
      setLoading(false);
    }
  }

  async function seeOnMe() {
    const active = avatars.find((a) => a.id === activeId);
    if (chosen === null || !looks || !active) return;
    setRendering(true); setRender(null); setErr("");
    try {
      const r = await fetch("/api/tryon-look", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoBase64: active.url, itemIds: looks[chosen].items.map((it) => it.id) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "render failed");
      setRender(j.resultUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRendering(false);
    }
  }

  const byId = (id: string) => catalog.find((c) => c.id === id)!;
  const active = avatars.find((a) => a.id === activeId);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">TheLook — Fitting Room</h1>
      <p className="mb-6 text-sm text-neutral-500">Pick the pieces you like, hit <b>Suggest outfits</b>, then <b>See on me</b>.</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_1fr]">
        {/* LEFT: avatar stage + render */}
        <section className="rounded-xl border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Your avatar</h2>
            <label className="cursor-pointer text-xs text-blue-600 hover:underline">
              + Upload photo
              <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
            </label>
          </div>
          <div className="flex min-h-56 items-center justify-center rounded-lg bg-neutral-50">
            {render ? (
              <img src={render} alt="you in this look" className="max-h-96 object-contain" />
            ) : active ? (
              <img src={active.url} alt="avatar" className="max-h-96 object-contain" />
            ) : (
              <span className="p-8 text-sm text-neutral-400">Upload a full-body photo to start</span>
            )}
          </div>
          {/* avatar switcher */}
          {avatars.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {avatars.map((a) => (
                <div key={a.id} className="relative">
                  <button onClick={() => persist(avatars, a.id)}
                    className={`block h-14 w-14 overflow-hidden rounded-md border ${a.id === activeId ? "ring-2 ring-black" : ""}`}>
                    <img src={a.url} alt="" className="h-full w-full object-cover" />
                  </button>
                  <button onClick={() => removeAvatar(a.id)}
                    className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-black text-[10px] leading-4 text-white">×</button>
                </div>
              ))}
            </div>
          )}
          {err && <p className="mt-3 text-sm text-red-600 break-words">{err}</p>}
        </section>

        {/* RIGHT: you are wearing + suggest */}
        <section className="rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-medium">You are wearing <span className="text-neutral-400">({selected.length})</span></h2>
          {selected.length === 0 ? (
            <p className="text-sm text-neutral-400">Tap items below to add them here.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selected.map((id) => (
                <div key={id} className="relative w-16">
                  <img src={byId(id).image} alt={byId(id).title} className="aspect-square w-full object-contain" />
                  <button onClick={() => toggle(id)}
                    className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-black text-[10px] leading-4 text-white">×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={suggest} disabled={!selected.length || loading}
            className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40">
            {loading ? "Thinking…" : "Suggest outfits"}
          </button>

          {looks && (
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-medium">Pick a suggestion</h3>
              {looks.map((L, i) => (
                <button key={i} onClick={() => setChosen(i)}
                  className={`block w-full rounded-lg border p-3 text-left ${chosen === i ? "ring-2 ring-black" : "hover:bg-neutral-50"}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-black px-2 py-0.5 text-[10px] text-white">{L.formula}</span>
                    <span className="text-[10px] text-neutral-500">cohesion {(L.cohesion * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {L.items.map((it) => (
                      <img key={it.id} src={it.image} alt={it.title} className="h-12 w-12 object-contain" />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-600">{L.reason}</p>
                </button>
              ))}
              <button onClick={seeOnMe} disabled={chosen === null || !active || rendering}
                title={active ? "" : "Upload/select an avatar first"}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-40">
                {rendering ? "Rendering…" : "See on me"}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* BOTTOM: categorized catalog */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Catalog</h2>
        {GROUPS.map((g) => {
          const items = catalog.filter(g.match);
          if (!items.length) return null;
          return (
            <div key={g.key} className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{g.label}</h3>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {items.map((it) => (
                  <button key={it.id} onClick={() => toggle(it.id)}
                    className={`rounded-lg border p-2 ${selected.includes(it.id) ? "ring-2 ring-black" : "hover:bg-neutral-50"}`}>
                    <img src={it.image} alt={it.title} className="aspect-square w-full object-contain" />
                    <div className="mt-1 truncate text-xs">{it.title}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
