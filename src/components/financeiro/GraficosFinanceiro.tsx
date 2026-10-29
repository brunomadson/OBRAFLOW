"use client";
import { fmtBRL, diasAteVencer, statusReal } from "@/lib/utils";
import { GRUPOS_SAIDA_ORDEM, GRUPOS_COR } from "@/constants/financeiro";
import type { Lancamento } from "@/types/app.types";

// Peças de UI do Financeiro reaproveitadas entre Obras (SetorFinanceiro.tsx)
// e Serviços Técnicos (PainelFinanceiroServicos.tsx) — mesmo padrão visual
// do app inteiro, uma implementação só. Só dependem de Lancamento[] (nunca
// de Obra), então servem os dois domínios sem generalização nenhuma.

export const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function fmtK(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}R$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000)     return `${s}R$${(a / 1_000).toFixed(0)}k`;
  return `${s}R$${a.toFixed(0)}`;
}

export function ultimos6Meses() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MESES_PT[d.getMonth()] };
  });
}

export function varPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/* ─── KPI card (borda superior colorida) ─────────────────────────────────────── */
export function Kpi({ label, valor, cor, variacao, destaque, meta, metaLabel }: {
  label: string; valor: string; cor: string; variacao?: number | null; destaque?: boolean;
  meta?: number | null; metaLabel?: string;
}) {
  return (
    <div className="card p-4 border-t-[3px]" style={{ borderTopColor: cor }}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[18px] font-extrabold ${destaque ? "text-emerald-600" : "text-slate-900"}`}>{valor}</p>
      <div className="flex items-center gap-2 flex-wrap mt-0.5">
        {variacao !== undefined && variacao !== null && (
          <p className={`text-[10px] font-semibold ${variacao >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {variacao >= 0 ? "+" : ""}{variacao}% vs mês anterior
          </p>
        )}
        {meta !== undefined && meta !== null && (
          <p className={`text-[10px] font-semibold ${meta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {meta >= 0 ? "+" : ""}{meta}% vs meta{metaLabel ? ` (${metaLabel})` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Gráfico de barras Entradas × Saídas por mês ────────────────────────────── */
export function GraficoFluxo({ dados }: { dados: { label: string; ent: number; sai: number }[] }) {
  const maxV = Math.max(...dados.flatMap((d) => [d.ent, d.sai]), 100);
  const W = 540, H = 150, PAD_L = 52, PAD_R = 12, PAD_T = 10;
  const BOTTOM_SPACE = 68;
  const chartW = W - PAD_L - PAD_R;
  const colW = chartW / dados.length;
  const BW = Math.floor(Math.min(22, (colW - 10) / 2));
  const GAP = 3;

  const barH = (v: number) => v > 0 ? Math.max(Math.round((v / maxV) * H), 3) : 0;
  const barY = (v: number) => PAD_T + H - barH(v);

  return (
    <svg viewBox={`0 0 ${W} ${PAD_T + H + BOTTOM_SPACE}`} className="w-full">
      {[1, 0.75, 0.5, 0.25, 0].map((p) => {
        const y = PAD_T + H * (1 - p);
        return (
          <g key={p}>
            <line
              x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke={p === 0 ? "#CBD5E1" : "#F1F5F9"}
              strokeWidth={p === 0 ? 1.5 : 1}
            />
            <text x={PAD_L - 5} y={y + 3.5} textAnchor="end" fontSize={9} fill="#94A3B8">
              {fmtK(maxV * p)}
            </text>
          </g>
        );
      })}

      {dados.map((d, i) => {
        const cx = PAD_L + i * colW + colW / 2;
        const eH = barH(d.ent);
        const sH = barH(d.sai);
        const saldo = d.ent - d.sai;
        return (
          <g key={d.label}>
            {eH > 0 && (
              <rect x={cx - BW - GAP / 2} y={barY(d.ent)} width={BW} height={eH}
                fill="#10B981" rx={2} opacity={0.85} />
            )}
            {sH > 0 && (
              <rect x={cx + GAP / 2} y={barY(d.sai)} width={BW} height={sH}
                fill="#EF4444" rx={2} opacity={0.85} />
            )}
            <text x={cx} y={PAD_T + H + 14} textAnchor="middle" fontSize={10} fill="#64748B">
              {d.label}
            </text>
            <text x={cx} y={PAD_T + H + 27} textAnchor="middle" fontSize={9} fontWeight="bold"
              fill={saldo >= 0 ? "#10B981" : "#EF4444"}>
              {fmtK(saldo)}
            </text>
          </g>
        );
      })}

      <rect x={PAD_L} y={PAD_T + H + 42} width={9} height={9} fill="#10B981" rx={2} />
      <text x={PAD_L + 13} y={PAD_T + H + 50} fontSize={9} fill="#64748B">Entradas</text>
      <rect x={PAD_L + 65} y={PAD_T + H + 42} width={9} height={9} fill="#EF4444" rx={2} />
      <text x={PAD_L + 78} y={PAD_T + H + 50} fontSize={9} fill="#64748B">Saídas</text>
    </svg>
  );
}

/* ─── Distribuição de saídas por grupo (barras horizontais) ──────────────────── */
export function GraficoCustos({ saidas }: { saidas: Lancamento[] }) {
  const totalSaida = saidas.reduce((s, l) => s + l.valor, 0) || 1;
  const porGrupo = GRUPOS_SAIDA_ORDEM.map((g) => ({
    grupo: g, valor: saidas.filter((l) => l.grupo === g).reduce((s, l) => s + l.valor, 0),
  })).filter((g) => g.valor > 0).sort((a, b) => b.valor - a.valor);

  return (
    <div className="space-y-2.5">
      {porGrupo.map(({ grupo, valor }) => {
        const pct = (valor / totalSaida) * 100;
        const cor = GRUPOS_COR[grupo] ?? "#94A3B8";
        return (
          <div key={grupo}>
            <div className="flex justify-between text-[12px] mb-0.5">
              <span className="font-semibold text-slate-700">{grupo}</span>
              <span className="text-slate-500">{fmtBRL(valor)} <span className="text-slate-400">({pct.toFixed(1)}%)</span></span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
            </div>
          </div>
        );
      })}
      {porGrupo.length === 0 && <p className="text-[12px] text-slate-400 text-center py-4">Sem saídas no período</p>}
    </div>
  );
}

/* ─── Donut de vencimentos (Hoje / 7d / 30d / Após 30d) ──────────────────────── */
// `tipo` decide qual direção está "vencendo": "saida" (o que a empresa deve
// pagar — uso original em Obras) ou "entrada" (o que um cliente deve pagar —
// uso em Serviços Técnicos, onde uma parcela do cliente pode vencer).
export function PizzaVencimentos({ lancamentos, tipo, onClickFatia }: {
  lancamentos: Lancamento[];
  tipo: "entrada" | "saida";
  onClickFatia: (filtro: string) => void;
}) {
  const pendentes = lancamentos.filter((l) => l.tipo === tipo && statusReal(l) !== "pago");
  const fatias = [
    { label: "Hoje",       cor: "#EF4444", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d >= 0 && d <= 0; }).reduce((s, l) => s + l.valor, 0), filtro: "hoje" },
    { label: "Em 7 dias",  cor: "#F97316", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d > 0 && d <= 7; }).reduce((s, l) => s + l.valor, 0), filtro: "7d" },
    { label: "Em 30 dias", cor: "#F59E0B", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d > 7 && d <= 30; }).reduce((s, l) => s + l.valor, 0), filtro: "30d" },
    { label: "Após 30d",   cor: "#94A3B8", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d > 30; }).reduce((s, l) => s + l.valor, 0), filtro: "apos" },
  ];
  const total = fatias.reduce((s, f) => s + f.valor, 0) || 1;

  const CX = 70, CY = 70, R = 52, ri = 30;
  let cumulAngle = -Math.PI / 2;
  const paths = fatias.map((f) => {
    const angle = Math.min((f.valor / total) * 2 * Math.PI, 2 * Math.PI - 0.001);
    const x1 = CX + R * Math.cos(cumulAngle);
    const y1 = CY + R * Math.sin(cumulAngle);
    cumulAngle += angle;
    const x2 = CX + R * Math.cos(cumulAngle);
    const y2 = CY + R * Math.sin(cumulAngle);
    const xi1 = CX + ri * Math.cos(cumulAngle);
    const yi1 = CY + ri * Math.sin(cumulAngle);
    const xi2 = CX + ri * Math.cos(cumulAngle - angle);
    const yi2 = CY + ri * Math.sin(cumulAngle - angle);
    const large = angle > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${ri} ${ri} 0 ${large} 0 ${xi2} ${yi2} Z`;
    return { ...f, d, angle };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-36 h-36 flex-shrink-0">
        {paths.map((p) => (
          <path
            key={p.filtro}
            d={p.d}
            fill={p.valor > 0 ? p.cor : "#F1F5F9"}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => p.valor > 0 && onClickFatia(p.filtro)}
          />
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={8} fill="#94A3B8">clique</text>
        <text x={CX} y={CY + 8} textAnchor="middle" fontSize={9} fill="#475569" fontWeight="bold">{fmtK(total)}</text>
      </svg>
      <div className="space-y-2 flex-1">
        {fatias.map((f) => (
          <button
            key={f.filtro}
            onClick={() => f.valor > 0 && onClickFatia(f.filtro)}
            className="w-full flex items-center gap-2 text-left group"
          >
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: f.cor }} />
            <span className="text-[11px] text-slate-600 flex-1 group-hover:text-slate-900 transition-colors">{f.label}</span>
            <span className="text-[11px] font-semibold text-slate-700">{fmtBRL(f.valor)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export type FiltroVenc = "hoje" | "7d" | "30d" | "apos";

export const FILTRO_VENC_LABEL: Record<FiltroVenc, string> = {
  hoje:  "Vencem Hoje",
  "7d":  "Vencem em até 7 dias",
  "30d": "Vencem em até 30 dias",
  apos:  "Vencem após 30 dias",
};

export const FILTRO_VENC_COR: Record<FiltroVenc, string> = {
  hoje:  "#EF4444",
  "7d":  "#F97316",
  "30d": "#F59E0B",
  apos:  "#94A3B8",
};

export function filtraVencimentos(lancamentos: Lancamento[], tipo: "entrada" | "saida", filtro: FiltroVenc): Lancamento[] {
  return lancamentos.filter((l) => {
    if (l.tipo !== tipo || statusReal(l) === "pago") return false;
    const dias = diasAteVencer(l.data_vencimento);
    if (dias === null) return false;
    if (filtro === "hoje")  return dias >= 0 && dias <= 0;
    if (filtro === "7d")    return dias > 0 && dias <= 7;
    if (filtro === "30d")   return dias > 7 && dias <= 30;
    if (filtro === "apos")  return dias > 30;
    return false;
  });
}
