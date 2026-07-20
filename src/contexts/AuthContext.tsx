"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/client";
import { getProfile } from "@/services/profiles.service";
import type { Profile } from "@/types/app.types";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// Sessão expira 24h após o último login — evita que alguém fique logado
// indefinidamente num computador compartilhado e outro funcionário acabe
// vendo o acesso de quem logou antes.
const SESSAO_MAX_IDADE_MS = 24 * 60 * 60 * 1000;

function sessaoExpirada(u: User | null): boolean {
  if (!u?.last_sign_in_at) return false;
  return Date.now() - new Date(u.last_sign_in_at).getTime() > SESSAO_MAX_IDADE_MS;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (sessaoExpirada(u)) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return;
        }
        setUser(u);
        if (u) {
          const p = await getProfile(u.id);
          setProfile(p);
        }
      } catch (err) {
        console.error("Erro ao inicializar sessão:", err);
      } finally {
        setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      const u = session?.user ?? null;
      if (sessaoExpirada(u)) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return;
      }
      setUser(u);
      if (u) {
        const p = await getProfile(u.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    // Cobre o caso da aba ficar aberta e atravessar as 24h sem recarregar.
    const interval = setInterval(async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (sessaoExpirada(u)) await supabase.auth.signOut();
    }, 5 * 60 * 1000);

    return () => { subscription.unsubscribe(); clearInterval(interval); };
  }, [supabase]);

  // Identifica quem está logado nos eventos do Sentry — sem isso, um erro
  // reportado não diz de qual empresa/usuário veio, inviável pra suporte.
  // Sentry.setUser/setContext são no-op se o SDK estiver desativado
  // (sem SENTRY_DSN configurado), então isso não tem custo nenhum hoje.
  useEffect(() => {
    if (user && profile) {
      Sentry.setUser({ id: user.id, email: user.email });
      Sentry.setContext("workspace", { id: profile.workspace_id ?? null, cargo: profile.cargo });
    } else {
      Sentry.setUser(null);
    }
  }, [user, profile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const p = await getProfile(u.id);
      setProfile(p);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
