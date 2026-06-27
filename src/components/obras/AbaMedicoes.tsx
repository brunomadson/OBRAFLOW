"use client";
import { useMemo } from "react";
import StatusBadgeMedicao from "@/components/shared/StatusBadgeMedicao";
import { fmtBRL, fmtDate } from "@/lib/utils";
import type { Obra, Medicao } from "@/types/app.types";

interface Props {
  obras: Obra[];
  onEditMedicao: (obra: Obra, medicao: Medicao) => void;
}

export default function AbaMedicoes({ obras, onEditMedicao }: Props) {
  const todas = useMemo(() => {
    return obras.flatMap((o) =>
      (o.medicoes ?? []).map((m) => ({ ...m, obra: o }))
    ).sort((a, b) => {
      const sa = a.status === "pendente" ? 0 : a.status === "enviada" ? 1 : 2;
      const sb = b.status === "pendente" ? 0 : b.status === "enviada" ? 1 : 2;
      return sa - sb;
    });
  }, [obras]);

  const pendentes = todas.filter((m) => m.status === "pendente").length;
  const enviadas  = todas.filter((m) => m.status === "enviada").length;
  const pagas     = todas.filter((m) => m.status === "pago").length;
  const totalPago = todas.filter((m) => m.status === "pago").reduce((s, m) => s + (Number(m.valor) || 0), 0);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        {[
          { label: "Pendentes",   valor: pendentes, cor: "border-t-amber-400" },
          { label: "Enviadas",    valor: enviadas,  cor: "border-t-blue-500" },
          { label: "Pagas",       valor: pagas,     cor: "border-t-emerald-500" },
          { label: "Total Pago",  valor: fmtBRL(totalPago), cor: "border-t-purple-500" },
        ].map((k) => (
          <div key={k.label} className={`card p-4 border-t-[3px] ${k.cor}`}>
            <p className="section-title mb-1.5">{k.label}</p>
            <p className="text-[22px] font-extrabold text-slate-900">{k.valor}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Obra / Cliente", "Medição", "Valor", "Vencimento", "Status", ""].map((h) => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[11px] font-bold text-slate-500 tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todas.map((m, i) => (
                <tr
                  key={`${m.obra.id}_${m.id ?? i}`}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}
                >
                  <td className="px-3.5 py-2.5">
                    <p className="font-semibold text-slate-900">{m.obra.cliente}</p>
                    <p className="text-[11px] text-slate-400">{m.obra.cidade}</p>
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600">{m.numero_medicao}ª medição</td>
                  <td className="px-3.5 py-2.5 font-bold text-emerald-600">{fmtBRL(m.valor)}</td>
                  <td className="px-3.5 py-2.5 text-slate-500">{fmtDate(m.data_vencimento)}</td>
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
          {todas.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-[13px]">Nenhuma medição cadastrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}
