"use client";
import { useMemo, useState } from "react";
import CardObra from "./CardObra";
import { ETAPAS_OBRA } from "@/constants/etapas";
import type { Obra } from "@/types/app.types";

interface Props {
  obras: Obra[];
  busca: string;
  onEdit: (obra: Obra) => void;
}

export default function AbaObras({ obras, busca, onEdit }: Props) {
  const [etapaFiltro, setEtapaFiltro] = useState<string>("todas");

  const filtradas = useMemo(() => {
    return obras.filter((o) => {
      const matchBusca = o.cliente.toLowerCase().includes(busca.toLowerCase()) ||
        (o.cidade ?? "").toLowerCase().includes(busca.toLowerCase());
      const matchEtapa = etapaFiltro === "todas" || o.etapa === etapaFiltro;
      return matchBusca && matchEtapa;
    });
  }, [obras, busca, etapaFiltro]);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setEtapaFiltro("todas")}
          className={`border-[1.5px] rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition-colors ${
            etapaFiltro === "todas" ? "border-blue-500 bg-blue-50 text-blue-500" : "border-slate-200 text-slate-500 hover:border-slate-300"
          }`}
        >
          Todas ({obras.length})
        </button>
        {ETAPAS_OBRA.map((e) => {
          const c = obras.filter((o) => o.etapa === e.id).length;
          return (
            <button
              key={e.id}
              onClick={() => setEtapaFiltro(e.id)}
              className={`border-[1.5px] rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition-colors ${
                etapaFiltro === e.id ? "border-blue-500 bg-blue-50 text-blue-500" : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {e.label} ({c})
            </button>
          );
        })}
      </div>
      {filtradas.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-3xl mb-3">🏗</p>
          <p className="font-semibold">Nenhuma obra encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtradas.map((o) => (
            <CardObra key={o.id} obra={o} onClick={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
