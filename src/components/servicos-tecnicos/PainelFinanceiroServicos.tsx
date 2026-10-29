"use client";
import { useState, useEffect, useMemo } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ModalLancamentoServico from "./ModalLancamentoServico";
import { getLancamentosServicosTecnicos, type LancamentoComServico } from "@/services/lancamentosServico.service";
import { pagarLancamento, deleteLancamento } from "@/services/financeiro.service";
import { getServicos } from "@/services/servicos.service";
import { usePermissoes } from "@/hooks/usePermissoes";
import { fmtBRL, fmtDate, statusReal } from "@/lib/utils";
import {
  Kpi, GraficoFluxo, GraficoCustos, PizzaVencimentos, ultimos6Meses, varPct,
  filtraVencimentos, FILTRO_VENC_LABEL, FILTRO_VENC_COR, type FiltroVenc,
} from "@/components/financeiro/GraficosFinanceiro";
import type { Servico, StatusPagamento } from "@/types/app.types";
import toast from "react-hot-toast";

// Financeiro de Serviços Técnicos no nível do módulo — agregado de todos os
// serviços. Reaproveita literalmente os mesmos componentes visuais do
// Financeiro de Obras (Kpi/GraficoFluxo/GraficoCustos/PizzaVencimentos, ver
// @/components/financeiro/GraficosFinanceiro) — um app só, um padrão visual
// só. Nunca mistura os dados dos dois: getLancamentosServicosTecnicos() só
// busca linhas com servico_id, e getLancamentos() (Obras) as exclui.
//
// Diferença deliberada: em Obras o donut de vencimentos olha só "saída"
// (o que a empresa deve pagar). Aqui, o que mais importa é "entrada" — a
// parcela do CLIENTE vencendo — porque é isso que trava o caixa; comissão
// (saída) já tem seu próprio bloco de KPIs logo abaixo.

const STATUS_COR: Record<string, string> = { pendente: "#F59E0B", pago: "#10B981", vencido: "#EF4444" };
const STATUS_LABEL: Record<string, string> = { pendente: "Pendente", pago: "Pago", vencido: "Vencido" };

function nomeServico(s: Servico): string {
  return `${s.cliente?.nome ?? "Cliente"} — ${s.catalogoServico?.nome ?? "Serviço"}`;
}

/* ─── Escolher serviço (pré-requisito pra criar um lançamento a partir daqui) ─ */
function ModalEscolherServico({ servicos, onClose, onEscolher }: {
  servicos: Servico[];
  onClose: () => void;
  onEscolher: (s: Servico) => void;
}) {
  const [busca, setBusca] = useState("");
  const filtrados = servicos.filter((s) => nomeServico(s).toLowerCase().includes(busca.toLowerCase()));

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Escolha o Serviço" onClose={onClose} />
      <div className="p-5 space-y-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou serviço..."
          className="input-base"
          autoFocus
        />
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {filtrados.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">Nenhum serviço encontrado.</p>
          )}
          {filtrados.map((s) => (
            <button
              key={s.id}
              onClick={() => onEscolher(s)}
              className="w-full text-left py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <p className="text-[13px] font-semibold text-slate-800">{s.cliente?.nome ?? "Cliente"}</p>
              <p className="text-[11px] text-slate-400">{s.catalogoServico?.nome ?? "Serviço não definido"}</p>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ─── Dashboard ────────────────────────────────────────────────────────────── */
function AbaDashboard({ lancamentos, servicos, onIrParaLancamentos }: {
  lancamentos: LancamentoComServico[];
  servicos: Servico[];
  onIrParaLancamentos: () => void;
}) {
  const [filtroVenc, setFiltroVenc] = useState<FiltroVenc | null>(null);
  const meses = ultimos6Meses();
  const mesAtual = meses[5].key;
  const mesAnter = meses[4].key;

  const L = (key: string) => lancamentos.filter((l) => l.data.startsWith(key));
  const sum = (ls: LancamentoComServico[], t: "entrada" | "saida") => ls.filter((l) => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0);

  const recAtual = sum(L(mesAtual), "entrada");
  const recAnter = sum(L(mesAnter), "entrada");
  const saiAtual = sum(L(mesAtual), "saida");
  const saiAnter = sum(L(mesAnter), "saida");
  const saldoAtual = recAtual - saiAtual;
  const saldoAnter = recAnter - saiAnter;
  const totalRec = sum(lancamentos, "entrada");
  const totalSai = sum(lancamentos, "saida");
  const saldoTotal = totalRec - totalSai;

  const servicosAtivos = servicos.filter((s) => s.etapa !== "concluido").length;

  const entradas = lancamentos.filter((l) => l.tipo === "entrada");
  const saidas = lancamentos.filter((l) => l.tipo === "saida");
  const recebido = entradas.filter((l) => statusReal(l) === "pago");
  const aVencerCliente = entradas.filter((l) => statusReal(l) === "pendente");
  const vencidoCliente = entradas.filter((l) => statusReal(l) === "vencido");
  const comissaoPaga = saidas.filter((l) => statusReal(l) === "pago");
  const comissaoAVencer = saidas.filter((l) => statusReal(l) === "pendente");
  const comissaoVencida = saidas.filter((l) => statusReal(l) === "vencido");

  const fluxo = meses.map((m) => ({
    label: m.label,
    ent: sum(L(m.key), "entrada"),
    sai: sum(L(m.key), "saida"),
  }));

  const somaValor = (ls: LancamentoComServico[]) => ls.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5">
        <Kpi label="Receita Total" valor={fmtBRL(totalRec)} cor="#10B981" variacao={varPct(recAtual, recAnter)} />
        <Kpi label="Total Saídas" valor={fmtBRL(totalSai)} cor="#EF4444" variacao={varPct(saiAtual, saiAnter)} />
        <Kpi label="Saldo do Período" valor={fmtBRL(saldoTotal)} cor={saldoTotal >= 0 ? "#3B82F6" : "#EF4444"} variacao={varPct(saldoAtual, saldoAnter)} />
        <Kpi label="Serviços Ativos" valor={String(servicosAtivos)} cor="#EC4899" />
      </div>

      {/* Contas a Receber — clientes */}
      <div>
        <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Contas a Receber — Clientes</p>
        <div className="grid grid-cols-3 gap-3.5">
          <div className="card p-4 border-l-4 border-emerald-400">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recebido</p>
            <p className="text-[17px] font-extrabold text-emerald-600">{fmtBRL(somaValor(recebido))}</p>
            <p className="text-[11px] text-slate-400">{recebido.length} lançamento{recebido.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onIrParaLancamentos} className="card p-4 border-l-4 border-amber-400 text-left hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">A Vencer</p>
            <p className="text-[17px] font-extrabold text-amber-600">{fmtBRL(somaValor(aVencerCliente))}</p>
            <p className="text-[11px] text-amber-500 font-semibold">{aVencerCliente.length} pendente{aVencerCliente.length !== 1 ? "s" : ""} → ver lançamentos</p>
          </button>
          <button onClick={onIrParaLancamentos} className="card p-4 border-l-4 border-red-400 text-left hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vencido</p>
            <p className="text-[17px] font-extrabold text-red-600">{fmtBRL(somaValor(vencidoCliente))}</p>
            <p className="text-[11px] text-red-500 font-semibold">{vencidoCliente.length} vencido{vencidoCliente.length !== 1 ? "s" : ""} → ver lançamentos</p>
          </button>
        </div>
      </div>

      {/* Contas a Pagar — comissões */}
      <div>
        <p className="text-[11px] font-bold text-purple-500 uppercase tracking-wider mb-2">Contas a Pagar — Comissões de Indicação</p>
        <div className="grid grid-cols-3 gap-3.5">
          <div className="card p-4 border-l-4 border-purple-400">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pago</p>
            <p className="text-[17px] font-extrabold text-purple-600">{fmtBRL(somaValor(comissaoPaga))}</p>
            <p className="text-[11px] text-slate-400">{comissaoPaga.length} lançamento{comissaoPaga.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onIrParaLancamentos} className="card p-4 border-l-4 border-amber-400 text-left hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">A Vencer</p>
            <p className="text-[17px] font-extrabold text-amber-600">{fmtBRL(somaValor(comissaoAVencer))}</p>
            <p className="text-[11px] text-amber-500 font-semibold">{comissaoAVencer.length} pendente{comissaoAVencer.length !== 1 ? "s" : ""} → ver lançamentos</p>
          </button>
          <button onClick={onIrParaLancamentos} className="card p-4 border-l-4 border-red-400 text-left hover:shadow-md transition-shadow cursor-pointer">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vencido</p>
            <p className="text-[17px] font-extrabold text-red-600">{fmtBRL(somaValor(comissaoVencida))}</p>
            <p className="text-[11px] text-red-500 font-semibold">{comissaoVencida.length} vencido{comissaoVencida.length !== 1 ? "s" : ""} → ver lançamentos</p>
          </button>
        </div>
      </div>

      {/* Fluxo mensal + Vencimentos */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="card p-4 col-span-2">
          <p className="text-[11px] font-bold text-slate-700 mb-3">Fluxo Mensal — Últimos 6 Meses</p>
          <GraficoFluxo dados={fluxo} />
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-bold text-slate-700 mb-3">Parcelas de Clientes Vencendo</p>
          <PizzaVencimentos lancamentos={lancamentos} tipo="entrada" onClickFatia={(f) => setFiltroVenc(f as FiltroVenc)} />
        </div>
      </div>

      {/* Distribuição de saídas */}
      <div className="card p-4">
        <p className="text-[11px] font-bold text-slate-700 mb-3">Distribuição de Saídas por Grupo</p>
        <GraficoCustos saidas={saidas} />
      </div>

      {/* Modal de vencimentos filtrado (parcelas de cliente) */}
      {filtroVenc && (
        <ModalFiltroVencimentosServico
          filtro={filtroVenc}
          lancamentos={lancamentos}
          onClose={() => setFiltroVenc(null)}
        />
      )}
    </div>
  );
}

/* ─── Modal: parcelas de cliente numa faixa de vencimento (clique no donut) ──── */
function ModalFiltroVencimentosServico({ filtro, lancamentos, onClose }: {
  filtro: FiltroVenc;
  lancamentos: LancamentoComServico[];
  onClose: () => void;
}) {
  const lista = filtraVencimentos(lancamentos, "entrada", filtro)
    .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
  const total = lista.reduce((s, l) => s + Number(l.valor), 0);
  const cor = FILTRO_VENC_COR[filtro];

  return (
    <Modal onClose={onClose} size="lg">
      <ModalHeader
        title={FILTRO_VENC_LABEL[filtro]}
        subtitle={`${lista.length} parcela${lista.length !== 1 ? "s" : ""} de cliente · Total: ${fmtBRL(total)}`}
        onClose={onClose}
      />
      <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
        {lista.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-[13px]">Nenhuma parcela nesta faixa de vencimento.</p>
        ) : (
          lista.map((l) => {
            const nome = (l as LancamentoComServico).servico?.cliente?.nome ?? "Cliente";
            return (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-slate-50">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{nome} — {l.descricao}</p>
                  <p className="text-[10px] text-slate-400">Vencimento: {fmtDate(l.data_vencimento)}</p>
                </div>
                <span className="text-[13px] font-bold flex-shrink-0" style={{ color: cor }}>{fmtBRL(l.valor)}</span>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

/* ─── Lançamentos ──────────────────────────────────────────────────────────── */
function AbaLancamentos({ lancamentos, onPagar, onRemover, pagando, removendo }: {
  lancamentos: LancamentoComServico[];
  onPagar: (id: string) => void;
  onRemover: (id: string) => void;
  pagando: string | null;
  removendo: string | null;
}) {
  const { pode } = usePermissoes();
  const [tipo, setTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [status, setStatus] = useState<"todos" | StatusPagamento>("todos");
  const [clienteF, setClienteF] = useState("");
  const [busca, setBusca] = useState("");

  const clientesDisponiveis = useMemo(
    () => [...new Set(lancamentos.map((l) => l.servico?.cliente?.nome).filter((n): n is string => !!n))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [lancamentos]
  );

  const filtrados = useMemo(() => lancamentos.filter((l) => {
    if (tipo !== "todos" && l.tipo !== tipo) return false;
    if (status !== "todos" && statusReal(l) !== status) return false;
    if (clienteF && l.servico?.cliente?.nome !== clienteF) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const alvo = `${l.descricao} ${l.servico?.cliente?.nome ?? ""} ${l.categoria}`.toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  }), [lancamentos, tipo, status, clienteF, busca]);

  const totalFiltrado = filtrados.reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);

  return (
    <div>
      <div className="card p-3 flex flex-wrap gap-2 items-center mb-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["todos", "entrada", "saida"] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${tipo === t ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600"}`}>
              {t === "todos" ? "Todos" : t === "entrada" ? "Entradas" : "Saídas"}
            </button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input-base w-36 !py-1.5">
          <option value="todos">Todos status</option>
          <option value="pago">Pago</option>
          <option value="pendente">A vencer</option>
          <option value="vencido">Vencido</option>
        </select>
        <select value={clienteF} onChange={(e) => setClienteF(e.target.value)} className="input-base w-44 !py-1.5">
          <option value="">Todos os clientes</option>
          {clientesDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..."
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 w-40"
        />
        <div className="ml-auto flex items-center gap-3">
          <span className={`text-[13px] font-bold ${totalFiltrado >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            Saldo filtrado: {totalFiltrado >= 0 ? "+" : "−"}{fmtBRL(Math.abs(totalFiltrado))}
          </span>
          <span className="text-[11px] text-slate-400">({filtrados.length} registros)</span>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400">Nenhum lançamento encontrado.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtrados.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-slate-50">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 truncate">
                  {l.servico?.cliente?.nome ?? "Cliente"} — {l.descricao}
                </p>
                <p className="text-[10px] text-slate-400">
                  {fmtDate(l.data)} · {l.categoria}
                  {l.parcela_total ? ` · ${l.parcela_num}/${l.parcela_total}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[13px] font-bold ${l.tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                  {l.tipo === "entrada" ? "+" : "−"}{fmtBRL(l.valor)}
                </span>
                <Badge color={STATUS_COR[statusReal(l)]}>{STATUS_LABEL[statusReal(l)]}</Badge>
                {l.status_pagamento !== "pago" && pode("servicos-tecnicos", "editar") && (
                  <button
                    onClick={() => onPagar(l.id)}
                    disabled={pagando === l.id}
                    className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold disabled:opacity-50"
                  >
                    marcar pago
                  </button>
                )}
                {pode("servicos-tecnicos", "excluir") && (
                  <button
                    onClick={() => onRemover(l.id)}
                    disabled={removendo === l.id}
                    title="Excluir"
                    className="text-slate-300 hover:text-red-400 disabled:opacity-40 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export default function PainelFinanceiroServicos() {
  const { pode } = usePermissoes();
  const [subTab, setSubTab] = useState<"dashboard" | "lancamentos">("dashboard");
  const [lancamentos, setLancamentos] = useState<LancamentoComServico[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagando, setPagando] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [escolhendoServico, setEscolhendoServico] = useState(false);
  const [servicoEscolhido, setServicoEscolhido] = useState<Servico | null>(null);

  useEffect(() => {
    Promise.all([getLancamentosServicosTecnicos(), getServicos()])
      .then(([l, s]) => { setLancamentos(l); setServicos(s); })
      .catch(() => toast.error("Erro ao carregar o Financeiro de Serviços Técnicos."))
      .finally(() => setLoading(false));
  }, []);

  const handlePagar = async (id: string) => {
    setPagando(id);
    try {
      const atualizado = await pagarLancamento(id);
      setLancamentos((prev) => prev.map((l) => (l.id === id ? { ...l, ...atualizado } : l)));
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

  if (loading) return <p className="text-sm text-slate-400 text-center py-12">Carregando...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          <button
            onClick={() => setSubTab("dashboard")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${subTab === "dashboard" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setSubTab("lancamentos")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${subTab === "lancamentos" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            Lançamentos
          </button>
        </div>
        {pode("servicos-tecnicos", "criar") && (
          <Button variant="primary" size="sm" onClick={() => setEscolhendoServico(true)}>
            + Novo Lançamento
          </Button>
        )}
      </div>

      {subTab === "dashboard" && (
        <AbaDashboard lancamentos={lancamentos} servicos={servicos} onIrParaLancamentos={() => setSubTab("lancamentos")} />
      )}
      {subTab === "lancamentos" && (
        <AbaLancamentos
          lancamentos={lancamentos}
          onPagar={handlePagar}
          onRemover={handleRemover}
          pagando={pagando}
          removendo={removendo}
        />
      )}

      {escolhendoServico && (
        <ModalEscolherServico
          servicos={servicos}
          onClose={() => setEscolhendoServico(false)}
          onEscolher={(s) => { setServicoEscolhido(s); setEscolhendoServico(false); }}
        />
      )}

      {servicoEscolhido && (
        <ModalLancamentoServico
          servico={servicoEscolhido}
          onClose={() => setServicoEscolhido(null)}
          onCreated={(novos) => setLancamentos((prev) => [...novos.map((n) => ({ ...n, servico: { cliente: servicoEscolhido.cliente, catalogoServico: servicoEscolhido.catalogoServico } })), ...prev])}
        />
      )}
    </div>
  );
}
