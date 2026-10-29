"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import { useObras } from "@/hooks/useObras";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { useServicos } from "@/hooks/useServicos";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { useConfig } from "@/hooks/useConfig";
import { useAssinaturaStatus } from "@/hooks/useAssinaturaStatus";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import { getRecebimentos } from "@/services/recebimentos.service";
import { getLancamentosServicosTecnicos, type LancamentoComServico } from "@/services/lancamentosServico.service";
import { getSetorInicial } from "@/lib/utils";
import type { Recebimento } from "@/types/app.types";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { leads, reload: reloadLeads } = useLeads();
  const { obras, reload: reloadObras } = useObras();
  const { lancamentos, reload: reloadLancamentos } = useFinanceiro();
  const { servicos, reload: reloadServicos } = useServicos();
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const reloadRecebimentos = () => getRecebimentos().then(setRecebimentos).catch(() => {});
  useEffect(() => { reloadRecebimentos(); }, []);
  const [lancamentosServicos, setLancamentosServicos] = useState<LancamentoComServico[]>([]);
  const reloadLancamentosServicos = () => getLancamentosServicosTecnicos().then(setLancamentosServicos).catch(() => {});
  useEffect(() => { reloadLancamentosServicos(); }, []);
  const config = useConfig();
  const notifs = useNotificacoes(leads, obras, config, lancamentos, recebimentos, servicos, lancamentosServicos);
  const { pastDue } = useAssinaturaStatus();
  const { percentUsed, proximoDoLimite } = useStorageUsage();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const notifCount = notifs.filter((n) => n.tipo === "critico").length;

  // Fecha o menu mobile automaticamente ao trocar de página.
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // O badge do sidebar é calculado a partir de leads/obras buscados só uma vez
  // no mount — sem isso, ele fica desatualizado (alertas já resolvidos
  // continuam contando) enquanto o usuário navega pelo app sem dar F5.
  const primeiraRenderizacao = useRef(true);
  useEffect(() => {
    if (primeiraRenderizacao.current) { primeiraRenderizacao.current = false; return; }
    reloadLeads();
    reloadObras();
    reloadLancamentos();
    reloadRecebimentos();
    reloadServicos();
    reloadLancamentosServicos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, reloadLeads, reloadObras, reloadLancamentos, reloadServicos]);

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
      <Sidebar notifCount={notifCount} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Barra superior — só aparece no mobile (a sidebar já cobre isso no desktop) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-950 flex items-center px-4 gap-3 z-[90]">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu"
          className="w-9 h-9 flex items-center justify-center text-white flex-shrink-0"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
          🏗
        </div>
        <span className="font-extrabold text-[15px] text-white tracking-tight">ObraFlow</span>
        {notifCount > 0 && (
          <span className="ml-auto min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center text-[11px] font-bold text-white px-1.5">
            {notifCount}
          </span>
        )}
      </div>

      <main className="pt-14 md:pt-0 md:ml-[200px] flex-1 min-w-0">
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
