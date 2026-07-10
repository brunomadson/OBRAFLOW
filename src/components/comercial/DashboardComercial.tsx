"use client";
import { useState, useMemo } from "react";
import { ETAPAS_LEAD } from "@/constants/etapas";
import { fmtBRL } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import type { Lead } from "@/types/app.types";

interface Props {
  leads: Lead[];
  onEdit?: (lead: Lead) => void;
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

/* ─── Identifica o gerador (corretor/indicação) de um lead, se houver ────────
   Ignora canais de marketing (Instagram, Tráfego pago, Captação ativa etc.) */
function geradorDoLead(l: Lead): { nome: string; tipo: "Corretor" | "Indicação" } | null {
  if (l.origem === "Corretor")   return { nome: l.corretor?.trim() || "Corretor sem nome", tipo: "Corretor" };
  if (l.origem === "Indicação")  return { nome: l.indicado_por?.trim() || "Indicação sem nome", tipo: "Indicação" };
  return null;
}

interface FiltroGerador { tipo: "Corretor" | "Indicação"; nome: string; apenasAprovados: boolean }

/* ─── Modal: leads de um corretor/indicador específico ──────────────────────
   Mesmo padrão do "A Vencer / Vencidos" do Financeiro: clicar num indicador
   abre um relatório filtrado, com atalho para abrir o lead completo. */
function ModalRelatorioGerador({ filtro, leads, onClose, onEdit }: {
  filtro: FiltroGerador;
  leads: Lead[];
  onClose: () => void;
  onEdit?: (lead: Lead) => void;
}) {
  const filtrados = leads.filter((l) => {
    const g = geradorDoLead(l);
    if (!g || g.tipo !== filtro.tipo || g.nome !== filtro.nome) return false;
    return !filtro.apenasAprovados || l.etapa === "aprovada";
  });
  const valorTotal = filtrados.reduce((s, l) => s + (Number(l.valor_venda) || 0), 0);

  return (
    <Modal onClose={onClose} size="lg" zIndex={1100}>
      <ModalHeader
        title={filtro.nome}
        label={filtro.tipo}
        labelColor={filtro.tipo === "Corretor" ? "#3B82F6" : "#F59E0B"}
        subtitle={filtro.apenasAprovados ? "Contratos aprovados no período" : "Todos os leads no período"}
        onClose={onClose}
      />
      <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
        {filtrados.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">Nenhum lead encontrado</p>
        )}
        {filtrados.map((l, i) => {
          const etapa = ETAPAS_LEAD.find((e) => e.id === l.etapa);
          return (
            <button
              key={l.id}
              onClick={() => { onEdit?.(l); onClose(); }}
              className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors hover:border-blue-300 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 truncate">{l.nome}</p>
                <p className="text-[11px] text-slate-400">{l.cidade || "—"}</p>
              </div>
              {etapa && <Badge color={etapa.cor}>{etapa.label}</Badge>}
              <div className="ml-2 text-right flex-shrink-0 w-24">
                <p className="text-[13px] font-bold text-slate-700">{fmtBRL(l.valor_venda)}</p>
              </div>
            </button>
          );
        })}
        {filtrados.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[13px] font-bold text-slate-700">
            <span>{filtrados.length} lead{filtrados.length !== 1 ? "s" : ""}</span>
            <span>{fmtBRL(valorTotal)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── Geradores de Negócio: Corretores parceiros & Indicações pessoais ──────
   Mede quem traz oportunidades de verdade (parceiros e pessoas), não canal
   de marketing — por isso ignora Instagram/Tráfego pago/Captação ativa/etc. */
function GeradoresNegocio({ leads, onEdit }: { leads: Lead[]; onEdit?: (lead: Lead) => void }) {
  const [filtro, setFiltro] = useState<FiltroGerador | null>(null);

  const geradores = useMemo(() => {
    const map: Record<string, { nome: string; tipo: "Corretor" | "Indicação"; leads: number; aprovados: number }> = {};

    leads.forEach((l) => {
      const g = geradorDoLead(l);
      if (!g) return; // ignora canais de marketing (Instagram, Tráfego pago, etc.)

      const key = `${g.tipo}:${g.nome}`;
      if (!map[key]) map[key] = { nome: g.nome, tipo: g.tipo, leads: 0, aprovados: 0 };
      map[key].leads += 1;
      if (l.etapa === "aprovada") map[key].aprovados += 1;
    });

    return Object.values(map).sort((a, b) => b.leads - a.leads);
  }, [leads]);

  const totalLeads = geradores.reduce((s, g) => s + g.leads, 0);

  // Recorte só de quem já converteu em contrato — subconjunto do geral.
  const CORES_APROVADOS = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#06B6D4"];
  const aprovadosGeradores = geradores
    .filter((g) => g.aprovados > 0)
    .sort((a, b) => b.aprovados - a.aprovados);
  const totalAprovados = aprovadosGeradores.reduce((s, g) => s + g.aprovados, 0);

  const R = 46, cx = 60, cy = 60;
  let startAngle = -Math.PI / 2;
  const fatias = aprovadosGeradores.map((g, i) => {
    const frac = g.aprovados / totalAprovados;
    // Clamp abaixo de 360°: uma fatia sozinha em 100% faz o arco terminar
    // onde começou e o SVG não desenha nada (mesmo bug do gráfico de vencimentos).
    const angle = Math.min(frac * 2 * Math.PI, 2 * Math.PI - 0.001);
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    startAngle += angle;
    const x2 = cx + R * Math.cos(startAngle);
    const y2 = cy + R * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...g, frac, path, cor: CORES_APROVADOS[i % CORES_APROVADOS.length] };
  });

  return (
    <div className="grid grid-cols-2 gap-3.5 mb-5">
      {/* Geral: toda oportunidade trazida, independente da etapa atual */}
      <div className="card p-5">
        <p className="text-[13px] font-bold text-slate-900 mb-1">Geradores de Negócio — Geral</p>
        <p className="text-[11px] text-slate-400 mb-4">Toda oportunidade trazida por corretores e indicações, em qualquer etapa do funil.</p>

        {geradores.length === 0 ? (
          <p className="text-slate-400 text-xs">Nenhum lead de corretor ou indicação neste período.</p>
        ) : (
          <div className="space-y-3">
            {geradores.map((g, i) => (
              <button
                key={`${g.tipo}:${g.nome}`}
                onClick={() => setFiltro({ tipo: g.tipo, nome: g.nome, apenasAprovados: false })}
                className="w-full flex items-center gap-3 bg-transparent border-none p-0 cursor-pointer text-left group"
              >
                <span className="text-[11px] font-bold text-slate-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{g.nome}</span>
                      <Badge color={g.tipo === "Corretor" ? "#3B82F6" : "#F59E0B"}>{g.tipo}</Badge>
                    </div>
                    <span className="text-xs font-bold text-slate-700 flex-shrink-0">{g.leads}</span>
                  </div>
                  <div className="bg-slate-100 rounded h-1.5">
                    <div
                      className="h-1.5 rounded transition-all duration-500"
                      style={{ background: g.tipo === "Corretor" ? "#3B82F6" : "#F59E0B", width: `${totalLeads > 0 ? (g.leads / totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
            <p className="text-[10px] text-slate-400 pt-1">{totalLeads} lead{totalLeads !== 1 ? "s" : ""} via corretor/indicação no período. Clique num nome para ver os leads dele.</p>
          </div>
        )}
      </div>

      {/* Contratos fechados: só quem já converteu */}
      <div className="card p-5">
        <p className="text-[13px] font-bold text-slate-900 mb-1">Contratos Fechados</p>
        <p className="text-[11px] text-slate-400 mb-4">Apenas propostas aprovadas — quem realmente converteu em contrato.</p>

        {aprovadosGeradores.length === 0 ? (
          <p className="text-slate-400 text-xs">Nenhum contrato aprovado ainda neste período.</p>
        ) : (
          <div className="flex items-center gap-6">
            <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
              {fatias.map((s, i) => (
                <path
                  key={i}
                  d={s.path}
                  fill={s.cor}
                  stroke="#fff"
                  strokeWidth="2"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setFiltro({ tipo: s.tipo, nome: s.nome, apenasAprovados: true })}
                >
                  <title>{s.nome}: {s.aprovados}</title>
                </path>
              ))}
              <circle cx={cx} cy={cy} r={R * 0.55} fill="#fff" />
              <text x={cx} y={cy - 3} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0F172A">{totalAprovados}</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="#94A3B8">contrato{totalAprovados !== 1 ? "s" : ""}</text>
            </svg>
            <div className="flex-1 space-y-1.5 min-w-0">
              {fatias.map((s) => (
                <button
                  key={`${s.tipo}:${s.nome}`}
                  onClick={() => setFiltro({ tipo: s.tipo, nome: s.nome, apenasAprovados: true })}
                  className="w-full flex items-center justify-between gap-2 bg-transparent border-none p-0 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.cor }} />
                    <span className="text-[11px] text-slate-700 truncate group-hover:text-blue-600 transition-colors">{s.nome}</span>
                  </div>
                  <span className="text-[11px] font-bold flex-shrink-0" style={{ color: s.cor }}>{s.aprovados}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filtro && (
        <ModalRelatorioGerador filtro={filtro} leads={leads} onClose={() => setFiltro(null)} onEdit={onEdit} />
      )}
    </div>
  );
}

export default function DashboardComercial({ leads, onEdit }: Props) {
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

      {/* Geradores de Negócio: Corretores parceiros & Indicações pessoais */}
      <GeradoresNegocio leads={noperiodo} onEdit={onEdit} />

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
