"use client";
import { useMemo, useState } from "react";
import StatusBadgeMedicao from "@/components/shared/StatusBadgeMedicao";
import { STATUS_MEDICAO_COR, STATUS_MEDICAO_LABEL } from "@/constants/dominios";
import { fmtBRL } from "@/lib/utils";
import type { Obra, Medicao, StatusMedicao } from "@/types/app.types";

interface Props {
  obras: Obra[];
  onEditMedicao: (obra: Obra, medicao: Medicao) => void;
}

const ORDEM_STATUS: StatusMedicao[] = ["a_solicitar", "solicitada", "laudo_emitido", "paga"];

function fmtDH(iso: string | undefined | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AbaMedicoes({ obras, onEditMedicao }: Props) {
  const [filtroStatus, setFiltroStatus] = useState<StatusMedicao | null>(null);

  const todas = useMemo(() => {
    return obras
      .flatMap((o) => (o.medicoes ?? []).map((m) => ({ ...m, obra: o })))
      .sort((a, b) => ORDEM_STATUS.indexOf(a.status) - ORDEM_STATUS.indexOf(b.status));
  }, [obras]);

  const filtradas = filtroStatus
    ? todas.filter((m) => m.status === filtroStatus)
    : todas;

  const totalPago = todas.filter((m) => m.status === "paga").reduce((s, m) => s + (Number(m.valor_liberado) || 0), 0);

  const kpis: { status: StatusMedicao; label: string; cor: string; topCor: string }[] = [
    { status: "a_solicitar",  label: "A Solicitar",   cor: STATUS_MEDICAO_COR.a_solicitar,  topCor: "border-t-slate-400" },
    { status: "solicitada",   label: "Solicitado",    cor: STATUS_MEDICAO_COR.solicitada,   topCor: "border-t-blue-500" },
    { status: "laudo_emitido",label: "Laudo Emitido", cor: STATUS_MEDICAO_COR.laudo_emitido,topCor: "border-t-orange-500" },
    { status: "paga",         label: "Pagas",         cor: STATUS_MEDICAO_COR.paga,         topCor: "border-t-emerald-500" },
  ];

  return (
    <div>
      {/* KPI cards — clicáveis como funil */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {kpis.map((k) => {
          const count = todas.filter((m) => m.status === k.status).length;
          const ativo = filtroStatus === k.status;
          return (
            <button
              key={k.status}
              type="button"
              onClick={() => setFiltroStatus(ativo ? null : k.status)}
              className={`card p-4 border-t-[3px] ${k.topCor} text-left transition-all cursor-pointer ${
                ativo ? "ring-2 shadow-md" : "hover:shadow-card-hover"
              }`}
              style={ativo ? { outline: `2px solid ${k.cor}`, outlineOffset: "2px" } : {}}
              title={ativo ? "Clique para remover filtro" : `Filtrar por ${k.label}`}
            >
              <p className="section-title mb-1.5 text-[11px]">{k.label}</p>
              <p className="text-[22px] font-extrabold text-slate-900">{count}</p>
              {ativo && (
                <p className="text-[10px] font-bold mt-1" style={{ color: k.cor }}>
                  Filtrado ✕
                </p>
              )}
            </button>
          );
        })}

        {/* Total Liberado */}
        <div className="card p-4 border-t-[3px] border-t-purple-500">
          <p className="section-title mb-1.5 text-[11px]">Total Liberado</p>
          <p className="text-[18px] font-extrabold text-slate-900">{fmtBRL(totalPago)}</p>
        </div>
      </div>

      {/* Indicador de filtro ativo */}
      {filtroStatus && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] text-slate-500">Mostrando apenas:</span>
          <span
            className="text-[12px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: STATUS_MEDICAO_COR[filtroStatus] + "22", color: STATUS_MEDICAO_COR[filtroStatus] }}
          >
            {STATUS_MEDICAO_LABEL[filtroStatus]} ({filtradas.length})
          </span>
          <button
            onClick={() => setFiltroStatus(null)}
            className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Obra / Cliente", "Descrição", "% Solicitada", "% Liberada", "Última Atualização", "Valor Pago", "Status", ""].map((h) => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[11px] font-bold text-slate-500 tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((m, i) => (
                <tr
                  key={`${m.obra.id}_${m.id ?? i}`}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}
                >
                  <td className="px-3.5 py-2.5">
                    <p className="font-semibold text-slate-900">{m.obra.cliente ?? m.obra.nome}</p>
                    <p className="text-[11px] text-slate-400">{m.obra.cidade}</p>
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-700 max-w-[180px] truncate">
                    {m.nome || `Medição ${i + 1}`}
                  </td>
                  <td className="px-3.5 py-2.5 font-bold text-slate-700">
                    {m.pct_solicitada != null ? `${m.pct_solicitada}%` : "—"}
                  </td>
                  <td className="px-3.5 py-2.5 font-bold text-emerald-600">
                    {m.pct_liberada != null ? `${m.pct_liberada}%` : "—"}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <p className="text-slate-600 text-[12px]">{fmtDH(m.updated_at)}</p>
                    {m.historico && m.historico.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {m.historico.length} alteraç{m.historico.length === 1 ? "ão" : "ões"}
                      </p>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 font-bold text-emerald-600">
                    {m.status === "paga" && m.valor_liberado != null ? fmtBRL(m.valor_liberado) : "—"}
                  </td>
                  <td className="px-3.5 py-2.5"><StatusBadgeMedicao status={m.status} /></td>
                  <td className="px-3.5 py-2.5">
                    <button
                      onClick={() => onEditMedicao(m.obra, m)}
                      className="bg-blue-50 hover:bg-blue-100 border-none rounded-md px-2.5 py-1 text-[11px] font-semibold text-blue-500 cursor-pointer transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-[13px]">
              {filtroStatus
                ? `Nenhuma medição com status "${STATUS_MEDICAO_LABEL[filtroStatus]}".`
                : "Nenhuma medição cadastrada."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
