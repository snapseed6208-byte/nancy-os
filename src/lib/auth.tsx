import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { User, Session, AuthError } from "@supabase/supabase-js";

// ── Types ──

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// ── Provider ──

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error) };
    return {};
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: translateAuthError(error) };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ── Standalone helper (for hooks that run outside React) ──

export async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required — please sign in");
  return user.id;
}

// ── Helpers ──

function translateAuthError(error: AuthError): string {
  const msg = error.message.toLowerCase();
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) return "邮箱或密码错误";
  if (msg.includes("already registered") || msg.includes("already exists")) return "该邮箱已注册";
  if (msg.includes("email")) return "邮箱格式不正确";
  if (msg.includes("password")) return "密码长度至少6位";
  if (msg.includes("rate") || msg.includes("too many")) return "请求过于频繁，请稍后再试";
  return error.message;
}
