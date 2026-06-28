"use client";
import { memo } from "react";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { ETAPAS_OBRA, FLUXO_OBRA } from "@/constants/etapas";
import { fmtBRL, fmtDate } from "@/lib/utils";
import type { Obra } from "@/types/app.types";

interface Props {
  obra: Obra;
  onClick: (obra: Obra) => void;
}

// Progresso por posição da etapa no fluxo
const ETAPA_PCT: Record<string, number> = {
  projeto:       14,
  licencas:      28,
  eng_caixa:     43,
  conformidade:  57,
  contrato:      71,
  execucao:      86,
  entregue:      100,
};

const ETAPAS_POS_CONTRATO = new Set(["contrato", "execucao", "entregue"]);

const COM_MURO_LABEL: Record<string, string> = {
  sem_muro:    "Sem muro",
  com_muro:    "Com muro",
  muro_parcial:"Muro parcial",
};

const CardObra = memo(function CardObra({ obra, onClick }: Props) {
  const etapa      = ETAPAS_OBRA.find((e) => e.id === obra.etapa);
  const progresso  = ETAPA_PCT[obra.etapa] ?? 0;
  const atrasada   = obra.prazo_conclusao && obra.etapa !== "entregue" && new Date(obra.prazo_conclusao) < new Date();
  const showDatas  = ETAPAS_POS_CONTRATO.has(obra.etapa);

  const medTotal = obra.medicoes?.length ?? 0;
  const medPagas = obra.medicoes?.filter((m) => m.status === "paga").length ?? 0;

  return (
    <div
      onClick={() => onClick(obra)}
      className={`card p-4 cursor-pointer border-l-[3px] hover:shadow-card-hover transition-shadow space-y-2.5`}
      style={{ borderLeftColor: atrasada ? "#EF4444" : (etapa?.cor ?? "#94A3B8") }}
    >
      {/* Cabeçalho */}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">{obra.cliente}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">📍 {obra.cidade ?? "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {etapa && <Badge color={etapa.cor}>{etapa.label}</Badge>}
          {atrasada && <Badge color="#EF4444">Atrasada</Badge>}
        </div>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-x-3 text-[11px]">
        <div>
          <span className="text-slate-400">Valor Venda</span>
          <p className="font-bold text-emerald-600">{fmtBRL(obra.valor_venda)}</p>
        </div>
        <div>
          <span className="text-slate-400">Medições</span>
          <p className="font-semibold text-slate-700">{medPagas}/{medTotal} pagas</p>
        </div>
      </div>

      {/* Tamanho + Muro (quando preenchidos) */}
      {(obra.tamanho_imovel || obra.com_muro) && (
        <div className="flex gap-2 flex-wrap">
          {obra.tamanho_imovel && (
            <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
              📐 {obra.tamanho_imovel}
            </span>
          )}
          {obra.com_muro && (
            <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
              🧱 {COM_MURO_LABEL[obra.com_muro] ?? obra.com_muro}
            </span>
          )}
        </div>
      )}

      {/* Data Assinatura + Previsão Término — só a partir de Contrato */}
      {showDatas && (
        <div className="grid grid-cols-2 gap-x-3 text-[11px] border-t border-slate-50 pt-2">
          <div>
            <span className="text-slate-400">Assinatura</span>
            <p className="font-semibold text-slate-700">{fmtDate(obra.data_inicio) || "—"}</p>
          </div>
          <div>
            <span className="text-slate-400">Previsão Término</span>
            <p className={`font-semibold ${atrasada ? "text-red-500" : "text-slate-700"}`}>
              {fmtDate(obra.prazo_conclusao) || "—"}
            </p>
          </div>
        </div>
      )}

      {/* Barra de progresso por etapa */}
      <ProgressBar value={progresso} color={atrasada ? "#EF4444" : (etapa?.cor ?? "#3B82F6")} height={5} />

      {/* Engenheiro */}
      {obra.engenheiro && (
        <p className="text-[10px] text-slate-400">🔧 {obra.engenheiro}</p>
      )}
    </div>
  );
});

export default CardObra;
