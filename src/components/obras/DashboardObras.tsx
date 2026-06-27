"use client";
import { useMemo } from "react";
import { ETAPAS_OBRA } from "@/constants/etapas";
import { fmtBRL } from "@/lib/utils";
import type { Obra } from "@/types/app.types";

interface Props { obras: Obra[] }

function KPI({ label, valor, sub, cor = "border-t-blue-500" }: { label: string; valor: string | number; sub?: string; cor?: string }) {
  return (
    <div className={`card p-5 border-t-[3px] ${cor}`}>
      <p className="section-title mb-2">{label}</p>
      <p className="text-[26px] font-extrabold text-slate-900 leading-none mb-1">{valor}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

export default function DashboardObras({ obras }: Props) {
  const stats = useMemo(() => {
    const ativas  = obras.filter((o) => o.etapa !== "entregue" && o.etapa !== "cancelada");
    const concl   = obras.filter((o) => o.etapa === "entregue");
    const valTotal = obras.reduce((s, o) => s + (Number(o.valor_venda) || 0), 0);
    const pct     = ativas.length > 0
      ? Math.round(ativas.reduce((s, o) => s + (o.medicoes?.length ? Math.round((o.medicoes.filter(m => m.status === "pago").length / o.medicoes.length) * 100) : 0), 0) / ativas.length)
      : 0;
    const atrasadas = obras.filter((o) => {
      if (!o.prazo_conclusao || o.etapa === "entregue") return false;
      return new Date(o.prazo_conclusao) < new Date();
    });
    return { ativas, concl, valTotal, pct, atrasadas };
  }, [obras]);

  const maxCount = Math.max(...ETAPAS_OBRA.map((e) => obras.filter((o) => o.etapa === e.id).length), 1);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <KPI label="Obras Ativas"       valor={stats.ativas.length}     sub={`${stats.concl.length} concluídas`} cor="border-t-blue-500" />
        <KPI label="Valor Total"         valor={fmtBRL(stats.valTotal)}  sub="carteira total"                     cor="border-t-emerald-500" />
        <KPI label="Evolução Média"      valor={`${stats.pct}%`}         sub="medições pagas"                     cor="border-t-purple-500" />
        <KPI label="Obras Atrasadas"     valor={stats.atrasadas.length}  sub="prazo vencido"                      cor="border-t-red-500" />
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-3.5">Funil por Etapa</p>
          {ETAPAS_OBRA.map((e) => {
            const c = obras.filter((o) => o.etapa === e.id).length;
            return (
              <div key={e.id} className="mb-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-700">{e.label}</span>
                  <span className="text-xs font-bold" style={{ color: e.cor }}>{c}</span>
                </div>
                <div className="bg-slate-100 rounded h-1.5">
                  <div className="h-1.5 rounded" style={{ background: e.cor, width: `${Math.round((c / maxCount) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-3.5">⚠ Obras com Atenção</p>
          {stats.atrasadas.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-slate-500">Nenhuma obra atrasada.</p>
            </div>
          ) : (
            stats.atrasadas.slice(0, 6).map((o) => (
              <div key={o.id} className="flex justify-between py-2 border-b border-slate-50 text-[13px]">
                <span className="font-semibold text-slate-900">{o.cliente}</span>
                <span className="text-red-500 font-bold">
                  {o.prazo_conclusao ? new Date(o.prazo_conclusao).toLocaleDateString("pt-BR") : "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
