import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = {
  user: User | null;
  session: Session | null;
  initializing: boolean;
  signOut: () => Promise<void>;
  signInGuest: () => Promise<void>;
  signInWithEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const next = data.session ?? null;
      setSession(next);
      if (next?.access_token) supabase.functions.setAuth(next.access_token);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) supabase.functions.setAuth(nextSession.access_token);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      user: session?.user ?? null,
      session,
      initializing,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      signInGuest: async () => {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      },
      signInWithEmailOtp: async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
      },
      verifyEmailOtp: async (email: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
        if (error) throw error;
      },
      signInWithPassword: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
    };
  }, [session, initializing]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}


