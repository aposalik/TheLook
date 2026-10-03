// Minimal client-side bag: ids persisted to localStorage, resolved against the catalog.
// No backend — this is the mock commerce loop (Phase 4 #26). Prices are deterministic
// mock values derived from the id so the bag total is stable without a pricing table.
"use client";
import { useCallback, useEffect, useState } from "react";
import catalogData from "@/data/catalog.json";

export type Item = { id: string; slot: string; title: string; image: string };
const CATALOG = catalogData as Item[];
const KEY = "thelook_cart";

/** Stable mock price in whole dollars (29–118), derived from the id. */
export function priceOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 29 + (h % 90);
}

function read(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function useCart() {
  const [ids, setIds] = useState<string[]>([]);

  // hydrate after mount + stay in sync across tabs/components
  useEffect(() => {
    setIds(read());
    const onChange = () => setIds(read());
    window.addEventListener("thelook-cart", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("thelook-cart", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const commit = useCallback((next: string[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setIds(next);
    window.dispatchEvent(new Event("thelook-cart")); // notify other mounted hooks
  }, []);

  const add = useCallback((add: string[]) => {
    commit(Array.from(new Set([...read(), ...add])));
  }, [commit]);
  const remove = useCallback((id: string) => commit(read().filter((x) => x !== id)), [commit]);
  const clear = useCallback(() => commit([]), [commit]);

  const items = ids.map((id) => CATALOG.find((c) => c.id === id)).filter(Boolean) as Item[];
  const subtotal = items.reduce((s, it) => s + priceOf(it.id), 0);
  return { ids, items, count: items.length, subtotal, add, remove, clear };
}
