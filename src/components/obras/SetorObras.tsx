"use client";
import { useState } from "react";
import { useObras } from "@/hooks/useObras";
import DashboardObras from "./DashboardObras";
import AbaObras from "./AbaObras";
import AbaMedicoes from "./AbaMedicoes";
import ModalObra from "./ModalObra";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { EtapaObra } from "@/types/app.types";

type Aba = "dashboard" | "obras" | "medicoes";

export default function SetorObras() {
  const { obras, loading, salvar, avancarEtapa, salvarMedicao, removerMedicao } = useObras();
  const [aba, setAba]     = useState<Aba>("dashboard");
  const [busca, setBusca] = useState("");

  // Armazena só o ID para que o modal sempre reflita o estado atual das obras
  const [modalObraId, setModalObraId] = useState<string | "nova" | null>(null);

  const modalObra = modalObraId === null
    ? null
    : modalObraId === "nova"
      ? null
      : obras.find((o) => o.id === modalObraId) ?? null;

  const tabs: [Aba, string][] = [
    ["dashboard", "Dashboard"],
    ["obras",     "Obras"],
    ["medicoes",  "Medições"],
  ];

  return (
    <div>
      <div className="bg-white border-b border-slate-100 px-6 flex items-center gap-1">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} className={`tab-btn ${aba === id ? "active" : ""}`}>
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
          <button onClick={() => setModalObraId("nova")} className="btn-primary text-xs px-3 py-1.5">
            + Nova Obra
          </button>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto">
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <>
            {aba === "dashboard" && <DashboardObras obras={obras} />}
            {aba === "obras" && (
              <AbaObras obras={obras} busca={busca} onEdit={(obra) => setModalObraId(obra.id)} />
            )}
            {aba === "medicoes" && (
              <AbaMedicoes
                obras={obras}
                onEditMedicao={(obra, _m) => { void _m; setModalObraId(obra.id); }}
              />
            )}
          </>
        )}
      </div>

      {modalObraId !== null && (
        <ModalObra
          obra={modalObra}
          onClose={() => setModalObraId(null)}
          onSave={async (data) => { await salvar(data); if (modalObraId === "nova") setModalObraId(null); }}
          onAvancar={async (id: string, novaEtapa: EtapaObra) => {
            const obraObj = obras.find((o) => o.id === id);
            if (obraObj) await avancarEtapa(obraObj, novaEtapa);
          }}
          onSalvarMedicao={async (obraId, data) => { await salvarMedicao(obraId, data); }}
          onRemoverMedicao={removerMedicao}
        />
      )}
    </div>
  );
}
