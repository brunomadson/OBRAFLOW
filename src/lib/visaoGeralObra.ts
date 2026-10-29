import type { Obra, Lancamento, Recebimento } from "@/types/app.types";

export interface VisaoGeralObra {
  valorVenda: number;
  valorFinanciado: number;
  recursosProprios: number;
  subsidio: number;
  receitaRecebida: number;
  receitaPendente: number;
  custoPrevisto: number;
  custoRealizado: number;
  saldoDisponivel: number;
  lucroPrevisto: number;
  lucroAtual: number;
  margemAtual: number;
  pctFinanceiro: number;
  pctCaixa: number;
  pctCliente: number;
  totalRecebido: number;
  totalAReceber: number;
}

// Mesma fonte usada na tela (AbaVisaoGeralObra) e no relatório em PDF —
// não recalcular separadamente em cada lugar.
export function calcularVisaoGeralObra(obra: Obra, lancamentosObra: Lancamento[], recebimentos: Recebimento[]): VisaoGeralObra {
  const valorVenda = obra.valor_venda ?? 0;
  const valorFinanciado = obra.valor_financiamento ?? 0;
  const recursosProprios = obra.recursos_proprios ?? 0;
  const subsidio = obra.valor_subsidio ?? 0;
  const lucroPct = obra.lucro_previsto_pct ?? 0;

  const entradasPagas = lancamentosObra.filter((l) => l.tipo === "entrada" && l.status_pagamento === "pago");
  const entradasPendentes = lancamentosObra.filter((l) => l.tipo === "entrada" && l.status_pagamento !== "pago");
  const saidasPagas = lancamentosObra.filter((l) => l.tipo === "saida" && l.status_pagamento === "pago");

  const receitaRecebida = entradasPagas.reduce((s, l) => s + l.valor, 0);
  const receitaPendente = entradasPendentes.reduce((s, l) => s + l.valor, 0);
  const custoRealizado = saidasPagas.reduce((s, l) => s + l.valor, 0);

  const lucroPrevisto = (valorVenda * lucroPct) / 100;
  const custoPrevisto = valorVenda - lucroPrevisto;
  const lucroAtual = receitaRecebida - custoRealizado;
  const margemAtual = receitaRecebida > 0 ? (lucroAtual / receitaRecebida) * 100 : 0;

  const totalRecebido = receitaRecebida;
  const totalAReceber = Math.max(valorVenda - totalRecebido, 0);
  const pctFinanceiro = valorVenda > 0 ? (totalRecebido / valorVenda) * 100 : 0;

  const recebidoCaixa = recebimentos.filter((r) => r.origem_tipo === "medicao").reduce((s, r) => s + r.valor, 0);
  const recebidoCliente = recebimentos.filter((r) => r.origem_tipo === "recursos_proprios").reduce((s, r) => s + r.valor, 0);
  const pctCaixa = valorFinanciado > 0 ? Math.min((recebidoCaixa / valorFinanciado) * 100, 100) : 0;
  const pctCliente = recursosProprios > 0 ? Math.min((recebidoCliente / recursosProprios) * 100, 100) : 0;

  return {
    valorVenda, valorFinanciado, recursosProprios, subsidio,
    receitaRecebida, receitaPendente, custoPrevisto, custoRealizado,
    saldoDisponivel: receitaRecebida - custoRealizado,
    lucroPrevisto, lucroAtual, margemAtual,
    pctFinanceiro, pctCaixa, pctCliente,
    totalRecebido, totalAReceber,
  };
}
