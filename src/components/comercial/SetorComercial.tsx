"use client";
import { useState, useMemo } from "react";
import { useLeads } from "@/hooks/useLeads";
import DashboardComercial from "./DashboardComercial";
import Pipeline from "./Pipeline";
import TabelaPropostas from "./TabelaPropostas";
import ModalLead from "./ModalLead";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { Lead } from "@/types/app.types";

type Aba = "dashboard" | "pipeline" | "propostas";

export default function SetorComercial() {
  const { leads, loading, salvar, avancarEtapa, enviarParaObras } = useLeads();
  const [aba, setAba]       = useState<Aba>("dashboard");
  const [busca, setBusca]   = useState("");
  const [modalLead, setModalLead] = useState<Lead | "novo" | null>(null);

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
          <button
            onClick={() => setModalLead("novo")}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Novo Lead
          </button>
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
            {aba === "dashboard" && <DashboardComercial leads={leads} />}
            {aba === "pipeline"  && (
              <Pipeline
                leads={leadsFiltrados}
                onEdit={setModalLead}
                onAddLead={() => setModalLead("novo")}
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
    </div>
  );
}
