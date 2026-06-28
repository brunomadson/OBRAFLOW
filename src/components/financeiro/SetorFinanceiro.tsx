"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { getObras } from "@/services/obras.service";
import { fmtBRL, fmtDate } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA, GRUPOS_COR,
  FORMAS_PAGAMENTO, GRUPO_DE_CATEGORIA, GRUPOS_SAIDA_DRE, GRUPOS_SAIDA_ORDEM,
} from "@/constants/financeiro";
import type { Lancamento, Obra, StatusPagamento } from "@/types/app.types";
import toast from "react-hot-toast";

/* ─── helpers ────────────────────────────────────────────────────────────────── */
type FinTab = "dashboard" | "dre" | "lancamentos" | "por_obra";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function hoje(): string { return new Date().toISOString().slice(0, 10); }

function fmtK(v: number): string {
  const s = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}R$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000)     return `${s}R$${(a / 1_000).toFixed(0)}k`;
  return `${s}R$${a.toFixed(0)}`;
}

function diasAteVencer(dvStr: string | null): number | null {
  if (!dvStr) return null;
  return Math.ceil((new Date(dvStr + "T00:00:00").getTime() - Date.now()) / 86_400_000);
}

function statusReal(l: Lancamento): StatusPagamento {
  if (l.status_pagamento === "pago") return "pago";
  if (l.data_vencimento && diasAteVencer(l.data_vencimento)! < 0) return "vencido";
  return "pendente";
}

const STATUS_COR: Record<StatusPagamento, string> = {
  pago:    "#10B981",
  pendente:"#F59E0B",
  vencido: "#EF4444",
};

function ultimos6Meses() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MESES_PT[d.getMonth()] };
  });
}

function varPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/* ─── ModalPrioridades (A Vencer / Vencidos) ────────────────────────────────── */
function ModalPrioridades({ tipo, lancamentos, onClose }: {
  tipo: "avencer" | "vencidos";
  lancamentos: Lancamento[];
  onClose: () => void;
}) {
  const titulo = tipo === "avencer" ? "Pagamentos a Vencer" : "Pagamentos Vencidos";
  const filtrados = lancamentos
    .filter((l) => l.tipo === "saida" && statusReal(l) === (tipo === "avencer" ? "pendente" : "vencido"))
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader title={titulo} onClose={onClose} />
      <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
        {filtrados.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">Nenhum lançamento encontrado</p>
        )}
        {filtrados.map((l, i) => {
          const dias = diasAteVencer(l.data_vencimento);
          const cor  = tipo === "vencidos" ? "#EF4444" : dias !== null && dias <= 7 ? "#F97316" : "#F59E0B";
          return (
            <div key={l.id} className={`flex items-center justify-between p-3 rounded-xl border ${i % 2 === 0 ? "bg-slate-50" : "bg-white"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 truncate">{l.descricao}</p>
                <p className="text-[11px] text-slate-400">
                  {l.categoria} · Vence: {l.data_vencimento ? fmtDate(l.data_vencimento) : "—"}
                </p>
              </div>
              <div className="ml-4 text-right flex-shrink-0">
                <p className="text-[13px] font-bold" style={{ color: cor }}>{fmtBRL(l.valor)}</p>
                {dias !== null && (
                  <p className="text-[11px]" style={{ color: cor }}>
                    {tipo === "vencidos" ? `${Math.abs(dias)}d atraso` : `em ${dias}d`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {filtrados.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[13px] font-bold text-slate-700">
            <span>{filtrados.length} lançamentos</span>
            <span>{fmtBRL(filtrados.reduce((s, l) => s + l.valor, 0))}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── Modal de Lançamento ────────────────────────────────────────────────────── */
interface ModalLancamentoProps {
  initial?: Lancamento | null;
  obras: Obra[];
  onClose: () => void;
  onSave: (data: Omit<Lancamento, "id" | "created_at">[]) => Promise<void>;
}

function ModalLancamento({ initial, obras, onClose, onSave }: ModalLancamentoProps) {
  const isEdit = !!initial;
  const [tipo, setTipo]           = useState<"entrada" | "saida">(initial?.tipo ?? "saida");
  const [categoria, setCategoria] = useState(initial?.categoria ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [valor, setValor]         = useState(String(initial?.valor ?? ""));
  const [data, setData]           = useState(initial?.data ?? hoje());
  const [dataVenc, setDataVenc]   = useState(initial?.data_vencimento ?? "");
  const [forma, setForma]         = useState(initial?.forma_pagamento ?? "Pix");
  const [status, setStatus]       = useState<StatusPagamento>(initial?.status_pagamento ?? "pendente");
  const [obraId, setObraId]       = useState(initial?.obra_id ?? "");
  const [obs, setObs]             = useState(initial?.obs ?? "");
  const [parcelado, setParcelado]       = useState(false);
  const [nParc, setNParc]               = useState(2);
  const [parcDatas, setParcDatas]       = useState<string[]>([]);
  const [showPreview, setShowPreview]   = useState(false);
  const [saving, setSaving]             = useState(false);

  const cats = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  const grupo = GRUPO_DE_CATEGORIA[categoria] ?? "";
  const grupoCor = GRUPOS_COR[grupo] ?? "#94A3B8";
  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const valorParc = parcelado && nParc > 0 ? valorNum / nParc : valorNum;

  // Recalcula datas apenas quando muda nParc ou data base (respeitando edições manuais)
  const recalcDatas = useCallback((n: number, base: string) => {
    setParcDatas(
      Array.from({ length: n }, (_, i) => {
        const d = new Date(base + "T00:00:00");
        d.setMonth(d.getMonth() + i);
        return d.toISOString().slice(0, 10);
      })
    );
  }, []);

  // Só recalcula quando o usuário muda nParc (mantém datas editadas se apenas o valor mudou)
  const handleNParc = (n: number) => {
    const clamped = Math.max(2, Math.min(36, n));
    setNParc(clamped);
    recalcDatas(clamped, data);
  };

  const handleAtivarParcelado = () => {
    setParcelado((p) => {
      if (!p) recalcDatas(nParc, data);
      return !p;
    });
  };

  const setDataParc = (i: number, v: string) => {
    setParcDatas((prev) => prev.map((d, idx) => (idx === i ? v : d)));
  };

  const handleSave = async () => {
    if (!descricao.trim()) { toast.error("Informe a descrição"); return; }
    if (valorNum <= 0)     { toast.error("Informe o valor"); return; }
    if (!data)             { toast.error("Informe a data"); return; }
    if (!categoria)        { toast.error("Selecione a categoria"); return; }

    setSaving(true);
    try {
      if (parcelado && !isEdit) {
        const lista = parcDatas.map((d, i) => ({
          tipo, categoria, grupo: GRUPO_DE_CATEGORIA[categoria] ?? null,
          descricao: `${descricao} (${i + 1}/${nParc})`,
          valor: Math.round((valorNum / nParc) * 100) / 100,
          data: d, data_vencimento: d || null, data_confirmacao: null,
          forma_pagamento: forma, status_pagamento: "pendente" as StatusPagamento,
          parcela_num: i + 1, parcela_total: nParc,
          obra_id: obraId || null, obs: obs || null,
        }));
        await onSave(lista);
      } else {
        await onSave([{
          tipo, categoria, grupo: GRUPO_DE_CATEGORIA[categoria] ?? null,
          descricao, valor: valorNum, data,
          data_vencimento: dataVenc || null, data_confirmacao: null,
          forma_pagamento: forma, status_pagamento: tipo === "entrada" ? "pago" : status,
          parcela_num: null, parcela_total: null,
          obra_id: obraId || null, obs: obs || null,
        }]);
      }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader title={isEdit ? "Editar Lançamento" : "Novo Lançamento"} onClose={onClose} />
      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

        {/* Tipo */}
        <div className="flex gap-3">
          {(["entrada", "saida"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTipo(t); setCategoria(""); }}
              className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-colors ${
                tipo === t
                  ? t === "entrada"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-red-500 bg-red-50 text-red-700"
                  : "border-slate-200 text-slate-400 hover:border-slate-300"
              }`}
            >
              {t === "entrada" ? "⬆ Entrada" : "⬇ Saída"}
            </button>
          ))}
        </div>

        {/* Categoria */}
        <div>
          <label className="field-label">Categoria *</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="input-base"
          >
            <option value="">Selecione a categoria</option>
            {Object.entries(cats).map(([grp, itens]) => (
              <optgroup key={grp} label={grp}>
                {(itens as string[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
          </select>
          {grupo && (
            <span
              className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: grupoCor }}
            >
              {grupo}
            </span>
          )}
        </div>

        {/* Descrição + Valor */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="field-label">Descrição *</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
              className="input-base" placeholder="Ex: Compra de material para Obra Silva" />
          </div>
          <div>
            <label className="field-label">Valor (R$) *</label>
            <input
              type="number" min={0} step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={`input-base font-bold ${tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="field-label">Data *</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input-base" />
          </div>
        </div>

        {/* Forma + Status + Vencimento (saídas) */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">Forma de Pagamento</label>
            <select value={forma} onChange={(e) => setForma(e.target.value)} className="input-base">
              {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          {tipo === "saida" && (
            <>
              <div>
                <label className="field-label">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as StatusPagamento)} className="input-base">
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
              <div>
                <label className="field-label">Data de Vencimento</label>
                <input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} className="input-base" />
              </div>
            </>
          )}
        </div>

        {/* Obra + Obs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Obra (opcional)</label>
            <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="input-base">
              <option value="">Sem obra</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Observações</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} className="input-base" placeholder="Opcional" />
          </div>
        </div>

        {/* Parcelado (só saídas, não edição) */}
        {tipo === "saida" && !isEdit && (
          <div>
            <button
              onClick={handleAtivarParcelado}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                parcelado ? "border-blue-400 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-500 hover:border-blue-300"
              }`}
            >
              {parcelado ? "✓ Parcelado ativado" : "Parcelado"}
            </button>
            {parcelado && (
              <div className="mt-3 p-3.5 bg-blue-50 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-[12px] font-semibold text-blue-700 w-28">Nº de parcelas</label>
                  <input
                    type="number" min={2} max={36} value={nParc}
                    onChange={(e) => handleNParc(Number(e.target.value))}
                    className="input-base w-20 text-center"
                  />
                  <span className="text-[12px] text-blue-600 font-semibold">
                    = {fmtBRL(valorParc)} / parcela
                  </span>
                </div>
                {/* Datas editáveis por parcela */}
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">
                    Datas de vencimento — edite conforme o boleto
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {parcDatas.map((d, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="text-[11px] text-blue-700 w-20 flex-shrink-0">
                          Parcela {i + 1}/{nParc}
                        </span>
                        <input
                          type="date"
                          value={d}
                          onChange={(e) => setDataParc(i, e.target.value)}
                          className="border border-blue-200 bg-white rounded-lg px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 flex-1"
                        />
                        <span className="text-[11px] font-bold text-blue-700 w-20 text-right flex-shrink-0">
                          {fmtBRL(valorParc)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {!parcelado && (
          <button
            onClick={() => setShowPreview((p) => !p)}
            className="text-[11px] text-blue-500 font-semibold"
          >
            {showPreview ? "▲ Ocultar preview" : "▼ Ver preview"}
          </button>
        )}
        {showPreview && !parcelado && valorNum > 0 && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1.5 text-[12px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview do lançamento</p>
            <div className="flex justify-between">
              <span className="text-slate-500">Tipo</span>
              <span className={`font-bold ${tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                {tipo === "entrada" ? "⬆ Entrada" : "⬇ Saída"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-slate-500">Categoria</span><span className="font-semibold">{categoria || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Descrição</span><span className="font-semibold">{descricao || "—"}</span></div>
            <div className="flex justify-between">
              <span className="text-slate-500">Valor</span>
              <span className={`font-bold text-[14px] ${tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                {tipo === "entrada" ? "+" : "−"}{fmtBRL(valorNum)}
              </span>
            </div>
            {dataVenc && <div className="flex justify-between"><span className="text-slate-500">Vencimento</span><span>{fmtDate(dataVenc)}</span></div>}
            {obraId && <div className="flex justify-between"><span className="text-slate-500">Obra</span><span>{obras.find(o => o.id === obraId)?.nome}</span></div>}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3.5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {parcelado ? `Gerar ${nParc} parcelas` : isEdit ? "Salvar" : "Criar Lançamento"}
        </Button>
      </div>
    </Modal>
  );
}

/* ─── Gráfico Fluxo Mensal (SVG) ────────────────────────────────────────────── */
function GraficoFluxo({ dados }: { dados: { label: string; ent: number; sai: number }[] }) {
  const maxV = Math.max(...dados.flatMap((d) => [d.ent, d.sai]), 100);
  const W = 540, H = 150, PAD_L = 52, PAD_R = 12, PAD_T = 10;
  const BOTTOM_SPACE = 68; // mês label (14) + saldo (28) + legenda (26)
  const chartW = W - PAD_L - PAD_R;
  const colW = chartW / dados.length;
  const BW = Math.floor(Math.min(22, (colW - 10) / 2));
  const GAP = 3;

  const barH = (v: number) => v > 0 ? Math.max(Math.round((v / maxV) * H), 3) : 0;
  const barY = (v: number) => PAD_T + H - barH(v);

  return (
    <svg viewBox={`0 0 ${W} ${PAD_T + H + BOTTOM_SPACE}`} className="w-full">
      {/* Grid lines + Y labels */}
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

      {/* Bars por mês */}
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

      {/* Legenda */}
      <rect x={PAD_L} y={PAD_T + H + 42} width={9} height={9} fill="#10B981" rx={2} />
      <text x={PAD_L + 13} y={PAD_T + H + 50} fontSize={9} fill="#64748B">Entradas</text>
      <rect x={PAD_L + 65} y={PAD_T + H + 42} width={9} height={9} fill="#EF4444" rx={2} />
      <text x={PAD_L + 78} y={PAD_T + H + 50} fontSize={9} fill="#64748B">Saídas</text>
    </svg>
  );
}

/* ─── Gráfico Custos por Grupo (barras horizontais) ─────────────────────────── */
function GraficoCustos({ saidas }: { saidas: Lancamento[] }) {
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

/* ─── Pizza de Vencimentos (SVG donut) ──────────────────────────────────────── */
function PizzaVencimentos({ saidas, onClickFatia }: {
  saidas: Lancamento[];
  onClickFatia: (filtro: string) => void;
}) {
  const pendentes = saidas.filter((l) => l.tipo === "saida" && statusReal(l) !== "pago");
  const fatias = [
    { label: "Hoje",       cor: "#EF4444", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d >= 0 && d <= 0; }).reduce((s, l) => s + l.valor, 0), filtro: "hoje" },
    { label: "Em 7 dias",  cor: "#F97316", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d > 0 && d <= 7; }).reduce((s, l) => s + l.valor, 0), filtro: "7d" },
    { label: "Em 30 dias", cor: "#F59E0B", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d > 7 && d <= 30; }).reduce((s, l) => s + l.valor, 0), filtro: "30d" },
    { label: "Após 30d",   cor: "#94A3B8", valor: pendentes.filter((l) => { const d = diasAteVencer(l.data_vencimento); return d !== null && d > 30; }).reduce((s, l) => s + l.valor, 0), filtro: "apos" },
  ];
  const total = fatias.reduce((s, f) => s + f.valor, 0) || 1;

  // Build SVG donut
  const CX = 70, CY = 70, R = 52, ri = 30;
  let cumulAngle = -Math.PI / 2;
  const paths = fatias.map((f) => {
    const angle = (f.valor / total) * 2 * Math.PI;
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

/* ─── Modal Filtro Vencimentos ───────────────────────────────────────────────── */
type FiltroVenc = "hoje" | "7d" | "30d" | "apos";

const FILTRO_LABEL: Record<FiltroVenc, string> = {
  hoje:  "Vencem Hoje",
  "7d":  "Vencem em até 7 dias",
  "30d": "Vencem em até 30 dias",
  apos:  "Vencem após 30 dias",
};

const FILTRO_COR: Record<FiltroVenc, string> = {
  hoje:  "#EF4444",
  "7d":  "#F97316",
  "30d": "#F59E0B",
  apos:  "#94A3B8",
};

function filtraVenc(lancamentos: Lancamento[], filtro: FiltroVenc): Lancamento[] {
  return lancamentos.filter((l) => {
    if (l.tipo !== "saida" || statusReal(l) === "pago") return false;
    const dias = diasAteVencer(l.data_vencimento);
    if (dias === null) return false;
    if (filtro === "hoje")  return dias >= 0 && dias <= 0;
    if (filtro === "7d")    return dias > 0 && dias <= 7;
    if (filtro === "30d")   return dias > 7 && dias <= 30;
    if (filtro === "apos")  return dias > 30;
    return false;
  });
}

function ModalFiltroVencimentos({ filtro, lancamentos, obras, onPagar, onClose }: {
  filtro: FiltroVenc;
  lancamentos: Lancamento[];
  obras: Obra[];
  onPagar: (id: string) => void;
  onClose: () => void;
}) {
  const lista = filtraVenc(lancamentos, filtro)
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
  const total = lista.reduce((s, l) => s + l.valor, 0);
  const cor   = FILTRO_COR[filtro];

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={FILTRO_LABEL[filtro]}
        subtitle={`${lista.length} lançamento${lista.length !== 1 ? "s" : ""} · Total: ${fmtBRL(total)}`}
        onClose={onClose}
      />
      <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
        {lista.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-[13px]">
            Nenhum lançamento nesta faixa de vencimento.
          </p>
        ) : (
          lista.map((l) => {
            const dias  = diasAteVencer(l.data_vencimento);
            const obra  = obras.find((o) => o.id === l.obra_id);
            const st    = statusReal(l);
            return (
              <div
                key={l.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50"
              >
                {/* Cor lateral */}
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: cor }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{l.descricao}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {l.categoria && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: GRUPOS_COR[l.grupo ?? ""] ?? "#94A3B8" }}
                      >
                        {l.categoria}
                      </span>
                    )}
                    {obra && (
                      <span className="text-[10px] text-slate-400">{obra.cliente ?? obra.nome ?? "—"}</span>
                    )}
                    {l.forma_pagamento && (
                      <span className="text-[10px] text-slate-400">{l.forma_pagamento}</span>
                    )}
                  </div>
                </div>

                {/* Vencimento */}
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] text-slate-400">
                    {l.data_vencimento ? fmtDate(l.data_vencimento) : "—"}
                  </p>
                  {dias !== null && (
                    <p className="text-[10px] font-bold" style={{ color: cor }}>
                      {dias === 0 ? "Hoje!" : dias < 0 ? `${Math.abs(dias)}d atraso` : `em ${dias}d`}
                    </p>
                  )}
                </div>

                {/* Valor + botão */}
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className="text-[14px] font-extrabold text-red-500">{fmtBRL(l.valor)}</p>
                  {st !== "pago" && (
                    <button
                      onClick={() => onPagar(l.id)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      ✓ Pago
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Rodapé totalizador */}
        {lista.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-[12px] text-slate-500">{lista.length} lançamentos</span>
            <span className="text-[14px] font-extrabold text-red-500">{fmtBRL(total)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── Tab Dashboard ──────────────────────────────────────────────────────────── */
function TabDashboard({ lancamentos, obras, onAbrirPrioridades, onPagar }: {
  lancamentos: Lancamento[];
  obras: Obra[];
  onAbrirPrioridades: (t: "avencer" | "vencidos") => void;
  onPagar: (id: string) => void;
}) {
  const [filtroVenc, setFiltroVenc] = useState<FiltroVenc | null>(null);
  const meses = ultimos6Meses();
  const mesAtual  = meses[5].key;
  const mesAnter  = meses[4].key;

  const L = (key: string) => lancamentos.filter((l) => l.data.startsWith(key));
  const sum = (ls: Lancamento[], t: "entrada" | "saida") => ls.filter((l) => l.tipo === t).reduce((s, l) => s + l.valor, 0);

  const recAtual = sum(L(mesAtual), "entrada");
  const recAnter = sum(L(mesAnter), "entrada");
  const saiAtual = sum(L(mesAtual), "saida");
  const saiAnter = sum(L(mesAnter), "saida");
  const saldoAtual = recAtual - saiAtual;
  const saldoAnter = recAnter - saiAnter;
  const totalRec  = sum(lancamentos, "entrada");
  const totalSai  = sum(lancamentos, "saida");
  const lucroLiq  = totalRec - totalSai;

  // Médições pendentes
  const medicoesPend = obras.flatMap((o) => (o.medicoes ?? []).filter((m) => m.status !== "laudo_emitido" && m.status !== "paga")).length;

  // Pagamentos
  const pagos   = lancamentos.filter((l) => l.tipo === "saida" && statusReal(l) === "pago");
  const avencer = lancamentos.filter((l) => l.tipo === "saida" && statusReal(l) === "pendente");
  const vencidos= lancamentos.filter((l) => l.tipo === "saida" && statusReal(l) === "vencido");

  const fluxo = meses.map((m) => ({
    label: m.label,
    ent: sum(L(m.key), "entrada"),
    sai: sum(L(m.key), "saida"),
  }));

  // Insights
  const topGrupoAtual = GRUPOS_SAIDA_ORDEM
    .map((g) => ({ g, v: L(mesAtual).filter((l) => l.tipo === "saida" && l.grupo === g).reduce((s, l) => s + l.valor, 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)[0];

  const varRec = varPct(recAtual, recAnter);
  const insightCresceu = recAtual > 0
    ? recAtual >= recAnter
      ? `Receita de ${fmtBRL(recAtual)} neste mês${varRec !== null && varRec > 0 ? ` (+${varRec}% vs mês anterior)` : ""}. Mantenha a cadência.`
      : `Saídas controladas em ${fmtBRL(saiAtual)} neste mês — menor que mês anterior.`
    : "Nenhuma entrada registrada neste mês ainda.";

  const insightPreocupa = saldoAtual < 0
    ? `Saldo negativo de ${fmtBRL(Math.abs(saldoAtual))} este mês. Receita não cobre as despesas.`
    : vencidos.length > 0
      ? `${vencidos.length} pagamento${vencidos.length > 1 ? "s" : ""} vencido${vencidos.length > 1 ? "s" : ""} — total de ${fmtBRL(vencidos.reduce((s, l) => s + l.valor, 0))}.`
      : avencer.length > 0
        ? `${avencer.length} saída${avencer.length > 1 ? "s" : ""} a vencer em breve (${fmtBRL(avencer.reduce((s, l) => s + l.valor, 0))}). Fique atento.`
        : "Nenhum pagamento vencido ou próximo do vencimento.";

  const insightAcao = topGrupoAtual
    ? `"${topGrupoAtual.g}" é o maior gasto do mês: ${fmtBRL(topGrupoAtual.v)}. Avalie se pode ser otimizado.`
    : saldoAtual > 0
      ? "Reinvista o saldo positivo em obras ou marketing para crescer mais rápido."
      : "Cadastre lançamentos detalhados para receber recomendações personalizadas.";

  const insights = [insightCresceu, insightPreocupa, insightAcao];

  function Kpi({ label, valor, cor, variacao, destaque }: {
    label: string; valor: string; cor: string; variacao?: number | null; destaque?: boolean;
  }) {
    return (
      <div className={`card p-4 border-t-[3px]`} style={{ borderTopColor: cor }}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-[18px] font-extrabold ${destaque ? "text-emerald-600" : "text-slate-900"}`}>{valor}</p>
        {variacao !== undefined && variacao !== null && (
          <p className={`text-[10px] font-semibold mt-0.5 ${variacao >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {variacao >= 0 ? "+" : ""}{variacao}% vs mês anterior
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5">
        <Kpi label="Receita Total"     valor={fmtBRL(totalRec)}   cor="#10B981" variacao={varPct(recAtual, recAnter)} />
        <Kpi label="Total Saídas"      valor={fmtBRL(totalSai)}   cor="#EF4444" variacao={varPct(saiAtual, saiAnter)} />
        <Kpi label="Saldo do Período"  valor={fmtBRL(lucroLiq)}   cor={lucroLiq >= 0 ? "#3B82F6" : "#EF4444"} variacao={varPct(saldoAtual, saldoAnter)} />
        <Kpi label="Medições Pendentes" valor={String(medicoesPend)} cor="#F59E0B" />
      </div>

      {/* Cards de pagamento */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="card p-4 border-l-4 border-emerald-400">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pagos (confirmados)</p>
          <p className="text-[17px] font-extrabold text-emerald-600">{fmtBRL(pagos.reduce((s, l) => s + l.valor, 0))}</p>
          <p className="text-[11px] text-slate-400">{pagos.length} lançamento{pagos.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => onAbrirPrioridades("avencer")}
          className="card p-4 border-l-4 border-amber-400 text-left hover:shadow-md transition-shadow cursor-pointer"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">A Vencer</p>
          <p className="text-[17px] font-extrabold text-amber-600">{fmtBRL(avencer.reduce((s, l) => s + l.valor, 0))}</p>
          <p className="text-[11px] text-amber-500 font-semibold">{avencer.length} pendente{avencer.length !== 1 ? "s" : ""} → ver relatório</p>
        </button>
        <button
          onClick={() => onAbrirPrioridades("vencidos")}
          className="card p-4 border-l-4 border-red-400 text-left hover:shadow-md transition-shadow cursor-pointer"
        >
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vencidos</p>
          <p className="text-[17px] font-extrabold text-red-600">{fmtBRL(vencidos.reduce((s, l) => s + l.valor, 0))}</p>
          <p className="text-[11px] text-red-500 font-semibold">{vencidos.length} vencido{vencidos.length !== 1 ? "s" : ""} → ver relatório</p>
        </button>
      </div>

      {/* Fluxo mensal + Vencimentos */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="card p-4 col-span-2">
          <p className="text-[11px] font-bold text-slate-700 mb-3">Fluxo Mensal — Últimos 6 Meses</p>
          <GraficoFluxo dados={fluxo} />
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-bold text-slate-700 mb-3">Vencimentos Pendentes</p>
          <PizzaVencimentos
            saidas={lancamentos}
            onClickFatia={(f) => setFiltroVenc(f as FiltroVenc)}
          />
        </div>
      </div>

      {/* Custos por grupo */}
      <div className="card p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-3">Distribuição de Custos por Grupo</p>
        <GraficoCustos saidas={lancamentos.filter((l) => l.tipo === "saida")} />
      </div>

      {/* Insights — 3 cards coloridos */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">💡 Insights do Período</p>
        <div className="grid grid-cols-3 gap-3.5">
          <div className="rounded-xl p-4 border border-emerald-200 bg-emerald-50">
            <p className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect width="13" height="13" rx="3" fill="#10B981" fillOpacity=".2"/>
                <path d="M3 6.5l2.5 2.5 4.5-5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              O que cresceu
            </p>
            <p className="text-[12px] text-emerald-800 leading-relaxed">{insights[0]}</p>
          </div>
          <div className="rounded-xl p-4 border border-orange-200 bg-orange-50">
            <p className="text-[11px] font-bold text-orange-700 mb-2 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1L12 11.5H1L6.5 1z" fill="#FB923C" fillOpacity=".2" stroke="#EA580C" strokeWidth="1.2"/>
                <text x="6.5" y="10" textAnchor="middle" fontSize="6" fill="#EA580C" fontWeight="bold">!</text>
              </svg>
              O que preocupa
            </p>
            <p className="text-[12px] text-orange-800 leading-relaxed">{insights[1]}</p>
          </div>
          <div className="rounded-xl p-4 border border-blue-200 bg-blue-50">
            <p className="text-[11px] font-bold text-blue-700 mb-2 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="#3B82F6" strokeWidth="1.2" fill="#3B82F6" fillOpacity=".15"/>
                <circle cx="6.5" cy="6.5" r="2" fill="#3B82F6"/>
              </svg>
              Ação recomendada
            </p>
            <p className="text-[12px] text-blue-800 leading-relaxed">{insights[2]}</p>
          </div>
        </div>
      </div>

      {/* Modal de vencimentos filtrado */}
      {filtroVenc && (
        <ModalFiltroVencimentos
          filtro={filtroVenc}
          lancamentos={lancamentos}
          obras={obras}
          onPagar={(id) => { onPagar(id); }}
          onClose={() => setFiltroVenc(null)}
        />
      )}
    </div>
  );
}

/* ─── Tab DRE ────────────────────────────────────────────────────────────────── */
function TabDRE({ lancamentos }: { lancamentos: Lancamento[] }) {
  const ent  = lancamentos.filter((l) => l.tipo === "entrada");
  const sai  = lancamentos.filter((l) => l.tipo === "saida");

  const totalRec = ent.reduce((s, l) => s + l.valor, 0);
  const custObra = sai.filter((l) => l.grupo === "Custo Obra").reduce((s, l) => s + l.valor, 0);
  const lucroBruto = totalRec - custObra;

  const despadm  = sai.filter((l) => l.grupo === "Administrativo").reduce((s, l) => s + l.valor, 0);
  const despop   = sai.filter((l) => l.grupo === "Operacional").reduce((s, l) => s + l.valor, 0);
  const despcom  = sai.filter((l) => l.grupo === "Comercial").reduce((s, l) => s + l.valor, 0);
  const totalOp  = despadm + despop + despcom;
  const lucroOp  = lucroBruto - totalOp;

  const impostos = sai.filter((l) => l.grupo === "Impostos").reduce((s, l) => s + l.valor, 0);
  const outros   = sai.filter((l) => l.grupo === "Outros" || !l.grupo).reduce((s, l) => s + l.valor, 0);
  const lucroLiq = lucroOp - impostos - outros;

  const pct = (v: number) => totalRec > 0 ? `${((v / totalRec) * 100).toFixed(1)}%` : "—";

  function Linha({ label, valor, indent = 0, bold = false, sublinha = false, destaque = false, cor }: {
    label: string; valor: number; indent?: number; bold?: boolean; sublinha?: boolean; destaque?: boolean; cor?: string;
  }) {
    return (
      <div className={`flex justify-between py-1.5 text-[13px] ${sublinha ? "border-t border-slate-200 mt-1 pt-2" : ""} ${destaque ? "bg-slate-50 -mx-4 px-4 rounded-xl" : ""}`}>
        <span
          className={`${bold ? "font-bold" : "font-medium"} text-slate-${bold ? "800" : "600"}`}
          style={{ paddingLeft: `${indent * 16}px`, color: cor }}
        >
          {label}
        </span>
        <div className="flex gap-6 items-center">
          <span className={`${bold ? "font-bold" : ""} text-slate-400 text-[11px]`}>{pct(valor)}</span>
          <span
            className={`font-${bold ? "extrabold" : "semibold"} w-28 text-right`}
            style={{ color: cor ?? (valor < 0 ? "#EF4444" : undefined) }}
          >
            {fmtBRL(valor)}
          </span>
        </div>
      </div>
    );
  }

  function Secao({ titulo, grupo, lancamentos: ls }: { titulo: string; grupo: string; lancamentos: Lancamento[] }) {
    const [aberta, setAberta] = useState(true);
    const total = ls.reduce((s, l) => s + l.valor, 0);
    const porCat: Record<string, number> = {};
    ls.forEach((l) => { porCat[l.categoria] = (porCat[l.categoria] ?? 0) + l.valor; });
    const cor = GRUPOS_COR[grupo] ?? "#94A3B8";

    return (
      <div>
        <button
          onClick={() => setAberta((p) => !p)}
          className="w-full flex items-center gap-2 py-1.5 text-[12px] font-bold uppercase tracking-wider"
          style={{ color: cor }}
        >
          <span>{aberta ? "▼" : "▶"}</span>
          <span>{titulo}</span>
        </button>
        {aberta && Object.entries(porCat).map(([cat, val]) => (
          <Linha key={cat} label={cat} valor={val} indent={2} />
        ))}
        <Linha label={`Total ${titulo}`} valor={total} bold sublinha cor={cor} />
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[16px] font-extrabold text-slate-900">Demonstrativo de Resultado</p>
          <p className="text-[11px] text-slate-400">Todos os lançamentos · {lancamentos.length} registros</p>
        </div>
      </div>

      {/* Receitas */}
      <div className="mb-4">
        <p className="text-[12px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Receitas</p>
        {Object.entries(CATEGORIAS_ENTRADA).map(([grp, cats]) => {
          const ls = ent.filter((l) => l.grupo === grp);
          return ls.length > 0 ? <Secao key={grp} titulo={grp} grupo={grp} lancamentos={ls} /> : null;
        })}
        <div className="border-t-2 border-slate-300 mt-3 pt-2">
          <Linha label="RECEITA TOTAL" valor={totalRec} bold cor="#10B981" />
        </div>
      </div>

      {/* Custo Obra */}
      <div className="mb-4">
        <p className="text-[12px] font-bold text-blue-500 uppercase tracking-wider mb-2">(−) Custo das Obras</p>
        <Secao titulo="Custo Obra" grupo="Custo Obra" lancamentos={sai.filter((l) => l.grupo === "Custo Obra")} />
      </div>
      <div className="bg-slate-100 rounded-xl p-3 mb-4">
        <Linha label="LUCRO BRUTO" valor={lucroBruto} bold cor={lucroBruto >= 0 ? "#10B981" : "#EF4444"} />
      </div>

      {/* Despesas Operacionais */}
      <div className="mb-4">
        <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-2">(−) Despesas Operacionais</p>
        {["Administrativo", "Operacional", "Comercial"].map((g) => {
          const ls = sai.filter((l) => l.grupo === g);
          return ls.length > 0 ? <Secao key={g} titulo={g} grupo={g} lancamentos={ls} /> : null;
        })}
        <Linha label="Total Desp. Operacionais" valor={totalOp} bold sublinha />
      </div>
      <div className="bg-blue-50 rounded-xl p-3 mb-4">
        <Linha label="LUCRO OPERACIONAL" valor={lucroOp} bold cor={lucroOp >= 0 ? "#3B82F6" : "#EF4444"} />
      </div>

      {/* Impostos */}
      <div className="mb-4">
        <p className="text-[12px] font-bold text-red-500 uppercase tracking-wider mb-2">(−) Impostos</p>
        <Secao titulo="Impostos" grupo="Impostos" lancamentos={sai.filter((l) => l.grupo === "Impostos")} />
      </div>
      {outros > 0 && (
        <div className="mb-4">
          <Linha label="Outros" valor={outros} />
        </div>
      )}

      {/* Lucro Líquido */}
      <div className={`rounded-xl p-4 border-2 ${lucroLiq >= 0 ? "border-emerald-400 bg-emerald-50" : "border-red-400 bg-red-50"}`}>
        <div className="flex justify-between items-center">
          <span className="font-extrabold text-[16px]" style={{ color: lucroLiq >= 0 ? "#059669" : "#DC2626" }}>
            LUCRO LÍQUIDO
          </span>
          <div className="text-right">
            <p className="font-extrabold text-[20px]" style={{ color: lucroLiq >= 0 ? "#059669" : "#DC2626" }}>
              {fmtBRL(lucroLiq)}
            </p>
            <p className="text-[12px] font-bold text-slate-500">Margem: {pct(lucroLiq)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab Lançamentos ────────────────────────────────────────────────────────── */
function TabLancamentos({ lancamentos, obras, onEditar, onRemover, onPagar }: {
  lancamentos: Lancamento[];
  obras: Obra[];
  onEditar: (l: Lancamento) => void;
  onRemover: (id: string) => void;
  onPagar: (id: string) => void;
}) {
  const [tipo, setTipo]     = useState<"todos" | "entrada" | "saida">("todos");
  const [obraF, setObraF]   = useState("");
  const [busca, setBusca]   = useState("");
  const [statusF, setStatusF] = useState<"todos" | StatusPagamento>("todos");

  const filtrados = useMemo(() => lancamentos.filter((l) => {
    if (tipo !== "todos" && l.tipo !== tipo) return false;
    if (obraF && l.obra_id !== obraF) return false;
    if (statusF !== "todos" && statusReal(l) !== statusF) return false;
    if (busca && !l.descricao.toLowerCase().includes(busca.toLowerCase()) &&
        !l.categoria.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [lancamentos, tipo, obraF, statusF, busca]);

  const totalFilt = filtrados.reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["todos", "entrada", "saida"] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${tipo === t ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600"}`}>
              {t === "todos" ? "Todos" : t === "entrada" ? "Entradas" : "Saídas"}
            </button>
          ))}
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className="input-base w-36 !py-1.5">
          <option value="todos">Todos status</option>
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
          <option value="vencido">Vencido</option>
        </select>
        <select value={obraF} onChange={(e) => setObraF(e.target.value)} className="input-base w-44 !py-1.5">
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..."
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 w-40" />
        <div className="ml-auto">
          <span className={`text-[13px] font-bold ${totalFilt >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            Saldo filtrado: {totalFilt >= 0 ? "+" : ""}{fmtBRL(Math.abs(totalFilt))}
          </span>
          <span className="text-[11px] text-slate-400 ml-2">({filtrados.length} registros)</span>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Data", "Categoria", "Descrição", "Obra", "Forma Pgto", "Vencimento", "Status", "Valor", ""].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l, i) => {
              const obra = obras.find((o) => o.id === l.obra_id);
              const st   = statusReal(l);
              const isParc = l.parcela_total && l.parcela_total > 1;
              return (
                <tr key={l.id} className={`border-b border-slate-50 hover:bg-slate-50 ${i % 2 === 0 ? "" : "bg-[#FAFBFC]"}`}>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(l.data)}</td>
                  <td className="px-3 py-2.5">
                    {l.categoria ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GRUPOS_COR[l.grupo ?? ""] ?? "#94A3B8" }} />
                        <span className="text-slate-600 truncate max-w-[120px]">{l.categoria}</span>
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {l.descricao}
                    {isParc && <span className="ml-1 text-[10px] text-blue-400">({l.parcela_num}/{l.parcela_total})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 text-[11px]">{obra?.nome ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500">{l.forma_pagamento ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{l.data_vencimento ? fmtDate(l.data_vencimento) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: STATUS_COR[st] }}>
                      {st === "pago" ? "Pago" : st === "pendente" ? "Pendente" : "Vencido"}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${l.tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                    {l.tipo === "entrada" ? "+" : "−"}{fmtBRL(l.valor)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {l.tipo === "saida" && st !== "pago" && (
                        <button
                          onClick={() => onPagar(l.id)}
                          className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                        >
                          ✓ Pago
                        </button>
                      )}
                      <button onClick={() => onEditar(l)} className="text-blue-400 hover:text-blue-600 text-[11px] font-semibold transition-colors">Editar</button>
                      <button onClick={() => onRemover(l.id)} className="text-red-400 hover:text-red-600 text-[11px] font-semibold transition-colors">Excluir</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-[13px]">Nenhum lançamento encontrado.</div>
        )}
      </div>
    </div>
  );
}

/* ─── Modal Lançamentos por Obra ─────────────────────────────────────────────── */
function ModalLancamentosObra({ obra, lancamentos, onClose }: {
  obra: Obra;
  lancamentos: Lancamento[];
  onClose: () => void;
}) {
  const ls  = lancamentos.filter((l) => l.obra_id === obra.id);
  const ent = ls.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
  const sai = ls.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={obra.cliente ?? obra.nome ?? "—"}
        subtitle={`${obra.cidade ?? ""} · ${ls.length} lançamento${ls.length !== 1 ? "s" : ""}`}
        onClose={onClose}
      />
      <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5">Entradas</p>
            <p className="text-[15px] font-extrabold text-emerald-700">{fmtBRL(ent)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-0.5">Saídas</p>
            <p className="text-[15px] font-extrabold text-red-600">{fmtBRL(sai)}</p>
          </div>
          <div className={`rounded-xl p-3 text-center ${ent - sai >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: ent - sai >= 0 ? "#3B82F6" : "#EA580C" }}>Saldo</p>
            <p className="text-[15px] font-extrabold" style={{ color: ent - sai >= 0 ? "#1D4ED8" : "#DC2626" }}>
              {ent - sai >= 0 ? "+" : ""}{fmtBRL(ent - sai)}
            </p>
          </div>
        </div>

        {/* Lista */}
        {ls.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-[13px]">Nenhum lançamento vinculado a esta obra.</p>
        ) : (
          <div className="space-y-1.5">
            {ls.sort((a, b) => b.data.localeCompare(a.data)).map((l) => {
              const st = statusReal(l);
              return (
                <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: l.tipo === "entrada" ? "#10B981" : "#EF4444" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-800 truncate">{l.descricao}</p>
                    <p className="text-[10px] text-slate-400">{l.categoria} · {fmtDate(l.data)}</p>
                  </div>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: STATUS_COR[st] }}
                  >
                    {st === "pago" ? "Pago" : st === "pendente" ? "Pendente" : "Vencido"}
                  </span>
                  <span className={`text-[13px] font-bold flex-shrink-0 ${l.tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                    {l.tipo === "entrada" ? "+" : "−"}{fmtBRL(l.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── Tab Por Obra ───────────────────────────────────────────────────────────── */
function TabPorObra({ lancamentos, obras }: { lancamentos: Lancamento[]; obras: Obra[] }) {
  const [obraModal, setObraModal] = useState<Obra | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-3.5">
        {obras.map((obra) => {
          const ls    = lancamentos.filter((l) => l.obra_id === obra.id);
          const ent   = ls.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
          const sai   = ls.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
          const saldo = ent - sai;
          // Custo vs Valor de Venda
          const valorVenda = obra.valor_venda ?? 0;
          const pctCusto   = valorVenda > 0 ? Math.min((sai / valorVenda) * 100, 100) : 0;
          const corBarra   = pctCusto > 85 ? "#EF4444" : pctCusto > 65 ? "#F59E0B" : "#10B981";

          return (
            <button
              key={obra.id}
              onClick={() => setObraModal(obra)}
              className="card p-4 space-y-3 text-left hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
            >
              {/* Cabeçalho */}
              <div>
                <p className="font-extrabold text-[13px] text-slate-900 leading-tight truncate">{obra.cliente ?? obra.nome ?? "—"}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{obra.cidade ?? "—"}</p>
              </div>

              {/* Saldo em destaque */}
              <div className={`rounded-xl px-3 py-2 text-center ${saldo >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: saldo >= 0 ? "#059669" : "#DC2626" }}>
                  Saldo
                </p>
                <p className="text-[15px] font-extrabold" style={{ color: saldo >= 0 ? "#059669" : "#DC2626" }}>
                  {saldo >= 0 ? "+" : ""}{fmtBRL(saldo)}
                </p>
              </div>

              {/* Entradas / Saídas */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-emerald-50 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Entrada</p>
                  <p className="text-[11px] font-extrabold text-emerald-700">{fmtBRL(ent)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider">Saída</p>
                  <p className="text-[11px] font-extrabold text-red-600">{fmtBRL(sai)}</p>
                </div>
              </div>

              {/* Barra custo vs valor de venda */}
              {valorVenda > 0 ? (
                <div>
                  <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                    <span>Custo vs Venda</span>
                    <span style={{ color: corBarra }}>{pctCusto.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pctCusto}%`, background: corBarra }} />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-0.5">Vl. Venda: {fmtBRL(valorVenda)}</p>
                </div>
              ) : (
                <p className="text-[9px] text-slate-300">Valor de venda não definido</p>
              )}

              <div className="flex items-center justify-between pt-0.5">
                <p className="text-[9px] text-slate-400">{ls.length} lançamento{ls.length !== 1 ? "s" : ""}</p>
                <p className="text-[9px] font-semibold text-blue-500">Ver detalhes →</p>
              </div>
            </button>
          );
        })}
        {obras.length === 0 && (
          <div className="col-span-3 card p-10 text-center text-slate-400 text-[13px]">
            Nenhuma obra cadastrada.
          </div>
        )}
      </div>

      {obraModal && (
        <ModalLancamentosObra
          obra={obraModal}
          lancamentos={lancamentos}
          onClose={() => setObraModal(null)}
        />
      )}
    </>
  );
}

/* ─── SetorFinanceiro (main) ─────────────────────────────────────────────────── */
export default function SetorFinanceiro() {
  const { lancamentos, loading, criar, criarVarios, editar, pagar, remover } = useFinanceiro();
  const [tab, setTab]         = useState<FinTab>("dashboard");
  const [obras, setObras]     = useState<Obra[]>([]);
  const [showModal, setShowModal]   = useState(false);
  const [editLanc, setEditLanc]     = useState<Lancamento | null>(null);
  const [prioridade, setPrioridade] = useState<"avencer" | "vencidos" | null>(null);

  useEffect(() => {
    getObras().then(setObras).catch(() => {});
  }, []);

  const handleSave = useCallback(async (lista: Omit<Lancamento, "id" | "created_at">[]) => {
    if (editLanc) {
      await editar(editLanc.id, lista[0]);
    } else if (lista.length === 1) {
      await criar(lista[0]);
      toast.success("Lançamento criado!");
    } else {
      await criarVarios(lista);
    }
    setShowModal(false);
    setEditLanc(null);
  }, [editLanc, criar, criarVarios, editar]);

  const handleEditar = useCallback((l: Lancamento) => {
    setEditLanc(l);
    setShowModal(true);
  }, []);

  const handleRemover = useCallback(async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    await remover(id);
  }, [remover]);

  const tabs: [FinTab, string][] = [
    ["dashboard",   "📊 Dashboard"],
    ["dre",         "📋 DRE"],
    ["lancamentos", "💳 Lançamentos"],
    ["por_obra",    "🏗 Por Obra"],
  ];

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 flex items-center justify-between py-2">
        <div className="flex gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`tab-btn ${tab === id ? "active" : ""}`}>
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditLanc(null); setShowModal(true); }}
          className="btn-primary text-xs px-3 py-1.5"
        >
          + Lançamento
        </button>
      </div>

      {/* Content */}
      <div className="p-6 max-w-[1400px] mx-auto">
        {loading ? (
          <SkeletonTable />
        ) : (
          <>
            {tab === "dashboard" && (
              <TabDashboard
                lancamentos={lancamentos}
                obras={obras}
                onAbrirPrioridades={(t) => setPrioridade(t)}
                onPagar={pagar}
              />
            )}
            {tab === "dre" && <TabDRE lancamentos={lancamentos} />}
            {tab === "lancamentos" && (
              <TabLancamentos
                lancamentos={lancamentos}
                obras={obras}
                onEditar={handleEditar}
                onRemover={handleRemover}
                onPagar={pagar}
              />
            )}
            {tab === "por_obra" && <TabPorObra lancamentos={lancamentos} obras={obras} />}
          </>
        )}
      </div>

      {/* Modais */}
      {showModal && (
        <ModalLancamento
          initial={editLanc}
          obras={obras}
          onClose={() => { setShowModal(false); setEditLanc(null); }}
          onSave={handleSave}
        />
      )}
      {prioridade && (
        <ModalPrioridades
          tipo={prioridade}
          lancamentos={lancamentos}
          onClose={() => setPrioridade(null)}
        />
      )}
    </div>
  );
}
