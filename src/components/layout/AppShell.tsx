"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import { useObras } from "@/hooks/useObras";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useConfig } from "@/hooks/useConfig";
import { getSetorInicial } from "@/lib/utils";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { leads } = useLeads();
  const { obras } = useObras();
  const config = useConfig();
  const notifs = useNotificacoes(leads, obras, config, []);

  const notifCount = notifs.filter((n) => n.tipo === "critico").length;

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (!profile?.workspace_id) { router.push("/onboarding"); return; }

    // CEO/Dono tem acesso a todos os setores. Demais usuários só acessam
    // os setores liberados no profile — protege contra acesso direto por URL.
    const isDono = profile.cargo === "CEO / Dono";
    const setorAtual = pathname.split("/")[1];
    if (!isDono && setorAtual && !profile.setores?.includes(setorAtual)) {
      router.push(`/${getSetorInicial(profile)}`);
    }
  }, [user, profile, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center text-xl animate-pulse">
            🏗
          </div>
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar notifCount={notifCount} />
      <main className="ml-[200px] flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
