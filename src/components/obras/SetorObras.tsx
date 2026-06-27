"use client";
import { useState, useMemo } from "react";
import { useObras } from "@/hooks/useObras";
import DashboardObras from "./DashboardObras";
import AbaObras from "./AbaObras";
import AbaMedicoes from "./AbaMedicoes";
import ModalObra from "./ModalObra";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { Obra, Medicao } from "@/types/app.types";

type Aba = "dashboard" | "obras" | "medicoes";

export default function SetorObras() {
  const { obras, loading, salvar, avancarEtapa, salvarMedicao, removerMedicao } = useObras();
  const [aba, setAba]           = useState<Aba>("dashboard");
  const [busca, setBusca]       = useState("");
  const [modalObra, setModalObra] = useState<Obra | "nova" | null>(null);
  const [editMedObj, setEditMedObj] = useState<{ obra: Obra; medicao: Medicao } | null>(null);

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
          <button onClick={() => setModalObra("nova")} className="btn-primary text-xs px-3 py-1.5">
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
              <AbaObras obras={obras} busca={busca} onEdit={setModalObra} />
            )}
            {aba === "medicoes" && (
              <AbaMedicoes
                obras={obras}
                onEditMedicao={(obra, medicao) => setEditMedObj({ obra, medicao })}
              />
            )}
          </>
        )}
      </div>

      {modalObra !== null && (
        <ModalObra
          obra={modalObra === "nova" ? null : modalObra}
          onClose={() => setModalObra(null)}
          onSave={async (data) => { await salvar(data); setModalObra(null); }}
          onAvancar={avancarEtapa}
          onSalvarMedicao={salvarMedicao}
          onRemoverMedicao={removerMedicao}
        />
      )}

      {editMedObj && (
        <ModalObra
          obra={editMedObj.obra}
          onClose={() => setEditMedObj(null)}
          onSave={salvar}
          onAvancar={avancarEtapa}
          onSalvarMedicao={salvarMedicao}
          onRemoverMedicao={removerMedicao}
        />
      )}
    </div>
  );
}
