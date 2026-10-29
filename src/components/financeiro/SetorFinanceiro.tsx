"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { useMetas } from "@/hooks/useMetas";
import { usePermissoes } from "@/hooks/usePermissoes";
import { getObras } from "@/services/obras.service";
import { getContasBancarias, createContaBancaria, deleteContaBancaria } from "@/services/contas-bancarias.service";
import { getRecebimentos, createRecebimento } from "@/services/recebimentos.service";
import { calcularCronogramaMensal, custoMaximoPermitido, calcularPrevistoNoPeriodo, calcularFluxoCaixaPeriodo } from "@/lib/cronogramaFinanceiro";
import { calcularVisaoGeralObra } from "@/lib/visaoGeralObra";
import { useEmpresaContexto } from "@/hooks/useEmpresaContexto";
import { baixarPdf } from "@/lib/pdf/baixarPdf";
import { gerarRelatorioVisaoGeral } from "@/lib/pdf/relatorios/visaoGeral";
import { gerarRelatorioFluxoCaixa } from "@/lib/pdf/relatorios/fluxoCaixa";
import { gerarRelatorioOrcadoRealizado } from "@/lib/pdf/relatorios/orcadoRealizado";
import { gerarRelatorioLancamentos } from "@/lib/pdf/relatorios/lancamentos";
import { cn, compareValues, fmtBRL, fmtDate, nextSort, diasAteVencer, statusReal, type SortState } from "@/lib/utils";
import {
  Kpi, GraficoFluxo, GraficoCustos, PizzaVencimentos, ultimos6Meses, varPct,
  type FiltroVenc, FILTRO_VENC_LABEL, FILTRO_VENC_COR, filtraVencimentos,
} from "@/components/financeiro/GraficosFinanceiro";
import Button from "@/components/ui/Button";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import CurrencyInput from "@/components/ui/CurrencyInput";
import {
  CATEGORIAS_SAIDA, CATEGORIAS_ENTRADA, GRUPOS_COR,
  FORMAS_PAGAMENTO, GRUPO_DE_CATEGORIA, GRUPOS_SAIDA_DRE, GRUPOS_SAIDA_ORDEM,
} from "@/constants/financeiro";
import type { ContaBancaria, Lancamento, Obra, StatusPagamento, Recebimento, OrigemRecebimento } from "@/types/app.types";
import toast from "react-hot-toast";

/* ─── helpers ────────────────────────────────────────────────────────────────── */
type FinTab = "dashboard" | "dre" | "lancamentos" | "por_obra";

function hoje(): string { return new Date().toISOString().slice(0, 10); }

const STATUS_COR: Record<StatusPagamento, string> = {
  pago:    "#10B981",
  pendente:"#F59E0B",
  vencido: "#EF4444",
};

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

/* ─── ícone lixeira SVG ──────────────────────────────────────────────────────── */
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6.5v4M8.5 6.5v4M3 3.5l.667 7.5a.5.5 0 00.5.5h5.667a.5.5 0 00.5-.5L11 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Botão "Gerar Relatório" (reutilizado em todas as abas) ─────────────────── */
function BotaoGerarRelatorio({ onClick }: { onClick: () => void | Promise<void> }) {
  const [gerando, setGerando] = useState(false);
  const handleClick = async () => {
    setGerando(true);
    try { await onClick(); } catch { toast.error("Erro ao gerar relatório"); } finally { setGerando(false); }
  };
  return (
    <button
      onClick={handleClick}
      disabled={gerando}
      className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5"
    >
      {gerando ? "Gerando..." : "📄 Gerar Relatório"}
    </button>
  );
}

/* ─── sub-modal: Gerenciar Contas Bancárias ─────────────────────────────────── */
function ModalNovaContaBancaria({ onClose, onSaved, onDeleted, contasBancarias }: {
  onClose: () => void;
  onSaved: (c: ContaBancaria) => void;
  onDeleted: (id: string) => void;
  contasBancarias: ContaBancaria[];
}) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const nova = await createContaBancaria(nome);
      toast.success("Conta cadastrada!");
      setNome("");
      onSaved(nova);
    } catch {
      toast.error("Erro ao cadastrar conta");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteContaBancaria(id);
      onDeleted(id);
    } catch {
      toast.error("Erro ao remover conta");
    } finally { setDeletingId(null); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Gerenciar Contas / Bancos" onClose={onClose} />
      <div className="p-5 space-y-4">
        {/* Lista existente */}
        <div>
          <p className="field-label mb-2">Cadastradas ({contasBancarias.length})</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {contasBancarias.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhuma conta cadastrada</p>
            )}
            {contasBancarias.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="text-sm text-slate-700">{c.nome}</span>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  title="Remover conta"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5 flex-shrink-0 ml-2"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Formulário de adição */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="field-label">Adicionar Nova</p>
          <div>
            <label className="field-label">Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input-base" placeholder="Ex: Santander, Nubank - PJ, Dinheiro" />
          </div>
          <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>Cadastrar</Button>
        </div>

        <Button variant="secondary" className="w-full" onClick={onClose} size="sm">Fechar</Button>
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
  const [valor, setValor]         = useState(initial?.valor ?? 0);
  const [data, setData]           = useState(initial?.data ?? hoje());
  const [dataVenc, setDataVenc]   = useState(initial?.data_vencimento ?? "");
  const [forma, setForma]         = useState(initial?.forma_pagamento ?? "Pix");
  const [status, setStatus]       = useState<StatusPagamento>(initial?.status_pagamento ?? "pendente");
  const [obraId, setObraId]       = useState(initial?.obra_id ?? "");
  const [obs, setObs]             = useState(initial?.obs ?? "");
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contaBancariaId, setContaBancariaId] = useState(initial?.conta_bancaria_id ?? "");
  const [showNovaConta, setShowNovaConta]     = useState(false);
  const [parcelado, setParcelado]       = useState(false);
  const [nParc, setNParc]               = useState(2);
  const [parcDatas, setParcDatas]       = useState<string[]>([]);
  const [showPreview, setShowPreview]   = useState(false);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    getContasBancarias().then(setContasBancarias).catch(() => {});
  }, []);

  const cats = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
  const grupo = GRUPO_DE_CATEGORIA[categoria] ?? "";
  const grupoCor = GRUPOS_COR[grupo] ?? "#94A3B8";
  const valorParc = parcelado && nParc > 0 ? valor / nParc : valor;

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
    if (valor <= 0)        { toast.error("Informe o valor"); return; }
    if (!data)             { toast.error("Informe a data"); return; }
    if (!categoria)        { toast.error("Selecione a categoria"); return; }

    setSaving(true);
    try {
      if (parcelado && !isEdit) {
        const lista = parcDatas.map((d, i) => ({
          tipo, categoria, grupo: GRUPO_DE_CATEGORIA[categoria] ?? null,
          descricao: `${descricao} (${i + 1}/${nParc})`,
          valor: Math.round((valor / nParc) * 100) / 100,
          data: d, data_vencimento: d || null, data_confirmacao: null,
          forma_pagamento: forma, status_pagamento: "pendente" as StatusPagamento,
          parcela_num: i + 1, parcela_total: nParc,
          obra_id: obraId || null, servico_id: null, conta_bancaria_id: contaBancariaId || null, obs: obs || null,
        }));
        await onSave(lista);
      } else {
        await onSave([{
          tipo, categoria, grupo: GRUPO_DE_CATEGORIA[categoria] ?? null,
          descricao, valor, data,
          data_vencimento: dataVenc || null, data_confirmacao: null,
          forma_pagamento: forma, status_pagamento: tipo === "entrada" ? "pago" : status,
          parcela_num: null, parcela_total: null,
          obra_id: obraId || null, servico_id: null, conta_bancaria_id: contaBancariaId || null, obs: obs || null,
        }]);
      }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <>
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
            <CurrencyInput
              value={valor}
              onChange={setValor}
              className={`font-bold ${tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}
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

        {/* Obra + Conta Bancária */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Obra (opcional)</label>
            <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="input-base">
              <option value="">Sem obra</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente ?? o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Conta / Banco (opcional)</label>
            <div className="flex gap-1.5">
              <select value={contaBancariaId} onChange={(e) => setContaBancariaId(e.target.value)} className="input-base flex-1">
                <option value="">Sem conta</option>
                {contasBancarias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowNovaConta(true)}
                title="Cadastrar nova conta"
                className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-500 flex items-center justify-center text-lg font-bold transition-colors"
              >+</button>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="field-label">Observações</label>
          <input value={obs} onChange={(e) => setObs(e.target.value)} className="input-base" placeholder="Opcional" />
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
        {showPreview && !parcelado && valor > 0 && (
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
                {tipo === "entrada" ? "+" : "−"}{fmtBRL(valor)}
              </span>
            </div>
            {dataVenc && <div className="flex justify-between"><span className="text-slate-500">Vencimento</span><span>{fmtDate(dataVenc)}</span></div>}
            {obraId && <div className="flex justify-between"><span className="text-slate-500">Obra</span><span>{obras.find(o => o.id === obraId)?.cliente ?? obras.find(o => o.id === obraId)?.nome}</span></div>}
            {contaBancariaId && <div className="flex justify-between"><span className="text-slate-500">Conta</span><span>{contasBancarias.find(c => c.id === contaBancariaId)?.nome}</span></div>}
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
    {showNovaConta && (
      <ModalNovaContaBancaria
        contasBancarias={contasBancarias}
        onClose={() => setShowNovaConta(false)}
        onSaved={(nova) => {
          setContasBancarias((prev) => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
          setContaBancariaId(nova.id);
          setShowNovaConta(false);
        }}
        onDeleted={(id) => {
          setContasBancarias((prev) => prev.filter((c) => c.id !== id));
          setContaBancariaId((prev) => (prev === id ? "" : prev));
        }}
      />
    )}
    </>
  );
}

/* ─── Modal Filtro Vencimentos ───────────────────────────────────────────────── */

function ModalFiltroVencimentos({ filtro, lancamentos, obras, onPagar, onClose }: {
  filtro: FiltroVenc;
  lancamentos: Lancamento[];
  obras: Obra[];
  onPagar: (id: string) => void;
  onClose: () => void;
}) {
  const lista = filtraVencimentos(lancamentos, "saida", filtro)
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
  const total = lista.reduce((s, l) => s + l.valor, 0);
  const cor   = FILTRO_VENC_COR[filtro];

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={FILTRO_VENC_LABEL[filtro]}
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
  const metas = useMetas();
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

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5">
        <Kpi
          label="Receita Total"
          valor={fmtBRL(totalRec)}
          cor="#10B981"
          variacao={varPct(recAtual, recAnter)}
          meta={metas.financeiro_receita_total !== undefined ? varPct(recAtual, metas.financeiro_receita_total) : undefined}
          metaLabel={metas.financeiro_receita_total !== undefined ? `meta ${fmtBRL(metas.financeiro_receita_total)}` : undefined}
        />
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
            lancamentos={lancamentos}
            tipo="saida"
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
type LancSortKey = "data" | "categoria" | "descricao" | "obra" | "forma_pagamento" | "data_vencimento" | "status" | "valor";

const LANC_COLUNAS: { key: LancSortKey; label: string }[] = [
  { key: "data",            label: "Data" },
  { key: "categoria",       label: "Categoria" },
  { key: "descricao",       label: "Descrição" },
  { key: "obra",            label: "Obra" },
  { key: "forma_pagamento", label: "Forma Pgto" },
  { key: "data_vencimento", label: "Vencimento" },
  { key: "status",          label: "Status" },
  { key: "valor",           label: "Valor" },
];

const STATUS_ORDEM: Record<StatusPagamento, number> = { pago: 0, pendente: 1, vencido: 2 };

function lancSortValue(l: Lancamento, key: LancSortKey, obras: Obra[]): string | number | null {
  switch (key) {
    case "data":            return l.data ? new Date(l.data).getTime() : null;
    case "categoria":       return l.categoria;
    case "descricao":       return l.descricao;
    case "obra":            { const o = obras.find((o) => o.id === l.obra_id); return o ? (o.cliente ?? o.nome) : null; }
    case "forma_pagamento": return l.forma_pagamento;
    case "data_vencimento": return l.data_vencimento ? new Date(l.data_vencimento).getTime() : null;
    case "status":          return STATUS_ORDEM[statusReal(l)];
    // Saídas contam como negativo, assim "maior" e "menor" refletem o impacto no caixa.
    case "valor":           return l.tipo === "entrada" ? l.valor : -l.valor;
  }
}

interface FiltroLancamentos {
  tipo: "todos" | "entrada" | "saida";
  statusF: "todos" | StatusPagamento;
  obraF: string;
  busca: string;
  categoriaF: string;
  formaPagamentoF: string;
  contaBancariaF: string;
  dataDeF: string;
  dataAteF: string;
  valorMinF: string;
  valorMaxF: string;
}

const FAVORITOS_KEY = "obraflow_financeiro_filtros_favoritos";

function getFavoritos(): { nome: string; filtro: FiltroLancamentos }[] {
  try { return JSON.parse(localStorage.getItem(FAVORITOS_KEY) ?? "[]"); } catch { return []; }
}

function TabLancamentos({ lancamentos, obras, onEditar, onRemover, onPagar }: {
  lancamentos: Lancamento[];
  obras: Obra[];
  onEditar: (l: Lancamento) => void;
  onRemover: (id: string) => void;
  onPagar: (id: string) => void;
}) {
  const { pode } = usePermissoes();
  const [tipo, setTipo]     = useState<"todos" | "entrada" | "saida">("todos");
  const [obraF, setObraF]   = useState("");
  const [busca, setBusca]   = useState("");
  const [statusF, setStatusF] = useState<"todos" | StatusPagamento>("todos");
  const [categoriaF, setCategoriaF] = useState("");
  const [formaPagamentoF, setFormaPagamentoF] = useState("");
  const [contaBancariaF, setContaBancariaF] = useState("");
  const [dataDeF, setDataDeF] = useState("");
  const [dataAteF, setDataAteF] = useState("");
  const [valorMinF, setValorMinF] = useState("");
  const [valorMaxF, setValorMaxF] = useState("");
  const [sort, setSort] = useState<SortState<LancSortKey> | null>(null);

  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  useEffect(() => { getContasBancarias().then(setContasBancarias).catch(() => {}); }, []);

  const [favoritos, setFavoritos] = useState<{ nome: string; filtro: FiltroLancamentos }[]>([]);
  const [favoritoSelecionado, setFavoritoSelecionado] = useState("");
  useEffect(() => { setFavoritos(getFavoritos()); }, []);

  const categoriasDisponiveis = useMemo(
    () => [...new Set(lancamentos.map((l) => l.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [lancamentos]
  );

  const filtrados = useMemo(() => lancamentos.filter((l) => {
    if (tipo !== "todos" && l.tipo !== tipo) return false;
    if (obraF && l.obra_id !== obraF) return false;
    if (statusF !== "todos" && statusReal(l) !== statusF) return false;
    if (categoriaF && l.categoria !== categoriaF) return false;
    if (formaPagamentoF && l.forma_pagamento !== formaPagamentoF) return false;
    if (contaBancariaF && l.conta_bancaria_id !== contaBancariaF) return false;
    if (dataDeF && l.data < dataDeF) return false;
    if (dataAteF && l.data > dataAteF) return false;
    if (valorMinF && l.valor < Number(valorMinF)) return false;
    if (valorMaxF && l.valor > Number(valorMaxF)) return false;
    if (busca && !l.descricao.toLowerCase().includes(busca.toLowerCase()) &&
        !l.categoria.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [lancamentos, tipo, obraF, statusF, categoriaF, formaPagamentoF, contaBancariaF, dataDeF, dataAteF, valorMinF, valorMaxF, busca]);

  const totalFilt = filtrados.reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);

  const { empresaNome, usuarioNome } = useEmpresaContexto();
  const handleGerarRelatorioLancamentos = async () => {
    const doc = gerarRelatorioLancamentos(
      { empresaNome, usuarioNome, obraCliente: obraF ? (obras.find((o) => o.id === obraF)?.cliente ?? "—") : "Todas as obras (filtro aplicado)", obraCidade: null },
      ordenados, obras
    );
    await baixarPdf(doc, "lancamentos-financeiro");
  };

  const ordenados = useMemo(() => {
    if (!sort) return filtrados;
    const mult = sort.dir === "asc" ? 1 : -1;
    return [...filtrados].sort((a, b) => mult * compareValues(lancSortValue(a, sort.key, obras), lancSortValue(b, sort.key, obras)));
  }, [filtrados, sort, obras]);

  const aplicarFiltro = (f: FiltroLancamentos) => {
    setTipo(f.tipo); setStatusF(f.statusF); setObraF(f.obraF); setBusca(f.busca);
    setCategoriaF(f.categoriaF); setFormaPagamentoF(f.formaPagamentoF); setContaBancariaF(f.contaBancariaF);
    setDataDeF(f.dataDeF); setDataAteF(f.dataAteF); setValorMinF(f.valorMinF); setValorMaxF(f.valorMaxF);
  };

  const handleSalvarFavorito = () => {
    const nome = window.prompt("Nome desse filtro:");
    if (!nome?.trim()) return;
    const filtroAtual: FiltroLancamentos = {
      tipo, statusF, obraF, busca, categoriaF, formaPagamentoF, contaBancariaF, dataDeF, dataAteF, valorMinF, valorMaxF,
    };
    const novos = [...favoritos.filter((f) => f.nome !== nome.trim()), { nome: nome.trim(), filtro: filtroAtual }];
    setFavoritos(novos);
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify(novos));
    toast.success("Filtro salvo!");
  };

  const handleRemoverFavorito = (nome: string) => {
    const novos = favoritos.filter((f) => f.nome !== nome);
    setFavoritos(novos);
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify(novos));
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="card p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
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
            <option value="pendente">A vencer</option>
            <option value="vencido">Vencido</option>
          </select>
          <select value={obraF} onChange={(e) => setObraF(e.target.value)} className="input-base w-44 !py-1.5">
            <option value="">Todas as obras</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.cliente ?? o.nome}</option>)}
          </select>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 w-40" />
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-[13px] font-bold ${totalFilt >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              Saldo filtrado: {totalFilt >= 0 ? "+" : ""}{fmtBRL(Math.abs(totalFilt))}
            </span>
            <span className="text-[11px] text-slate-400">({filtrados.length} registros)</span>
            <BotaoGerarRelatorio onClick={handleGerarRelatorioLancamentos} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center border-t border-slate-100 pt-2">
          <select value={categoriaF} onChange={(e) => setCategoriaF(e.target.value)} className="input-base w-40 !py-1.5">
            <option value="">Todas categorias</option>
            {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={formaPagamentoF} onChange={(e) => setFormaPagamentoF(e.target.value)} className="input-base w-36 !py-1.5">
            <option value="">Toda forma pgto</option>
            {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={contaBancariaF} onChange={(e) => setContaBancariaF(e.target.value)} className="input-base w-36 !py-1.5">
            <option value="">Toda conta</option>
            {contasBancarias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <input type="date" value={dataDeF} onChange={(e) => setDataDeF(e.target.value)} className="input-base !py-1.5 !text-[11px]" />
            <span className="text-slate-400 text-[11px]">até</span>
            <input type="date" value={dataAteF} onChange={(e) => setDataAteF(e.target.value)} className="input-base !py-1.5 !text-[11px]" />
          </div>
          <div className="flex items-center gap-1">
            <input type="number" value={valorMinF} onChange={(e) => setValorMinF(e.target.value)} placeholder="Valor mín."
              className="input-base w-24 !py-1.5 !text-[11px]" />
            <span className="text-slate-400 text-[11px]">–</span>
            <input type="number" value={valorMaxF} onChange={(e) => setValorMaxF(e.target.value)} placeholder="Valor máx."
              className="input-base w-24 !py-1.5 !text-[11px]" />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {favoritos.length > 0 && (
              <div className="flex items-center gap-1">
                <select
                  value={favoritoSelecionado}
                  onChange={(e) => {
                    setFavoritoSelecionado(e.target.value);
                    const f = favoritos.find((x) => x.nome === e.target.value);
                    if (f) aplicarFiltro(f.filtro);
                  }}
                  className="input-base w-40 !py-1.5 !text-[11px]"
                >
                  <option value="">⭐ Filtros favoritos</option>
                  {favoritos.map((f) => <option key={f.nome} value={f.nome}>{f.nome}</option>)}
                </select>
                {favoritoSelecionado && (
                  <button
                    onClick={() => { handleRemoverFavorito(favoritoSelecionado); setFavoritoSelecionado(""); }}
                    title="Remover este filtro favorito"
                    className="text-slate-300 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                  >
                    <IconTrash />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={handleSalvarFavorito}
              title="Salvar filtro atual como favorito"
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              ☆ Salvar filtro
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {LANC_COLUNAS.map((c) => (
                <th key={c.key} className="px-3 py-2.5 text-left whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSort((s) => nextSort(s, c.key))}
                    className={cn(
                      "flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer",
                      "text-[10px] font-bold tracking-wide transition-colors",
                      sort?.key === c.key ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {c.label}
                    <span className="text-[9px]">{sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {ordenados.map((l, i) => {
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
                  <td className="px-3 py-2.5 text-slate-400 text-[11px]">{obra?.cliente ?? obra?.nome ?? "—"}</td>
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
                      {pode("financeiro", "editar") && (
                        <button onClick={() => onEditar(l)} className="text-blue-400 hover:text-blue-600 text-[11px] font-semibold transition-colors">Editar</button>
                      )}
                      {pode("financeiro", "excluir") && (
                        <button onClick={() => onRemover(l.id)} className="text-red-400 hover:text-red-600 text-[11px] font-semibold transition-colors">Excluir</button>
                      )}
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
type SubTabObra = "visao_geral" | "fluxo_caixa" | "orcado_realizado" | "lancamentos" | "recebimentos";
const SUB_TABS_OBRA: SubTabObra[] = ["visao_geral", "fluxo_caixa", "orcado_realizado", "lancamentos", "recebimentos"];

function ModalLancamentosObra({ obra, lancamentos, onClose, onLancamentoCriado, initialSubTab }: {
  obra: Obra;
  lancamentos: Lancamento[];
  onClose: () => void;
  onLancamentoCriado: (l: Lancamento) => void;
  initialSubTab?: string;
}) {
  const { empresaNome, usuarioNome } = useEmpresaContexto();
  const subTabValido = SUB_TABS_OBRA.includes(initialSubTab as SubTabObra) ? (initialSubTab as SubTabObra) : "visao_geral";
  const [subTab, setSubTab] = useState<SubTabObra>(subTabValido);
  const ls  = lancamentos.filter((l) => l.obra_id === obra.id);
  const ent = ls.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
  const sai = ls.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);

  const handleGerarRelatorioLancamentos = async () => {
    const doc = gerarRelatorioLancamentos(
      { empresaNome, usuarioNome, obraCliente: obra.cliente ?? obra.nome ?? "—", obraCidade: obra.cidade },
      ls, [obra]
    );
    await baixarPdf(doc, `lancamentos-${obra.cliente ?? obra.nome ?? "obra"}`);
  };

  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [recebLoading, setRecebLoading] = useState(true);
  useEffect(() => {
    getRecebimentos(obra.id).then(setRecebimentos).catch(() => {}).finally(() => setRecebLoading(false));
  }, [obra.id]);

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={obra.cliente ?? obra.nome ?? "—"}
        subtitle={`${obra.cidade ?? ""} · ${ls.length} lançamento${ls.length !== 1 ? "s" : ""}`}
        onClose={onClose}
      />
      <div className="px-5 pt-3 flex gap-1 border-b border-slate-100">
        {([["visao_geral", "Visão Geral"], ["fluxo_caixa", "Fluxo de Caixa"], ["orcado_realizado", "Orçado × Realizado"], ["lancamentos", "Lançamentos"], ["recebimentos", "Recebimentos"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-3 py-2 text-[12px] font-bold border-b-2 transition-colors ${
              subTab === id ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
        {subTab === "visao_geral" ? (
          <AbaVisaoGeralObra obra={obra} lancamentosObra={ls} recebimentos={recebimentos} recebLoading={recebLoading} />
        ) : subTab === "fluxo_caixa" ? (
          <AbaFluxoCaixaObra obra={obra} lancamentosObra={ls} />
        ) : subTab === "orcado_realizado" ? (
          <AbaOrcadoRealizadoObra obra={obra} lancamentosObra={ls} />
        ) : subTab === "lancamentos" ? (
          <>
            <div className="flex justify-end">
              <BotaoGerarRelatorio onClick={handleGerarRelatorioLancamentos} />
            </div>

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
          </>
        ) : (
          <AbaRecebimentosObra
            obra={obra}
            recebimentos={recebimentos}
            loading={recebLoading}
            onRecebimentoCriado={(r) => setRecebimentos((prev) => [r, ...prev])}
            onLancamentoCriado={onLancamentoCriado}
          />
        )}
      </div>
    </Modal>
  );
}

/* ─── Fluxo de Caixa por Obra ──────────────────────────────────────────────────── */
type PeriodoFluxo = "hoje" | "7d" | "30d" | "personalizado";

function AbaFluxoCaixaObra({ obra, lancamentosObra }: { obra: Obra; lancamentosObra: Lancamento[] }) {
  const [periodo, setPeriodo] = useState<PeriodoFluxo>("30d");
  const hojeStr = new Date().toISOString().slice(0, 10);
  const [dataIni, setDataIni] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(hojeStr);

  const { empresaNome, usuarioNome } = useEmpresaContexto();

  const { inicio, fim } = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (periodo === "hoje") return { inicio: new Date(hoje), fim: new Date(hoje) };
    if (periodo === "7d") { const i = new Date(hoje); i.setDate(i.getDate() - 6); return { inicio: i, fim: new Date(hoje) }; }
    if (periodo === "30d") { const i = new Date(hoje); i.setDate(i.getDate() - 29); return { inicio: i, fim: new Date(hoje) }; }
    return { inicio: new Date(`${dataIni}T00:00:00`), fim: new Date(`${dataFim}T00:00:00`) };
  }, [periodo, dataIni, dataFim]);

  const lancsNoPeriodo = lancamentosObra.filter((l) => {
    const d = new Date(`${l.data}T00:00:00`);
    return d >= inicio && d <= fim;
  });

  const {
    entradasPrevistas, saidasPrevistas, saldoPrevisto,
    entradasRecebidas, saidasRealizadas, saldoRealizado, saldoFuturo,
  } = calcularFluxoCaixaPeriodo(obra, lancamentosObra, inicio, fim);
  const temPrevisao = (obra.cronograma_financeiro?.length ?? 0) > 0 && !!obra.data_inicio;

  const totalDias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
  // O gráfico não tem espaço pra rótulo "DD/MM" em muitas barras — acima de
  // ~10 dias agrupa por semana, e acima de ~5 meses agrupa por mês (senão
  // datas/semanas se sobrepõem).
  const granularidade: "dia" | "semana" | "mes" = totalDias > 150 ? "mes" : totalDias > 10 ? "semana" : "dia";
  const buckets: { label: string; ent: number; sai: number }[] = [];

  if (granularidade === "mes") {
    let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    while (cursor <= fim) {
      const mesFim = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const doPeriodo = lancsNoPeriodo.filter((l) => {
        const d = new Date(`${l.data}T00:00:00`);
        return d >= cursor && d <= mesFim && l.status_pagamento === "pago";
      });
      buckets.push({
        label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        ent: doPeriodo.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0),
        sai: doPeriodo.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else if (granularidade === "semana") {
    let cursor = new Date(inicio);
    let semana = 1;
    while (cursor <= fim) {
      const semFim = new Date(cursor); semFim.setDate(semFim.getDate() + 6);
      const fimReal = semFim > fim ? fim : semFim;
      const doPeriodo = lancsNoPeriodo.filter((l) => {
        const d = new Date(`${l.data}T00:00:00`);
        return d >= cursor && d <= fimReal && l.status_pagamento === "pago";
      });
      buckets.push({
        label: `S${semana}`,
        ent: doPeriodo.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0),
        sai: doPeriodo.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0),
      });
      cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 7);
      semana++;
    }
  } else {
    for (let i = 0; i < totalDias; i++) {
      const d = new Date(inicio); d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const doDia = lancsNoPeriodo.filter((l) => l.data === key && l.status_pagamento === "pago");
      buckets.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        ent: doDia.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0),
        sai: doDia.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0),
      });
    }
  }

  const Kpi = ({ label, valor, cor }: { label: string; valor: string; cor?: string }) => (
    <div className="card p-3 text-center">
      <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider leading-tight">{label}</p>
      <p className="text-[14px] font-extrabold" style={{ color: cor }}>{valor}</p>
    </div>
  );

  const handleGerarRelatorio = async () => {
    const doc = gerarRelatorioFluxoCaixa(
      { empresaNome, usuarioNome, obraCliente: obra.cliente ?? obra.nome ?? "—", obraCidade: obra.cidade },
      obra, lancamentosObra, inicio, fim
    );
    await baixarPdf(doc, `fluxo-de-caixa-${obra.cliente ?? obra.nome ?? "obra"}`);
  };

  return (
    <div className="space-y-4">
      {/* Filtro de período */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["personalizado", "Personalizado"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPeriodo(id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
              periodo === id ? "bg-blue-500 border-blue-500 text-white" : "border-slate-200 text-slate-500 hover:border-blue-300"
            }`}
          >
            {label}
          </button>
        ))}
        {periodo === "personalizado" && (
          <div className="flex items-center gap-1.5">
            <input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="input-base !py-1 !text-[11px]" />
            <span className="text-slate-400 text-[11px]">até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="input-base !py-1 !text-[11px]" />
          </div>
        )}
        <div className="ml-auto">
          <BotaoGerarRelatorio onClick={handleGerarRelatorio} />
        </div>
      </div>

      {!temPrevisao && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Essa obra não tem Cronograma Financeiro configurado (ou falta a Data de Assinatura) — os valores previstos aparecem zerados.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2.5">
        <Kpi label="Entradas Previstas" valor={fmtBRL(entradasPrevistas)} />
        <Kpi label="Entradas Recebidas" valor={fmtBRL(entradasRecebidas)} cor="#059669" />
        <Kpi label="Saídas Previstas" valor={fmtBRL(saidasPrevistas)} />
        <Kpi label="Saídas Realizadas" valor={fmtBRL(saidasRealizadas)} cor="#DC2626" />
        <Kpi label="Saldo Previsto" valor={fmtBRL(saldoPrevisto)} cor={saldoPrevisto >= 0 ? "#059669" : "#DC2626"} />
        <Kpi label="Saldo Realizado" valor={fmtBRL(saldoRealizado)} cor={saldoRealizado >= 0 ? "#059669" : "#DC2626"} />
        <Kpi label="Saldo Futuro (acumulado)" valor={fmtBRL(saldoFuturo)} cor={saldoFuturo >= 0 ? "#3B82F6" : "#DC2626"} />
      </div>

      {/* Gráfico */}
      <div className="card p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-3">
          Fluxo {granularidade === "mes" ? "por Mês" : granularidade === "semana" ? "por Semana" : "por Dia"} — {fmtDate(inicio.toISOString().slice(0, 10))} a {fmtDate(fim.toISOString().slice(0, 10))}
        </p>
        {buckets.every((b) => b.ent === 0 && b.sai === 0) ? (
          <p className="text-center text-slate-400 py-8 text-[13px]">Nenhum lançamento pago nesse período.</p>
        ) : (
          <GraficoFluxo dados={buckets} />
        )}
      </div>
    </div>
  );
}

/* ─── Visão Geral por Obra (KPIs) ─────────────────────────────────────────────── */
function AbaVisaoGeralObra({ obra, lancamentosObra, recebimentos, recebLoading }: {
  obra: Obra; lancamentosObra: Lancamento[]; recebimentos: Recebimento[]; recebLoading: boolean;
}) {
  const {
    valorVenda, valorFinanciado, recursosProprios, subsidio,
    receitaRecebida, receitaPendente: receitaPendenteLanc, custoPrevisto, custoRealizado, saldoDisponivel,
    lucroPrevisto, lucroAtual, margemAtual, pctFinanceiro, pctCaixa, pctCliente, totalAReceber,
  } = calcularVisaoGeralObra(obra, lancamentosObra, recebimentos);

  const { empresaNome, usuarioNome } = useEmpresaContexto();
  const handleGerarRelatorio = async () => {
    const doc = gerarRelatorioVisaoGeral(
      { empresaNome, usuarioNome, obraCliente: obra.cliente ?? obra.nome ?? "—", obraCidade: obra.cidade },
      obra, lancamentosObra, recebimentos
    );
    await baixarPdf(doc, `visao-geral-${obra.cliente ?? obra.nome ?? "obra"}`);
  };

  const Kpi = ({ label, valor, cor }: { label: string; valor: string; cor?: string }) => (
    <div className="card p-3 text-center">
      <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider leading-tight">{label}</p>
      <p className="text-[14px] font-extrabold" style={{ color: cor }}>{valor}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <BotaoGerarRelatorio onClick={handleGerarRelatorio} />
      </div>

      {/* Composição da venda */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Composição da Venda</p>
        <div className="grid grid-cols-4 gap-2">
          <Kpi label="Valor de Venda" valor={fmtBRL(valorVenda)} cor="#059669" />
          <Kpi label="Valor Financiado" valor={fmtBRL(valorFinanciado)} cor="#0891B2" />
          <Kpi label="Recursos Próprios" valor={fmtBRL(recursosProprios)} cor="#334155" />
          <Kpi label="Subsídio" valor={fmtBRL(subsidio)} cor="#9333EA" />
        </div>
      </div>

      {/* Receita e Custo */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Receita e Custo</p>
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Receita Prevista" valor={fmtBRL(valorVenda)} />
          <Kpi label="Receita Recebida" valor={fmtBRL(receitaRecebida)} cor="#059669" />
          <Kpi label="Receita Pendente" valor={fmtBRL(receitaPendenteLanc)} cor="#D97706" />
          <Kpi label="Custo Previsto" valor={fmtBRL(custoPrevisto)} />
          <Kpi label="Custo Realizado" valor={fmtBRL(custoRealizado)} cor="#DC2626" />
          <Kpi label="Saldo Disponível" valor={fmtBRL(saldoDisponivel)} cor={saldoDisponivel >= 0 ? "#059669" : "#DC2626"} />
        </div>
      </div>

      {/* Lucro */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Lucro</p>
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Lucro Previsto" valor={fmtBRL(lucroPrevisto)} />
          <Kpi label="Lucro Atual" valor={fmtBRL(lucroAtual)} cor={lucroAtual >= 0 ? "#059669" : "#DC2626"} />
          <Kpi label="Margem Atual" valor={`${margemAtual.toFixed(1)}%`} cor={margemAtual >= 0 ? "#059669" : "#DC2626"} />
        </div>
      </div>

      {/* Recebimento */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recebimento</p>
        {recebLoading ? (
          <p className="text-center text-slate-400 py-4 text-[12px]">Carregando...</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <Kpi label="% Financeiro da Obra" valor={`${pctFinanceiro.toFixed(1)}%`} />
            <Kpi label="Recebimento Caixa" valor={`${pctCaixa.toFixed(1)}%`} />
            <Kpi label="Recebimento Cliente" valor={`${pctCliente.toFixed(1)}%`} />
            <Kpi label="Total a Receber" valor={fmtBRL(totalAReceber)} cor="#D97706" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Orçado × Realizado por Obra ─────────────────────────────────────────────── */
function AbaOrcadoRealizadoObra({ obra, lancamentosObra }: { obra: Obra; lancamentosObra: Lancamento[] }) {
  const { empresaNome, usuarioNome } = useEmpresaContexto();
  const linhas = calcularCronogramaMensal(obra, lancamentosObra);
  const custoMaximo = custoMaximoPermitido(obra);
  const temCronograma = (obra.cronograma_financeiro?.length ?? 0) > 0;
  const temDataInicio = !!obra.data_inicio;

  if (!temCronograma) {
    return (
      <p className="text-center text-slate-400 py-8 text-[13px]">
        Essa obra ainda não tem um Cronograma Financeiro configurado — cadastre em Obras → aba &quot;Cronograma Físico-Financeiro&quot;.
      </p>
    );
  }

  const valorVenda = obra.valor_venda ?? 0;

  // "Até agora" = só os meses que já começaram, não o cronograma inteiro
  // (senão sempre bate com o total, não diz nada sobre o momento atual).
  const linhasAteAgora = temDataInicio ? linhas.filter((l) => l.jaComecou) : linhas;

  const totalEntradaPrevisto = linhasAteAgora.reduce((s, l) => s + l.entradaPrevisto, 0);
  const totalEntradaReal = linhasAteAgora.reduce((s, l) => s + (l.entradaReal ?? 0), 0);
  const pctRecebido = totalEntradaPrevisto > 0 ? Math.min((totalEntradaReal / totalEntradaPrevisto) * 100, 999) : 0;
  const abaixoDoPrevisto = totalEntradaReal < totalEntradaPrevisto;

  const totalSaidaPrevisto = linhasAteAgora.reduce((s, l) => s + l.saidaPrevisto, 0);
  const totalSaidaReal = linhasAteAgora.reduce((s, l) => s + (l.saidaReal ?? 0), 0);
  const pctUtilizado = totalSaidaPrevisto > 0 ? Math.min((totalSaidaReal / totalSaidaPrevisto) * 100, 999) : 0;
  const estourou = totalSaidaReal > totalSaidaPrevisto;

  const handleGerarRelatorio = async () => {
    const doc = gerarRelatorioOrcadoRealizado(
      { empresaNome, usuarioNome, obraCliente: obra.cliente ?? obra.nome ?? "—", obraCidade: obra.cidade },
      obra, lancamentosObra
    );
    await baixarPdf(doc, `orcado-x-realizado-${obra.cliente ?? obra.nome ?? "obra"}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BotaoGerarRelatorio onClick={handleGerarRelatorio} />
      </div>

      {/* Receita (Entrada) */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Receita (Entrada)</p>
        <div className="grid grid-cols-4 gap-2.5">
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Valor de Venda</p>
            <p className="text-[14px] font-extrabold text-slate-700">{fmtBRL(valorVenda)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Orçado até agora</p>
            <p className="text-[14px] font-extrabold text-slate-700">{fmtBRL(totalEntradaPrevisto)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Realizado</p>
            <p className="text-[14px] font-extrabold" style={{ color: abaixoDoPrevisto ? "#D97706" : "#059669" }}>{fmtBRL(totalEntradaReal)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">% Recebido</p>
            <p className="text-[14px] font-extrabold" style={{ color: abaixoDoPrevisto ? "#D97706" : "#059669" }}>{pctRecebido.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Custo (Saída) */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Custo (Saída)</p>
        <div className="grid grid-cols-4 gap-2.5">
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Custo Máximo Permitido</p>
            <p className="text-[14px] font-extrabold text-slate-700">{fmtBRL(custoMaximo)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Orçado até agora</p>
            <p className="text-[14px] font-extrabold text-slate-700">{fmtBRL(totalSaidaPrevisto)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Realizado</p>
            <p className="text-[14px] font-extrabold" style={{ color: estourou ? "#DC2626" : "#059669" }}>{fmtBRL(totalSaidaReal)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">% Utilizado</p>
            <p className="text-[14px] font-extrabold" style={{ color: estourou ? "#DC2626" : "#059669" }}>{pctUtilizado.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {estourou && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="text-red-500 text-sm flex-shrink-0">⚠</span>
          <p className="text-[11px] text-red-700 font-medium">
            O realizado até agora (Saída) já ultrapassou o orçado previsto pra essa altura da obra em {fmtBRL(totalSaidaReal - totalSaidaPrevisto)}.
          </p>
        </div>
      )}

      {!temDataInicio && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Preencha a &quot;Data Assinatura (Início)&quot; da obra pra ver o Realizado por mês e o Orçado calculado só até o momento atual (sem isso, os cartões acima mostram o cronograma inteiro).
        </p>
      )}

      <div className="border border-slate-100 rounded-xl overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-2 py-2 font-bold text-slate-500" rowSpan={2}>Mês</th>
              <th className="text-right px-2 py-2 font-bold text-slate-500" rowSpan={2}>% Acum.</th>
              <th className="text-right px-2 py-1 font-bold text-emerald-600" colSpan={2}>Entrada</th>
              <th className="text-right px-2 py-1 font-bold text-red-500" colSpan={2}>Saída</th>
              <th className="text-right px-2 py-2 font-bold text-slate-500" rowSpan={2}>Saldo Orçado</th>
              <th className="text-right px-2 py-2 font-bold text-blue-600" rowSpan={2}>Saldo Real</th>
            </tr>
            <tr>
              <th className="text-right px-2 py-1 font-semibold text-emerald-600">Orçado</th>
              <th className="text-right px-2 py-1 font-semibold text-emerald-600">Realizado</th>
              <th className="text-right px-2 py-1 font-semibold text-red-500">Orçado</th>
              <th className="text-right px-2 py-1 font-semibold text-red-500">Realizado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const saldoReal = l.entradaReal != null && l.saidaReal != null ? l.entradaReal - l.saidaReal : null;
              const saidaEstourouMes = (l.saidaReal ?? 0) > l.saidaPrevisto;
              return (
                <tr key={l.mes} className="border-t border-slate-50">
                  <td className="px-2 py-1.5 font-semibold text-slate-700">{l.mes}ºM</td>
                  <td className="px-2 py-1.5 text-right text-slate-500">{l.pctAcumulado}%</td>
                  <td className="px-2 py-1.5 text-right text-slate-700">{fmtBRL(l.entradaPrevisto)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-700">{l.entradaReal != null ? fmtBRL(l.entradaReal) : "—"}</td>
                  <td className="px-2 py-1.5 text-right text-slate-700">{fmtBRL(l.saidaPrevisto)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold" style={{ color: saidaEstourouMes ? "#DC2626" : "#334155" }}>
                    {l.saidaReal != null ? fmtBRL(l.saidaReal) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold">{fmtBRL(l.saldoPrevisto)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-blue-600">{saldoReal != null ? fmtBRL(saldoReal) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Recebimentos por Obra (repasse real de medição / recursos próprios) ────── */
function AbaRecebimentosObra({ obra, recebimentos, loading, onRecebimentoCriado, onLancamentoCriado }: {
  obra: Obra;
  recebimentos: Recebimento[];
  loading: boolean;
  onRecebimentoCriado: (r: Recebimento) => void;
  onLancamentoCriado: (l: Lancamento) => void;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [modalRegistro, setModalRegistro] = useState<{
    origemTipo: OrigemRecebimento; medicaoId: string | null; descricaoBase: string; saldoSugerido: number;
  } | null>(null);

  if (loading) return <p className="text-center text-slate-400 py-8 text-[13px]">Carregando...</p>;

  const recebidoPorMedicao = (medicaoId: string) =>
    recebimentos.filter((r) => r.medicao_id === medicaoId).reduce((s, r) => s + r.valor, 0);
  const recebidoRecursosProprios = recebimentos
    .filter((r) => r.origem_tipo === "recursos_proprios")
    .reduce((s, r) => s + r.valor, 0);

  const linhas = [
    ...(obra.medicoes ?? [])
      .filter((m) => (m.valor_liberado ?? 0) > 0)
      .map((m) => ({
        chave: `medicao:${m.id}`,
        titulo: m.nome,
        origemTipo: "medicao" as const,
        medicaoId: m.id as string | null,
        meta: m.valor_liberado ?? 0,
        recebido: recebidoPorMedicao(m.id),
      })),
    ...(obra.recursos_proprios && obra.recursos_proprios > 0
      ? [{
          chave: "recursos_proprios",
          titulo: "Recursos Próprios",
          origemTipo: "recursos_proprios" as const,
          medicaoId: null as string | null,
          meta: obra.recursos_proprios,
          recebido: recebidoRecursosProprios,
        }]
      : []),
  ];

  if (linhas.length === 0) {
    return (
      <p className="text-center text-slate-400 py-8 text-[13px]">
        Nenhuma medição liberada ou Recursos Próprios cadastrados ainda pra essa obra.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {linhas.map((l) => {
        const saldo = l.meta - l.recebido;
        const status = saldo <= 0.01 ? "Concluído" : l.recebido > 0 ? "Repasse parcial" : "Aguardando repasse";
        const cor = saldo <= 0.01 ? "#10B981" : l.recebido > 0 ? "#F59E0B" : "#94A3B8";
        const repasses = recebimentos.filter((r) =>
          l.origemTipo === "medicao" ? r.medicao_id === l.medicaoId : r.origem_tipo === "recursos_proprios"
        );
        const aberto = expandido === l.chave;

        return (
          <div key={l.chave} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 truncate">{l.titulo}</p>
                <button
                  onClick={() => setExpandido(aberto ? null : l.chave)}
                  className="text-[10px] text-blue-500 hover:underline"
                >
                  {repasses.length} repasse{repasses.length !== 1 ? "s" : ""} {aberto ? "▲" : "▼"}
                </button>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: cor }}>
                {status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-2 text-center">
              <div className="bg-slate-50 rounded-lg p-1.5">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Liberado</p>
                <p className="text-[12px] font-bold text-slate-700">{fmtBRL(l.meta)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-1.5">
                <p className="text-[9px] text-emerald-600 font-bold uppercase">Recebido</p>
                <p className="text-[12px] font-bold text-emerald-700">{fmtBRL(l.recebido)}</p>
              </div>
              <div className={`rounded-lg p-1.5 ${saldo > 0.01 ? "bg-amber-50" : "bg-slate-50"}`}>
                <p className="text-[9px] font-bold uppercase" style={{ color: saldo > 0.01 ? "#D97706" : "#94A3B8" }}>Saldo</p>
                <p className="text-[12px] font-bold" style={{ color: saldo > 0.01 ? "#B45309" : "#94A3B8" }}>{fmtBRL(saldo)}</p>
              </div>
            </div>

            {aberto && repasses.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                {repasses.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{fmtDate(r.data)}{r.forma_pagamento ? ` · ${r.forma_pagamento}` : ""}</span>
                    <span className="font-bold text-slate-700">{fmtBRL(r.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            {saldo > 0.01 && (
              <button
                onClick={() => setModalRegistro({
                  origemTipo: l.origemTipo, medicaoId: l.medicaoId,
                  descricaoBase: `Repasse ${l.titulo}`, saldoSugerido: saldo,
                })}
                className="mt-2 w-full text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg py-1.5 transition-colors"
              >
                + Registrar Recebimento
              </button>
            )}
          </div>
        );
      })}

      {modalRegistro && (
        <ModalRegistrarRecebimento
          obra={obra}
          origemTipo={modalRegistro.origemTipo}
          medicaoId={modalRegistro.medicaoId}
          descricaoBase={modalRegistro.descricaoBase}
          saldoSugerido={modalRegistro.saldoSugerido}
          onClose={() => setModalRegistro(null)}
          onSaved={(recebimento, lancamento) => {
            onRecebimentoCriado(recebimento);
            onLancamentoCriado(lancamento);
          }}
        />
      )}
    </div>
  );
}

/* ─── Sub-modal: Registrar Recebimento ───────────────────────────────────────── */
function ModalRegistrarRecebimento({
  obra, origemTipo, medicaoId, descricaoBase, saldoSugerido, onClose, onSaved,
}: {
  obra: Obra;
  origemTipo: OrigemRecebimento;
  medicaoId: string | null;
  descricaoBase: string;
  saldoSugerido: number;
  onClose: () => void;
  onSaved: (r: Recebimento, l: Lancamento) => void;
}) {
  const [valor, setValor] = useState<number | undefined>(saldoSugerido > 0 ? saldoSugerido : undefined);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!valor || valor <= 0) { toast.error("Informe o valor recebido"); return; }
    setSaving(true);
    try {
      const { recebimento, lancamento } = await createRecebimento({
        obra_id: obra.id,
        origem_tipo: origemTipo,
        medicao_id: medicaoId,
        valor,
        data,
        descricao: `${descricaoBase} — ${obra.cliente ?? obra.nome ?? ""}`,
        forma_pagamento: formaPagamento || null,
        obs: obs || null,
      });
      toast.success("Recebimento registrado!");
      onSaved(recebimento, lancamento);
      onClose();
    } catch {
      toast.error("Erro ao registrar recebimento");
    } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} size="sm" zIndex={1100}>
      <ModalHeader title="Registrar Recebimento" subtitle={descricaoBase} onClose={onClose} />
      <div className="p-5 space-y-3">
        <div>
          <label className="field-label">Valor Recebido (R$)</label>
          <CurrencyInput value={valor} onChange={setValor} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="field-label">Forma de Pagamento</label>
            <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="input-base">
              <option value="">Selecione</option>
              {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Observações</label>
          <input value={obs} onChange={(e) => setObs(e.target.value)} className="input-base" placeholder="Opcional" />
        </div>
        <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>Registrar</Button>
      </div>
    </Modal>
  );
}

/* ─── Tab Por Obra ───────────────────────────────────────────────────────────── */
function TabPorObra({ lancamentos, obras, onLancamentoCriado, initialObraId, initialSubTab }: {
  lancamentos: Lancamento[]; obras: Obra[]; onLancamentoCriado: (l: Lancamento) => void;
  initialObraId?: string; initialSubTab?: string;
}) {
  const [obraModal, setObraModal] = useState<Obra | null>(null);
  const [busca, setBusca] = useState("");
  const obrasFiltradas = obras.filter((o) => (o.cliente ?? o.nome ?? "").toLowerCase().includes(busca.toLowerCase()));

  // Veio de um link de alerta (ex: /financeiro?obra=xxx&aba=recebimentos) —
  // abre direto a obra certa na aba certa assim que a lista carregar.
  const [linkConsumido, setLinkConsumido] = useState(false);
  useEffect(() => {
    if (linkConsumido || !initialObraId || obras.length === 0) return;
    const obra = obras.find((o) => o.id === initialObraId);
    if (obra) setObraModal(obra);
    setLinkConsumido(true);
  }, [initialObraId, obras, linkConsumido]);

  return (
    <>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente..."
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 w-64 mb-3.5"
      />
      <div className="grid grid-cols-3 gap-3.5">
        {obrasFiltradas.map((obra) => {
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
        {obrasFiltradas.length === 0 && (
          <div className="col-span-3 card p-10 text-center text-slate-400 text-[13px]">
            {obras.length === 0 ? "Nenhuma obra cadastrada." : "Nenhuma obra encontrada."}
          </div>
        )}
      </div>

      {obraModal && (
        <ModalLancamentosObra
          obra={obraModal}
          lancamentos={lancamentos}
          onClose={() => setObraModal(null)}
          onLancamentoCriado={onLancamentoCriado}
          initialSubTab={obraModal.id === initialObraId ? initialSubTab : undefined}
        />
      )}
    </>
  );
}

/* ─── SetorFinanceiro (main) ─────────────────────────────────────────────────── */
export default function SetorFinanceiro() {
  const { lancamentos, loading, criar, criarVarios, editar, pagar, remover, adicionarLocal } = useFinanceiro();
  const { pode } = usePermissoes();
  const searchParams = useSearchParams();
  const obraParam = searchParams.get("obra");
  const abaParam = searchParams.get("aba");
  const [tab, setTab]         = useState<FinTab>(obraParam ? "por_obra" : "dashboard");
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
        {pode("financeiro", "criar") && (
          <button
            onClick={() => { setEditLanc(null); setShowModal(true); }}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Lançamento
          </button>
        )}
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
            {tab === "por_obra" && (
              <TabPorObra
                lancamentos={lancamentos}
                obras={obras}
                onLancamentoCriado={adicionarLocal}
                initialObraId={obraParam ?? undefined}
                initialSubTab={abaParam ?? undefined}
              />
            )}
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
