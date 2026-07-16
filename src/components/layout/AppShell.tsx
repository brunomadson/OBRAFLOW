"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import { useObras } from "@/hooks/useObras";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useConfig } from "@/hooks/useConfig";
import { useAssinaturaStatus } from "@/hooks/useAssinaturaStatus";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import { getSetorInicial } from "@/lib/utils";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { leads, reload: reloadLeads } = useLeads();
  const { obras, reload: reloadObras } = useObras();
  const config = useConfig();
  const notifs = useNotificacoes(leads, obras, config, []);
  const { pastDue } = useAssinaturaStatus();
  const { percentUsed, proximoDoLimite } = useStorageUsage();

  const notifCount = notifs.filter((n) => n.tipo === "critico").length;

  // O badge do sidebar é calculado a partir de leads/obras buscados só uma vez
  // no mount — sem isso, ele fica desatualizado (alertas já resolvidos
  // continuam contando) enquanto o usuário navega pelo app sem dar F5.
  const primeiraRenderizacao = useRef(true);
  useEffect(() => {
    if (primeiraRenderizacao.current) { primeiraRenderizacao.current = false; return; }
    reloadLeads();
    reloadObras();
  }, [pathname, reloadLeads, reloadObras]);

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
        {pastDue && (
          <div className="bg-amber-500 text-white text-xs font-semibold text-center py-2 px-4">
            Pagamento atrasado — regularize a assinatura pra evitar a suspensão do acesso.
          </div>
        )}
        {proximoDoLimite && (
          <div className="bg-amber-500 text-white text-xs font-semibold text-center py-2 px-4">
            Seu armazenamento está próximo do limite ({percentUsed}% usado) — considere conectar o Google Drive ou fazer upgrade de plano em Configurações → Integrações.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
