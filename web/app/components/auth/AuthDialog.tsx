"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import TurnstileWidget from "./TurnstileWidget";

type Mode = "sign-in" | "create";

export default function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    user,
    isGuest,
    isVerifiedAccount,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOutToGuest,
  } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = mode === "create"
      ? await signUpWithEmail({ email, password, captchaToken: captchaToken ?? undefined })
      : await signInWithEmail({ email, password, captchaToken: captchaToken ?? undefined });
    setBusy(false);
    setCaptchaToken(null);
    setCaptchaAttempt((value) => value + 1);

    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (result.needsEmailVerification) {
      setMessage("Check your email and confirm the account. This browser remains signed out until verification is complete.");
      return;
    }
    onClose();
  }

  async function startGoogle() {
    setBusy(true);
    setMessage(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setBusy(false);
      setMessage(result.error);
    }
  }

  async function logout() {
    setBusy(true);
    setMessage(null);
    const result = await signOutToGuest();
    setBusy(false);
    if (result.error) setMessage(result.error);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/50 bg-[#FFFDF9] shadow-2xl shadow-black/20">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-[#E8E3DB] bg-white text-[#6F6964] transition hover:text-black" aria-label="Close account dialog">×</button>

        <div className="border-b border-[#E8E3DB] bg-[linear-gradient(135deg,#F5EFE5,#FFFDF9)] px-7 pb-6 pt-7">
          <p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#A18462]">Private fitting room</p>
          <h2 id="auth-title" className="mt-2 pr-10 text-2xl font-semibold tracking-tight">
            {isVerifiedAccount ? "Your account" : guestConfirmed ? (mode === "create" ? "Create your account" : "Welcome back") : "Save your wardrobe"}
          </h2>
        </div>

        <div className="p-7">
          {isVerifiedAccount ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#E8E3DB] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8A8480]">Signed in</p>
                <p className="mt-1 break-all font-medium">{user?.email ?? "Google account"}</p>
                <p className="mt-2 text-xs text-emerald-700">Verified permanent account</p>
              </div>
              <p className="text-sm leading-6 text-[#6F6964]">Your permanent wardrobe will remain separate from every guest session.</p>
              <button type="button" onClick={logout} disabled={busy} className="w-full rounded-xl border border-[#D8CEC1] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#A18462] disabled:opacity-50">
                {busy ? "Signing out…" : "Sign out and continue as guest"}
              </button>
              {message && <p className="text-sm text-red-700">{message}</p>}
            </div>
          ) : isGuest && !guestConfirmed ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <strong className="block">Your guest wardrobe will not transfer.</strong>
                Creating or signing into an account opens a new, empty wardrobe. Your current guest uploads stay under the guest ID and are later removed by cleanup.
              </div>
              <button type="button" onClick={() => setGuestConfirmed(true)} className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black">I understand — continue</button>
              <button type="button" onClick={onClose} className="w-full rounded-xl border border-[#E8E3DB] bg-white px-4 py-3 text-sm font-semibold">Keep using guest wardrobe</button>
            </div>
          ) : (
            <div>
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#EEE9E1] p-1 text-sm">
                <button type="button" onClick={() => { setMode("sign-in"); setMessage(null); }} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "sign-in" ? "bg-white shadow-sm" : "text-[#77706A]"}`}>Sign in</button>
                <button type="button" onClick={() => { setMode("create"); setMessage(null); }} className={`rounded-lg px-3 py-2 font-semibold transition ${mode === "create" ? "bg-white shadow-sm" : "text-[#77706A]"}`}>Create account</button>
              </div>

              <button type="button" onClick={startGoogle} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#D8CEC1] bg-white px-4 py-3 text-sm font-semibold transition hover:border-[#A18462] disabled:opacity-50">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1A1A1A] text-[10px] text-white">G</span>
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-[#9A938D]"><span className="h-px flex-1 bg-[#E8E3DB]" />or email<span className="h-px flex-1 bg-[#E8E3DB]" /></div>

              <form onSubmit={submitEmail} className="space-y-3">
                <label className="block text-xs font-semibold text-[#5F5954]">Email
                  <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D8CEC1] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#A18462] focus:ring-2 focus:ring-[#C4A882]/20" />
                </label>
                <label className="block text-xs font-semibold text-[#5F5954]">Password
                  <input required minLength={8} type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#D8CEC1] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#A18462] focus:ring-2 focus:ring-[#C4A882]/20" />
                </label>
                <TurnstileWidget key={captchaAttempt} action={mode === "create" ? "signup" : "login"} onToken={setCaptchaToken} />
                <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50">
                  {busy ? "Please wait…" : mode === "create" ? "Create verified account" : "Sign in"}
                </button>
              </form>
              {message && <p className={`mt-4 rounded-xl p-3 text-sm ${message.startsWith("Check") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
