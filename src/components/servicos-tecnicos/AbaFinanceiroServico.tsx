"use client";
import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ModalLancamentoServico from "./ModalLancamentoServico";
import { getLancamentosPorServico } from "@/services/lancamentosServico.service";
import { pagarLancamento, deleteLancamento } from "@/services/financeiro.service";
import { usePermissoes } from "@/hooks/usePermissoes";
import { fmtBRL, fmtDate, statusReal } from "@/lib/utils";
import type { Servico, Lancamento } from "@/types/app.types";
import toast from "react-hot-toast";

interface Props {
  servico: Servico;
  // Sprint 13.11 — quando este serviço faz parte de uma proposta com mais
  // de um item, `servico` aqui já é o representante financeiro do grupo
  // (ver principalDoGrupo em ModalServico), não necessariamente o item que
  // o usuário estava vendo. Esse texto avisa isso.
  avisoConsolidado?: string;
  // Soma de valor_proposta de todos os itens da proposta (ou só o valor
  // deste serviço, se avulso) — "a proposta é uma só", então Realizado ×
  // Proposta soma tudo, não só a parte do serviço aberto.
  valorTotalProposta: number;
}

const STATUS_COR: Record<string, string> = { pendente: "#F59E0B", pago: "#10B981", vencido: "#EF4444" };
const STATUS_LABEL: Record<string, string> = { pendente: "Pendente", pago: "Pago", vencido: "Vencido" };

export default function AbaFinanceiroServico({ servico, avisoConsolidado, valorTotalProposta }: Props) {
  const { pode } = usePermissoes();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [pagando, setPagando] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLancamentos(await getLancamentosPorServico(servico.id)); }
    catch { toast.error("Erro ao carregar lançamentos."); }
    finally { setLoading(false); }
  }, [servico.id]);

  useEffect(() => { load(); }, [load]);

  const handlePagar = async (id: string) => {
    setPagando(id);
    try {
      const atualizado = await pagarLancamento(id);
      setLancamentos((prev) => prev.map((l) => (l.id === id ? atualizado : l)));
      toast.success("Marcado como pago!");
    } catch {
      toast.error("Erro ao marcar como pago.");
    } finally {
      setPagando(null);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    setRemovendo(id);
    try {
      await deleteLancamento(id);
      setLancamentos((prev) => prev.filter((l) => l.id !== id));
      toast.success("Lançamento removido.");
    } catch {
      toast.error("Erro ao remover lançamento.");
    } finally {
      setRemovendo(null);
    }
  };

  const entradas = lancamentos.filter((l) => l.tipo === "entrada");
  const saidas = lancamentos.filter((l) => l.tipo === "saida");
  const recebido = entradas.filter((l) => statusReal(l) === "pago").reduce((s, l) => s + Number(l.valor), 0);
  const aReceber = entradas.filter((l) => statusReal(l) !== "pago").reduce((s, l) => s + Number(l.valor), 0);
  const lancado = recebido + aReceber;
  const pctRealizado = valorTotalProposta > 0 ? Math.min(100, Math.round((recebido / valorTotalProposta) * 100)) : 0;

  if (loading) return <p className="text-xs text-slate-400 text-center py-8">Carregando...</p>;

  return (
    <div>
      {avisoConsolidado && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5 mb-3">
          <p className="text-[11px] font-semibold text-blue-700">📎 {avisoConsolidado}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div className="card p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Valor da Proposta</p>
          <p className="text-[15px] font-extrabold text-slate-900">{fmtBRL(valorTotalProposta)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Já Lançado</p>
          <p className="text-[15px] font-extrabold text-slate-700">{fmtBRL(lancado)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Recebido</p>
          <p className="text-[15px] font-extrabold text-emerald-600">{fmtBRL(recebido)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">A Receber</p>
          <p className="text-[15px] font-extrabold text-amber-500">{fmtBRL(aReceber)}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-[11px] font-bold text-slate-500">Realizado sobre a proposta</p>
          <p className="text-[11px] font-bold text-slate-700">{pctRealizado}%</p>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctRealizado}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {lancamentos.length} lançamento{lancamentos.length !== 1 ? "s" : ""}
        </p>
        {pode("servicos-tecnicos", "criar") && (
          <Button variant="primary" size="sm" onClick={() => setModal(true)}>+ Novo Lançamento</Button>
        )}
      </div>

      {lancamentos.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
          <p className="text-xs text-slate-400">Nenhum lançamento ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entradas.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Entradas — Pagamentos do Cliente</p>
              <div className="space-y-1.5">
                {entradas.map((l) => (
                  <LinhaLancamento key={l.id} l={l} onPagar={handlePagar} pagando={pagando === l.id} onRemover={handleRemover} removendo={removendo === l.id} />
                ))}
              </div>
            </div>
          )}
          {saidas.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">Saídas — Comissões e Despesas</p>
              <div className="space-y-1.5">
                {saidas.map((l) => (
                  <LinhaLancamento key={l.id} l={l} onPagar={handlePagar} pagando={pagando === l.id} onRemover={handleRemover} removendo={removendo === l.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <ModalLancamentoServico
          servico={servico}
          onClose={() => setModal(false)}
          onCreated={(novos) => setLancamentos((prev) => [...prev, ...novos])}
        />
      )}
    </div>
  );
}

function LinhaLancamento({ l, onPagar, pagando, onRemover, removendo }: {
  l: Lancamento;
  onPagar: (id: string) => void;
  pagando: boolean;
  onRemover: (id: string) => void;
  removendo: boolean;
}) {
  const { pode } = usePermissoes();
  const cor = l.tipo === "entrada" ? "text-emerald-600" : "text-red-500";
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-slate-50">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 truncate">{l.descricao}</p>
        <p className="text-[10px] text-slate-400">
          {fmtDate(l.data)}
          {l.parcela_total ? ` · ${l.parcela_num}/${l.parcela_total}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[13px] font-bold ${cor}`}>{l.tipo === "entrada" ? "+" : "−"}{fmtBRL(l.valor)}</span>
        <Badge color={STATUS_COR[statusReal(l)]}>{STATUS_LABEL[statusReal(l)]}</Badge>
        {l.status_pagamento !== "pago" && (
          <button
            onClick={() => onPagar(l.id)}
            disabled={pagando}
            className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold disabled:opacity-50"
          >
            marcar pago
          </button>
        )}
        {pode("servicos-tecnicos", "excluir") && (
          <button
            onClick={() => onRemover(l.id)}
            disabled={removendo}
            title="Excluir"
            className="text-slate-300 hover:text-red-400 disabled:opacity-40 text-xs"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
