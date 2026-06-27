"use client";
import { useState, useMemo } from "react";
import { ETAPAS_LEAD } from "@/constants/etapas";
import { fmtBRL } from "@/lib/utils";
import type { Lead } from "@/types/app.types";

interface Props {
  leads: Lead[];
}

function subDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function KPI({ label, valor, varPct, meta }: { label: string; valor: string | number; varPct: number | null; meta?: number | null }) {
  const corVar = (n: number) => n >= 0 ? "text-emerald-600" : "text-red-500";
  const bgVar  = (n: number) => n >= 0 ? "bg-emerald-50" : "bg-red-50";
  const sinal  = (n: number) => (n >= 0 ? "+" : "") + n + "%";
  return (
    <div className="card p-5 border-t-[3px] border-t-blue-500">
      <p className="section-title mb-2">{label}</p>
      <p className="text-[28px] font-extrabold text-slate-900 mb-2.5 leading-none">{valor}</p>
      <div className="flex gap-2 flex-wrap">
        {varPct !== null && (
          <span className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 ${bgVar(varPct)} ${corVar(varPct)}`}>
            {sinal(varPct)} vs ant.
          </span>
        )}
        {meta !== null && meta !== undefined && (
          <span className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 ${bgVar(meta)} ${corVar(meta)}`}>
            {sinal(meta)} vs meta
          </span>
        )}
      </div>
    </div>
  );
}

const PERIODOS: [string, string][] = [["7","7D"],["30","30D"],["90","90D"],["180","180D"],["365","360D"]];

/* ─── Gráfico Pizza: Leads por Corretor ─────────────────────────────────── */
const PIZZA_CORES = ["#3B82F6","#10B981","#F59E0B","#8B5CF6","#F97316","#EF4444","#06B6D4","#6366F1"];

function PizzaCorretores({ leads }: { leads: Lead[] }) {
  const dados = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.origem === "Corretor" && l.corretor) {
        map[l.corretor] = (map[l.corretor] || 0) + 1;
      } else if (l.origem !== "Corretor") {
        map[l.origem] = (map[l.origem] || 0) + 1;
      } else {
        map["Corretor s/ nome"] = (map["Corretor s/ nome"] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const total = dados.reduce((s, [, c]) => s + c, 0);

  if (total === 0) return null;

  // Calcular fatias SVG
  const R = 60; // raio
  const cx = 80; const cy = 80;
  let startAngle = -Math.PI / 2;
  const slices = dados.map(([label, count], i) => {
    const frac  = count / total;
    const angle = frac * 2 * Math.PI;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    startAngle += angle;
    const x2 = cx + R * Math.cos(startAngle);
    const y2 = cy + R * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = frac === 1
      ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
    return { label, count, frac, path, cor: PIZZA_CORES[i % PIZZA_CORES.length] };
  });

  return (
    <div className="card p-5 mb-5">
      <p className="text-[13px] font-bold text-slate-900 mb-4">Leads por Origem / Corretor</p>
      <div className="flex items-center gap-8">
        {/* SVG donut */}
        <svg width="160" height="160" viewBox="0 0 160 160" className="flex-shrink-0">
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.cor} stroke="#fff" strokeWidth="2">
              <title>{s.label}: {s.count}</title>
            </path>
          ))}
          {/* buraco central */}
          <circle cx={cx} cy={cy} r={R * 0.52} fill="#fff" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill="#0F172A">{total}</text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#94A3B8">leads</text>
        </svg>
        {/* Legenda */}
        <div className="flex-1 space-y-2">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.cor }} />
                <span className="text-xs text-slate-700 truncate">{s.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-20 bg-slate-100 rounded h-1.5">
                  <div className="h-1.5 rounded" style={{ background: s.cor, width: `${s.frac * 100}%` }} />
                </div>
                <span className="text-xs font-bold w-5 text-right" style={{ color: s.cor }}>{s.count}</span>
                <span className="text-[10px] text-slate-400 w-8 text-right">{Math.round(s.frac * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardComercial({ leads }: Props) {
  const [periodo, setPeriodo] = useState("30");
  const dias = Number(periodo);

  const pct = (a: number, b: number): number | null => b === 0 ? null : Math.round(((a - b) / b) * 100);

  const { noperiodo, noprev, origens, meses } = useMemo(() => {
    const corte = subDias(dias);
    const cortePrev = subDias(dias * 2);
    const parseData = (s: string | null) => {
      if (!s) return null;
      if (s.includes("/")) { const [d, m, a] = s.split("/"); return new Date(`${a}-${m}-${d}`); }
      return new Date(s);
    };

    const np = leads.filter((l) => { const d = parseData(l.data_contato); return d && d >= corte; });
    const prev = leads.filter((l) => { const d = parseData(l.data_contato); return d && d >= cortePrev && d < corte; });

    const origemCount: Record<string, number> = {};
    np.forEach((l) => { origemCount[l.origem] = (origemCount[l.origem] || 0) + 1; });

    const m: { label: string; count: number; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const inicio = new Date(); inicio.setMonth(inicio.getMonth() - i); inicio.setDate(1);
      const fim = new Date(); fim.setMonth(fim.getMonth() - i + 1); fim.setDate(0);
      const c = leads.filter((l) => { const d = parseData(l.data_contato); return d && d >= inicio && d <= fim; });
      m.push({
        label: inicio.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        count: c.length,
        valor: c.reduce((s, l) => s + (Number(l.valor_venda) || 0), 0),
      });
    }

    return {
      noperiodo: np,
      noprev: prev,
      origens: Object.entries(origemCount).sort((a, b) => b[1] - a[1]),
      meses: m,
    };
  }, [leads, dias]);

  const totalLeads = noperiodo.length;
  const prevLeads  = noprev.length;
  const aprovados  = noperiodo.filter((l) => l.etapa === "aprovada").length;
  const prevAprov  = noprev.filter((l) => l.etapa === "aprovada").length;
  const valPot     = noperiodo.reduce((s, l) => s + (Number(l.valor_venda) || 0), 0);
  const prevVal    = noprev.reduce((s, l) => s + (Number(l.valor_venda) || 0), 0);
  const taxaConv   = totalLeads > 0 ? Math.round((aprovados / totalLeads) * 100) : 0;
  const prevTaxa   = noprev.length > 0 ? Math.round((prevAprov / noprev.length) * 100) : 0;
  const maxCount   = Math.max(...meses.map((m) => m.count), 1);
  const maxValor   = Math.max(...meses.map((m) => m.valor), 1);
  const CORES_ORIGEM = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#F97316"];

  return (
    <div>
      {/* Seletor de período */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs font-semibold text-slate-500">Período:</span>
        {PERIODOS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setPeriodo(v)}
            className={`border-[1.5px] rounded-lg px-3.5 py-1 text-xs font-bold cursor-pointer transition-colors ${
              periodo === v
                ? "border-blue-500 bg-blue-50 text-blue-500"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <KPI label="Oportunidades"     valor={totalLeads}          varPct={pct(totalLeads, prevLeads)}  meta={pct(totalLeads, Math.ceil(prevLeads * 1.3) || 10)} />
        <KPI label="Valor Potencial"   valor={fmtBRL(valPot)}      varPct={pct(valPot, prevVal)}        meta={pct(valPot, Math.ceil(prevVal * 1.3) || 500000)} />
        <KPI label="Ticket Médio"      valor={fmtBRL(totalLeads > 0 ? Math.round(valPot / totalLeads) : 0)} varPct={pct(totalLeads > 0 ? valPot / totalLeads : 0, prevLeads > 0 ? prevVal / prevLeads : 0)} />
        <KPI label="Taxa de Conversão" valor={`${taxaConv}%`}      varPct={pct(taxaConv, prevTaxa)}     meta={pct(taxaConv, 15)} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-4">Oportunidades por mês</p>
          <div className="flex items-end gap-2 h-24">
            {meses.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-blue-500">{m.count || ""}</span>
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${Math.max((m.count / maxCount) * 80, m.count > 0 ? 4 : 0)}px` }}
                />
                <span className="text-[9px] text-slate-400 text-center">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-4">Valor potencial por mês</p>
          <div className="flex items-end gap-2 h-24">
            {meses.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-emerald-500">{m.valor > 0 ? `${Math.round(m.valor / 1000)}k` : ""}</span>
                <div
                  className="w-full bg-emerald-500 rounded-t"
                  style={{ height: `${Math.max((m.valor / maxValor) * 80, m.valor > 0 ? 4 : 0)}px` }}
                />
                <span className="text-[9px] text-slate-400 text-center">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-3.5">Origem dos Leads</p>
          {origens.length === 0 ? (
            <p className="text-slate-400 text-xs">Sem dados no período.</p>
          ) : (
            origens.map(([o, c], i) => (
              <div key={o} className="mb-2.5">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-700">{o}</span>
                  <span className="text-xs font-bold" style={{ color: CORES_ORIGEM[i % 5] }}>{c}</span>
                </div>
                <div className="bg-slate-100 rounded h-1.5">
                  <div
                    className="h-1.5 rounded transition-all duration-500"
                    style={{ background: CORES_ORIGEM[i % 5], width: `${Math.round((c / totalLeads) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-3.5">Funil por Etapa</p>
          {ETAPAS_LEAD.map((e) => {
            const c = noperiodo.filter((l) => l.etapa === e.id).length;
            return (
              <div key={e.id} className="mb-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-700">{e.label}</span>
                  <span className="text-xs font-bold" style={{ color: e.cor }}>{c}</span>
                </div>
                <div className="bg-slate-100 rounded h-1.5">
                  <div
                    className="h-1.5 rounded"
                    style={{ background: e.cor, width: `${totalLeads > 0 ? Math.round((c / totalLeads) * 100) : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pizza: Leads por Corretor */}
      <PizzaCorretores leads={noperiodo} />

      {/* Insights */}
      <div className="card p-5">
        <p className="text-[13px] font-bold text-slate-900 mb-3.5">📊 Insights do Período</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { cor: "#10B981", bg: "#F0FDF4", titulo: "✅ O que cresceu",    texto: aprovados > prevAprov ? `Propostas aprovadas subiram de ${prevAprov} para ${aprovados}.` : `${totalLeads} leads no período. Mantenha a cadência.` },
            { cor: "#F97316", bg: "#FFF7ED", titulo: "⚠ O que preocupa",   texto: noperiodo.filter((l) => l.etapa === "analise").length > 2 ? `${noperiodo.filter((l) => l.etapa === "analise").length} leads em análise. Contate a Caixa.` : `Taxa: ${taxaConv}%. Meta: 15%.` },
            { cor: "#3B82F6", bg: "#EFF6FF", titulo: "🎯 Ação recomendada", texto: origens[0] ? `"${origens[0][0]}" é sua principal origem (${origens[0][1]} leads). Invista mais.` : "Cadastre oportunidades para receber insights." },
          ].map((ins) => (
            <div key={ins.titulo} className="rounded-xl p-4 border-l-[3px]" style={{ background: ins.bg, borderLeftColor: ins.cor }}>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: ins.cor }}>{ins.titulo}</p>
              <p className="text-xs text-slate-700 leading-relaxed">{ins.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
