"use client";
import { memo } from "react";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { ETAPAS_OBRA } from "@/constants/etapas";
import { fmtBRL } from "@/lib/utils";
import type { Obra } from "@/types/app.types";

interface Props {
  obra: Obra;
  onClick: (obra: Obra) => void;
}

const CardObra = memo(function CardObra({ obra, onClick }: Props) {
  const etapa = ETAPAS_OBRA.find((e) => e.id === obra.etapa);
  const medTotal   = obra.medicoes?.length ?? 0;
  const medPagos   = obra.medicoes?.filter((m) => m.status === "pago").length ?? 0;
  const pctMed     = medTotal > 0 ? Math.round((medPagos / medTotal) * 100) : 0;
  const atrasada   = obra.prazo_conclusao && obra.etapa !== "entregue" && new Date(obra.prazo_conclusao) < new Date();

  return (
    <div
      onClick={() => onClick(obra)}
      className={`card p-4 mb-2.5 cursor-pointer border-l-[3px] hover:shadow-card-hover transition-shadow ${atrasada ? "border-l-red-400" : ""}`}
      style={!atrasada && etapa ? { borderLeftColor: etapa.cor } : undefined}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-[14px] font-bold text-slate-900">{obra.cliente}</p>
          <p className="text-[11px] text-slate-400">📍 {obra.cidade}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {etapa && <Badge color={etapa.cor}>{etapa.label}</Badge>}
          {atrasada && <Badge color="#EF4444">Atrasada</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-[12px] mb-2.5">
        <div>
          <span className="text-slate-400">Valor Venda</span>
          <p className="font-bold text-emerald-600">{fmtBRL(obra.valor_venda)}</p>
        </div>
        <div>
          <span className="text-slate-400">Medições</span>
          <p className="font-semibold text-slate-700">{medPagos}/{medTotal} pagas</p>
        </div>
      </div>
      {medTotal > 0 && (
        <ProgressBar value={pctMed} color={etapa?.cor ?? "#3B82F6"} height={4} />
      )}
      {obra.engenheiro && (
        <p className="text-[10px] text-slate-400 mt-2">🔧 {obra.engenheiro}</p>
      )}
    </div>
  );
});

export default CardObra;
