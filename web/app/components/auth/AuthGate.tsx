"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import TurnstileWidget from "./TurnstileWidget";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { configured, loading, user, startGuest } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createVerifiedGuest(token: string | null) {
    if (!token || creating || user) return;
    setCreating(true);
    setError(null);
    const result = await startGuest(token);
    setError(result.error);
    setCreating(false);
  }

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F0] px-6 text-[#1A1A1A]">
        <section className="max-w-lg rounded-3xl border border-[#E8E3DB] bg-white p-8 shadow-xl shadow-black/5">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#A18462]">Configuration required</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Connect TheLook to Supabase</h1>
          <p className="mt-3 text-sm leading-6 text-[#6F6964]">
            Add the hosted project URL and publishable key to <code>web/.env.local</code>, then restart the app.
          </p>
        </section>
      </main>
    );
  }

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F5F0] px-6 text-[#1A1A1A]">
        <section className="flex max-w-md flex-col items-center rounded-3xl border border-[#E8E3DB] bg-white p-8 text-center shadow-xl shadow-black/5">
          <img src="/brand/thelook-logo-light.png" alt="TheLook" className="h-20 w-36 object-contain" />
          <p className="mt-2 text-sm text-[#6F6964]">Preparing your private fitting room…</p>
          <TurnstileWidget action="create_guest" appearance="interaction-only" onToken={createVerifiedGuest} />
          {creating && <p className="mt-3 text-xs text-[#8A8480]">Creating a private guest session</p>}
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </section>
      </main>
    );
  }

  return children;
}
