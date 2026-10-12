"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type EmailCredentials = {
  email: string;
  password: string;
  captchaToken?: string;
};

type AuthResult = { error: string | null; needsEmailVerification?: boolean };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  isGuest: boolean;
  isVerifiedAccount: boolean;
  signInWithEmail: (credentials: EmailCredentials) => Promise<AuthResult>;
  signUpWithEmail: (credentials: EmailCredentials) => Promise<AuthResult>;
  startGuest: (captchaToken?: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOutToGuest: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const createGuest = useCallback(async (captchaToken?: string) => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signInAnonymously(
      captchaToken ? { options: { captchaToken } } : undefined,
    );
    return { error: error?.message ?? null };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setLoading(false);
        return;
      }
      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }
      if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
        setLoading(false);
        return;
      }
      const guestResult = await createGuest();
      if (active && guestResult.error) setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [createGuest, supabase]);

  const signInWithEmail = useCallback(async ({ email, password, captchaToken }: EmailCredentials): Promise<AuthResult> => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const signUpWithEmail = useCallback(async ({ email, password, captchaToken }: EmailCredentials): Promise<AuthResult> => {
    if (!supabase) return { error: "Supabase is not configured." };
    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    // Supabase returns a fake success with an identities[] array when the email
    // already exists but email confirmation is on — surface it clearly.
    if (!error && data.user && data.user.identities?.length === 0) {
      return { error: "An account with that email already exists. Try signing in instead." };
    }
    return {
      error: error?.message ?? null,
      needsEmailVerification: !error && !data.session,
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: "Supabase is not configured." };
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const signOutToGuest = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: "Supabase is not configured." };
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    return createGuest();
  }, [createGuest, supabase]);

  const user = session?.user ?? null;
  const isGuest = Boolean(user?.is_anonymous);
  const isVerifiedAccount = Boolean(user && !user.is_anonymous && (user.email_confirmed_at || user.app_metadata.provider === "google"));

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      configured: isSupabaseConfigured,
      isGuest,
      isVerifiedAccount,
      startGuest: createGuest,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOutToGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
