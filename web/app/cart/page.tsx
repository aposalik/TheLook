"use client";
import { useState } from "react";
import Link from "next/link";
import { useCart, priceOf } from "@/lib/cart";

export default function CartPage() {
  const { items, count, subtotal, remove, clear } = useCart();
  const [order, setOrder] = useState<string | null>(null);

  function checkout() {
    // Mock checkout: no payment, just confirm the order and empty the bag.
    const n = "TL-" + Math.abs(subtotal * 97 + count * 13).toString(36).toUpperCase().padStart(5, "0");
    setOrder(n);
    clear();
  }

  if (order) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border bg-neutral-50 p-8 text-center">
          <div className="text-4xl">✅</div>
          <h1 className="mt-3 text-2xl font-semibold">Order placed</h1>
          <p className="mt-1 text-sm text-neutral-600">Confirmation <span className="font-mono">{order}</span> — this is a demo checkout, no payment was taken.</p>
          <Link href="/" className="mt-6 inline-block rounded-lg bg-black px-4 py-2 text-sm text-white">Back to the fitting room</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your bag {count > 0 && <span className="text-neutral-400">({count})</span>}</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">← Keep shopping</Link>
      </div>

      {count === 0 ? (
        <p className="rounded-xl border bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          Your bag is empty. <Link href="/" className="underline">Build a look</Link> and add the set.
        </p>
      ) : (
        <>
          <ul className="divide-y rounded-xl border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 p-3">
                <img src={it.image} alt={it.title} className="h-16 w-16 rounded-lg border object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.title}</div>
                  <div className="text-[10px] uppercase text-neutral-400">{it.slot}</div>
                </div>
                <div className="text-sm tabular-nums">${priceOf(it.id)}</div>
                <button onClick={() => remove(it.id)} className="text-xs text-neutral-400 hover:text-red-600">Remove</button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-neutral-500">Subtotal</span>
            <span className="text-lg font-semibold tabular-nums">${subtotal}</span>
          </div>
          <button onClick={checkout} className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-white">Checkout</button>
          <button onClick={clear} className="mt-2 w-full text-xs text-neutral-400 hover:underline">Empty bag</button>
        </>
      )}
    </main>
  );
}
