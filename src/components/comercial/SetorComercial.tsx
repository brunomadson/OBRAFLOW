"use client";
import { useState, useMemo, useEffect } from "react";
import { useLeads } from "@/hooks/useLeads";
import { usePermissoes } from "@/hooks/usePermissoes";
import { getCorrespondentes } from "@/services/correspondentes.service";
import DashboardComercial from "./DashboardComercial";
import Pipeline from "./Pipeline";
import TabelaPropostas from "./TabelaPropostas";
import ModalLead, { ModalAgendarReuniao, ModalAnalise, ModalResultado } from "./ModalLead";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { Lead, EtapaLead, Correspondente } from "@/types/app.types";

type Aba = "dashboard" | "pipeline" | "propostas";

// Etapas que exigem dados extras antes de confirmar a movimentação (mesma
// regra do botão "Avançar" no ModalLead) — mover por drag-and-drop pra uma
// dessas colunas abre o mesmo sub-modal, não pula direto pra etapa.
const ETAPAS_COM_FORM = new Set<EtapaLead>(["reuniao", "analise", "aprovada", "reprovada"]);

export default function SetorComercial() {
  const { leads, loading, salvar, avancarEtapa, enviarParaObras } = useLeads();
  const { pode } = usePermissoes();
  const [aba, setAba]       = useState<Aba>("dashboard");
  const [busca, setBusca]   = useState("");
  const [modalLead, setModalLead] = useState<Lead | "novo" | null>(null);
  const [correspondentes, setCorrespondentes] = useState<Correspondente[]>([]);
  const [pendente, setPendente] = useState<{ lead: Lead; novaEtapa: EtapaLead } | null>(null);

  useEffect(() => {
    getCorrespondentes().then(setCorrespondentes).catch(() => {});
  }, []);

  const leadsFiltrados = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.nome.toLowerCase().includes(busca.toLowerCase()) ||
          (l.cidade ?? "").toLowerCase().includes(busca.toLowerCase())
      ),
    [leads, busca]
  );

  const tabs: [Aba, string][] = [
    ["dashboard", "Dashboard"],
    ["pipeline",  "Pipeline de Vendas"],
    ["propostas", "Propostas em Andamento"],
  ];

  const handleMoveEtapa = (leadId: string, novaEtapa: EtapaLead) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (ETAPAS_COM_FORM.has(novaEtapa)) {
      // Abre o mesmo formulário do ModalLead em vez de avançar direto —
      // se o usuário cancelar, o card simplesmente volta pra coluna
      // original (a etapa nunca chegou a mudar no estado).
      setPendente({ lead, novaEtapa });
    } else {
      avancarEtapa(leadId, novaEtapa);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 flex items-center gap-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`tab-btn ${aba === id ? "active" : ""}`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 py-2">
          {aba !== "dashboard" && (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 w-44"
            />
          )}
          {pode("comercial", "criar") && (
            <button
              onClick={() => setModalLead("novo")}
              className="btn-primary text-xs px-3 py-1.5"
            >
              + Novo Lead
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-[1400px] mx-auto">
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <>
            {aba === "dashboard" && <DashboardComercial leads={leads} onEdit={setModalLead} />}
            {aba === "pipeline"  && (
              <Pipeline
                leads={leadsFiltrados}
                onEdit={setModalLead}
                onAddLead={() => setModalLead("novo")}
                onMoveEtapa={handleMoveEtapa}
                podeCriar={pode("comercial", "criar")}
              />
            )}
            {aba === "propostas" && (
              <TabelaPropostas leads={leadsFiltrados} onEdit={setModalLead} />
            )}
          </>
        )}
      </div>

      {modalLead !== null && (
        <ModalLead
          lead={modalLead === "novo" ? null : modalLead}
          onClose={() => setModalLead(null)}
          onSave={async (data) => {
            await salvar(data);
            setModalLead(null);
          }}
          onAvancar={async (id, etapa, extras) => { await avancarEtapa(id, etapa, extras); }}
          onEnviarObras={async (id) => { await enviarParaObras(id); }}
        />
      )}

      {/* Sub-modais disparados ao arrastar um card pra uma etapa que exige
          dados extras — mesmos componentes usados dentro do ModalLead. */}
      {pendente?.novaEtapa === "reuniao" && (
        <ModalAgendarReuniao
          nomeLead={pendente.lead.nome}
          onClose={() => setPendente(null)}
          onConfirm={async (d) => {
            await avancarEtapa(pendente.lead.id, "reuniao", {
              data_reuniao: d.data,
              local_reuniao: d.local,
            });
            setPendente(null);
          }}
        />
      )}
      {pendente?.novaEtapa === "analise" && (
        <ModalAnalise
          nomeLead={pendente.lead.nome}
          correspondentes={correspondentes}
          onClose={() => setPendente(null)}
          onConfirm={async (d) => {
            await avancarEtapa(pendente.lead.id, "analise", {
              correspondente_id: d.correspondente_id,
              pls: d.pls,
              obs: d.obs,
            });
            setPendente(null);
          }}
        />
      )}
      {(pendente?.novaEtapa === "aprovada" || pendente?.novaEtapa === "reprovada") && (
        <ModalResultado
          nomeLead={pendente.lead.nome}
          initial={pendente.novaEtapa}
          onClose={() => setPendente(null)}
          onAprovar={async (obs) => {
            await avancarEtapa(pendente.lead.id, "aprovada", { obs });
            setPendente(null);
          }}
          onReprovar={async (motivo) => {
            await avancarEtapa(pendente.lead.id, "reprovada", { obs: motivo });
            setPendente(null);
          }}
        />
      )}
    </div>
  );
}
