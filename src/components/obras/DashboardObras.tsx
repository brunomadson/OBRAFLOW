"use client";
import { useMemo } from "react";
import { ETAPAS_OBRA } from "@/constants/etapas";
import { STATUS_MEDICAO_COR, STATUS_MEDICAO_LABEL } from "@/constants/dominios";
import { fmtBRL, fmtDate } from "@/lib/utils";
import type { Obra, StatusMedicao } from "@/types/app.types";

interface Props { obras: Obra[] }

// ── Metas configuráveis ──────────────────────────────────────────────────────
const META_OBRAS_ATIVAS  = 15;
const META_VALOR_MENSAL  = 500_000;
const META_MED_PAGAS_MES = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────
function isThisMonth(d: string | null | undefined) {
  if (!d) return false;
  const dt = new Date(d), now = new Date();
  return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
}
function isLastMonth(d: string | null | undefined) {
  if (!d) return false;
  const dt = new Date(d), now = new Date();
  const lm = new Date(now.getFullYear(), now.getMonth() - 1);
  return dt.getMonth() === lm.getMonth() && dt.getFullYear() === lm.getFullYear();
}
function pctVar(atual: number, ant: number): { n: number; pos: boolean } | null {
  if (ant === 0) return atual > 0 ? { n: 100, pos: true } : null;
  const n = Math.round(((atual - ant) / ant) * 100);
  return { n, pos: n >= 0 };
}
function pctMeta(atual: number, meta: number) {
  return meta > 0 ? Math.round((atual / meta) * 100) : 0;
}
function diasAgo(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

// ── Pizza donut ───────────────────────────────────────────────────────────────
const STATUS_ORDEM: StatusMedicao[] = ["a_solicitar", "solicitada", "laudo_emitido", "paga"];

function PizzaMedicoes({ medicoes }: { medicoes: { status: StatusMedicao }[] }) {
  const contagem = STATUS_ORDEM.map((s) => ({
    status: s,
    label: STATUS_MEDICAO_LABEL[s],
    cor: STATUS_MEDICAO_COR[s],
    n: medicoes.filter((m) => m.status === s).length,
  }));
  const total = medicoes.length;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[150px] text-slate-300 text-sm">
        Nenhuma medição
      </div>
    );
  }

  const R = 58, r = 36, CX = 75, CY = 75;
  let angle = -Math.PI / 2;
  const arcs = contagem.filter((d) => d.n > 0).map((d) => {
    const sweep = (2 * Math.PI * d.n) / total;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const xi1 = CX + r * Math.cos(angle);
    const yi1 = CY + r * Math.sin(angle);
    angle -= sweep;
    const xi2 = CX + r * Math.cos(angle);
    const yi2 = CY + r * Math.sin(angle);
    angle += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    return {
      ...d,
      path: `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${xi1},${yi1} A${r},${r},0,${large},0,${xi2},${yi2} Z`,
    };
  });

  return (
    <div className="flex items-center gap-3">
      <svg width="150" height="150" viewBox="0 0 150 150" className="flex-shrink-0">
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.cor} />)}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1E293B">{total}</text>
        <text x={CX} y={CY + 11} textAnchor="middle" fontSize="8" fill="#94A3B8" fontWeight="600">MEDIÇÕES</text>
      </svg>
      <div className="space-y-2 flex-1">
        {contagem.map((d) => (
          <div key={d.status} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.cor }} />
              <span className="text-[11px] text-slate-600">{d.label}</span>
            </div>
            <span className="text-[12px] font-bold text-slate-800">{d.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, valor, cor, varPeriodo, varMeta, subMeta, menorMelhor = false,
}: {
  label: string;
  valor: string | number;
  cor: string;
  varPeriodo?: { n: number; pos: boolean } | null;
  varMeta?: number;
  subMeta?: string;
  menorMelhor?: boolean;
}) {
  const periodoPos = varPeriodo ? (menorMelhor ? !varPeriodo.pos : varPeriodo.pos) : true;
  return (
    <div className="card p-5 border-l-[4px] flex flex-col gap-1.5" style={{ borderLeftColor: cor }}>
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[30px] font-extrabold text-slate-900 leading-none">{valor}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {varPeriodo && (
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${periodoPos ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
            {periodoPos ? "▲" : "▼"} {Math.abs(varPeriodo.n)}% vs mês ant.
          </span>
        )}
        {varMeta !== undefined && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${varMeta >= 100 ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
            {varMeta}% da meta {subMeta ? `(${subMeta})` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Barra horizontal ─────────────────────────────────────────────────────────
function BarraH({ label, valor, max, cor, sub }: { label: string; valor: number; max: number; cor: string; sub?: string }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[12px] text-slate-700 font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
          <span className="text-[12px] font-bold" style={{ color: cor }}>{valor}</span>
        </div>
      </div>
      <div className="bg-slate-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ background: cor, width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ titulo, texto, tipo }: { titulo: string; texto: string; tipo: "verde" | "laranja" | "azul" }) {
  const styles = {
    verde:   "bg-emerald-50 border-emerald-200 text-emerald-900",
    laranja: "bg-amber-50 border-amber-200 text-amber-900",
    azul:    "bg-blue-50 border-blue-200 text-blue-900",
  };
  const titleStyles = {
    verde:   "text-emerald-700",
    laranja: "text-amber-700",
    azul:    "text-blue-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${styles[tipo]}`}>
      <p className={`text-[12px] font-extrabold uppercase tracking-wide mb-1.5 ${titleStyles[tipo]}`}>{titulo}</p>
      <p className="text-[12px] leading-relaxed">{texto}</p>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function DashboardObras({ obras }: Props) {
  const stats = useMemo(() => {
    const now = new Date();

    // Obras
    const ativas    = obras.filter((o) => o.etapa !== "entregue");
    const concl     = obras.filter((o) => o.etapa === "entregue");
    const atrasadas = obras.filter((o) => {
      const prazo = o.prazo_conclusao;
      return prazo && o.etapa !== "entregue" && new Date(prazo) < now;
    });

    // Variação obras (criadas este mês vs mês passado)
    const novasMes    = obras.filter((o) => isThisMonth(o.created_at)).length;
    const novasMesAnt = obras.filter((o) => isLastMonth(o.created_at)).length;

    // Medições
    const todasMed = obras.flatMap((o) => (o.medicoes ?? []).map((m) => ({ ...m, obra: o })));
    const medPend  = todasMed.filter((m) => m.status !== "paga").length;
    const medPagas = todasMed.filter((m) => m.status === "paga");

    // Valor liberado
    const valLiberadoTotal = medPagas.reduce((s, m) => s + (Number(m.valor_liberado) || 0), 0);
    const valMes    = medPagas.filter((m) => isThisMonth(m.data_liberacao)).reduce((s, m) => s + (Number(m.valor_liberado) || 0), 0);
    const valMesAnt = medPagas.filter((m) => isLastMonth(m.data_liberacao)).reduce((s, m) => s + (Number(m.valor_liberado) || 0), 0);

    // Medições pagas este mês
    const medPagasMes    = medPagas.filter((m) => isThisMonth(m.data_liberacao)).length;
    const medPagasMesAnt = medPagas.filter((m) => isLastMonth(m.data_liberacao)).length;

    // Tempo médio por etapa (a partir do obra_log)
    const temposPorEtapa: Record<string, number[]> = {};
    obras.forEach((obra) => {
      if (!obra.log || obra.log.length === 0) return;
      const sorted = [...obra.log].sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        const etapa = sorted[i].etapa;
        const dias = Math.round((new Date(sorted[i + 1].criado_em).getTime() - new Date(sorted[i].criado_em).getTime()) / 86_400_000);
        if (!temposPorEtapa[etapa]) temposPorEtapa[etapa] = [];
        temposPorEtapa[etapa].push(dias);
      }
      // Etapa atual (em andamento)
      if (obra.etapa !== "entregue") {
        const ultimo = sorted[sorted.length - 1];
        const diasOngoing = Math.round((Date.now() - new Date(ultimo.criado_em).getTime()) / 86_400_000);
        const etapaAtual = obra.etapa;
        if (!temposPorEtapa[etapaAtual]) temposPorEtapa[etapaAtual] = [];
        temposPorEtapa[etapaAtual].push(diasOngoing);
      }
    });
    const tempoMedioEtapa = Object.entries(temposPorEtapa).map(([etapa, dias]) => ({
      etapa,
      media: Math.round(dias.reduce((a, b) => a + b, 0) / dias.length),
    })).sort((a, b) => b.media - a.media);

    return {
      ativas, concl, atrasadas,
      novasMes, novasMesAnt,
      todasMed, medPend, medPagas,
      valLiberadoTotal, valMes, valMesAnt,
      medPagasMes, medPagasMesAnt,
      tempoMedioEtapa,
    };
  }, [obras]);

  // Variações
  const varObras  = pctVar(stats.novasMes, stats.novasMesAnt);
  const varValor  = pctVar(stats.valMes, stats.valMesAnt);
  const varMedPend= pctVar(stats.medPend, stats.medPend); // estático
  const varAtraso = stats.atrasadas.length;

  // Por etapa
  const maxEtapa = Math.max(...ETAPAS_OBRA.map((e) => obras.filter((o) => o.etapa === e.id).length), 1);

  // Etapa com mais obras
  const etapasComObras = ETAPAS_OBRA.map((e) => ({
    ...e,
    count: obras.filter((o) => o.etapa === e.id).length,
  })).filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
  const etapaGargalo = etapasComObras[0];

  // Insights gerados automaticamente
  const insights = useMemo(() => {
    const list: Array<{ titulo: string; texto: string; tipo: "verde" | "laranja" | "azul" }> = [];

    // 1. O que cresceu
    if (stats.valMes > stats.valMesAnt && stats.valMesAnt > 0) {
      const p = Math.round(((stats.valMes - stats.valMesAnt) / stats.valMesAnt) * 100);
      list.push({
        tipo: "verde", titulo: "Receita crescendo",
        texto: `Valor liberado pela Caixa subiu ${p}% vs mês passado (${fmtBRL(stats.valMes)} este mês). O pipeline de medições está gerando retorno.`,
      });
    } else if (stats.novasMes > stats.novasMesAnt) {
      list.push({
        tipo: "verde", titulo: "Captação acelerou",
        texto: `${stats.novasMes} nova${stats.novasMes !== 1 ? "s obras" : " obra"} aberta${stats.novasMes !== 1 ? "s" : ""} este mês — ${stats.novasMes - stats.novasMesAnt} a mais que no mês anterior. Boa entrada no pipeline.`,
      });
    } else {
      list.push({
        tipo: "verde", titulo: "Pipeline ativo",
        texto: `${stats.ativas.length} obras em andamento e ${stats.concl.length} entregues até hoje. Mantenha o ritmo para bater a meta de ${META_OBRAS_ATIVAS} ativas.`,
      });
    }

    // 2. O que preocupa
    if (stats.atrasadas.length > 0) {
      const pior = [...stats.atrasadas].sort((a, b) => {
        const da = new Date(a.prazo_conclusao || "").getTime();
        const db = new Date(b.prazo_conclusao || "").getTime();
        return da - db;
      })[0];
      list.push({
        tipo: "laranja",
        titulo: `${stats.atrasadas.length} obra${stats.atrasadas.length !== 1 ? "s atrasadas" : " atrasada"}`,
        texto: `"${pior.cliente ?? pior.nome}" tem o maior atraso. Revise o prazo ou registre uma prorrogação antes que impacte o contrato com a Caixa.`,
      });
    } else if (stats.medPend > 5) {
      list.push({
        tipo: "laranja", titulo: "Medições acumuladas",
        texto: `${stats.medPend} medições sem pagamento em aberto. Verifique se há laudos emitidos aguardando liberação — isso representa receita represada.`,
      });
    } else {
      list.push({
        tipo: "laranja", titulo: "Atenção ao funil",
        texto: `Etapas iniciais (Projeto e Licenças) tendem a travar o pipeline. Monitore obras paradas nessa fase há mais de 30 dias.`,
      });
    }

    // 3. Ação recomendada
    list.push({
      tipo: "azul", titulo: "Ação recomendada",
      texto: etapaGargalo && etapaGargalo.count >= 3
        ? `Etapa "${etapaGargalo.label}" concentra ${etapaGargalo.count} obras. Priorize o avanço dessa fase para desbloquear o pipeline e gerar novas medições.`
        : stats.medPend > 0
          ? `Há ${stats.medPend} medição${stats.medPend !== 1 ? "ões pendentes" : " pendente"}. Solicite atualização de status com a Caixa para converter em receita este mês.`
          : `Meta do mês: abrir ${Math.max(0, META_OBRAS_ATIVAS - stats.ativas.length)} nova${Math.max(0, META_OBRAS_ATIVAS - stats.ativas.length) !== 1 ? "s obras" : " obra"} para atingir ${META_OBRAS_ATIVAS} ativas.`,
    });

    return list;
  }, [stats, etapaGargalo]);

  const maxTempo = Math.max(...stats.tempoMedioEtapa.map((t) => t.media), 1);

  return (
    <div className="space-y-4">

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3.5">
        <KPICard
          label="Obras Ativas"
          valor={stats.ativas.length}
          cor="#3B82F6"
          varPeriodo={varObras}
          varMeta={pctMeta(stats.ativas.length, META_OBRAS_ATIVAS)}
          subMeta={`meta ${META_OBRAS_ATIVAS}`}
        />
        <KPICard
          label="Valor Liberado (Caixa)"
          valor={fmtBRL(stats.valMes)}
          cor="#10B981"
          varPeriodo={varValor}
          varMeta={pctMeta(stats.valMes, META_VALOR_MENSAL)}
          subMeta={`meta ${fmtBRL(META_VALOR_MENSAL)}`}
        />
        <KPICard
          label="Medições Pendentes"
          valor={stats.medPend}
          cor="#F97316"
          varMeta={undefined}
        />
        <KPICard
          label="Obras Atrasadas"
          valor={varAtraso}
          cor="#EF4444"
          menorMelhor
          varMeta={varAtraso === 0 ? 100 : undefined}
          subMeta={varAtraso === 0 ? "no prazo" : undefined}
        />
      </div>

      {/* ── Funil + Pizza + Tempo Médio ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3.5">

        {/* Funil por etapa */}
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-4">Obras por Etapa</p>
          {ETAPAS_OBRA.map((e) => {
            const c = obras.filter((o) => o.etapa === e.id).length;
            return (
              <BarraH
                key={e.id}
                label={e.label}
                valor={c}
                max={maxEtapa}
                cor={e.cor}
              />
            );
          })}
          <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between text-[11px]">
            <span className="text-slate-400">{stats.ativas.length} ativas · {stats.concl.length} entregues</span>
            <span className="font-bold text-slate-700">{obras.length} total</span>
          </div>
        </div>

        {/* Pizza medições */}
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-4">Situação das Medições</p>
          <PizzaMedicoes medicoes={stats.todasMed} />
          <div className="border-t border-slate-100 mt-4 pt-3 text-[11px] text-center text-slate-400">
            {stats.medPagas.length} pagas · {fmtBRL(stats.valLiberadoTotal)} total liberado
          </div>
        </div>

        {/* Tempo médio por etapa */}
        <div className="card p-5">
          <p className="text-[13px] font-bold text-slate-900 mb-4">Tempo Médio por Etapa</p>
          {stats.tempoMedioEtapa.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Dados insuficientes no histórico.</p>
          ) : (
            stats.tempoMedioEtapa.map((t) => {
              const etapa = ETAPAS_OBRA.find((e) => e.id === t.etapa);
              return (
                <BarraH
                  key={t.etapa}
                  label={etapa?.label ?? t.etapa}
                  valor={t.media}
                  max={maxTempo}
                  cor={etapa?.cor ?? "#94A3B8"}
                  sub={`${t.media} dia${t.media !== 1 ? "s" : ""}`}
                />
              );
            })
          )}
          <p className="text-[10px] text-slate-300 mt-3">* médias calculadas a partir do histórico de etapas</p>
        </div>
      </div>

      {/* ── Atrasadas + Insights ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3.5">

        {/* Lista obras atrasadas */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[13px] font-bold text-slate-900">Obras que Precisam de Atenção</p>
            {stats.atrasadas.length > 0 && (
              <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {stats.atrasadas.length} atrasada{stats.atrasadas.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {stats.atrasadas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500 font-semibold">Todas as obras estão no prazo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-slate-400 font-bold pb-2 text-[10px] uppercase">Cliente</th>
                    <th className="text-left text-slate-400 font-bold pb-2 text-[10px] uppercase">Etapa</th>
                    <th className="text-left text-slate-400 font-bold pb-2 text-[10px] uppercase">Previsão</th>
                    <th className="text-right text-red-400 font-bold pb-2 text-[10px] uppercase">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.atrasadas.map((o) => {
                    const prazo = o.prazo_conclusao;
                    const etapa = ETAPAS_OBRA.find((e) => e.id === o.etapa);
                    const dias = prazo ? diasAgo(prazo) : 0;
                    return (
                      <tr key={o.id} className="border-b border-slate-50">
                        <td className="py-2 font-semibold text-slate-900">{o.cliente ?? o.nome}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: (etapa?.cor ?? "#94A3B8") + "22", color: etapa?.cor ?? "#94A3B8" }}>
                            {etapa?.label ?? o.etapa}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500">{prazo ? fmtDate(prazo) : "—"}</td>
                        <td className="py-2 text-right font-bold text-red-500">{dias}d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Insights */}
        <div className="space-y-3">
          <p className="text-[13px] font-bold text-slate-900">Análise do Diretor</p>
          {insights.map((ins, i) => (
            <InsightCard key={i} titulo={ins.titulo} texto={ins.texto} tipo={ins.tipo} />
          ))}
        </div>
      </div>

    </div>
  );
}
