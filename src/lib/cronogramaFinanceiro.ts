import type { Obra, Lancamento } from "@/types/app.types";

export interface LinhaCronograma {
  mes: number;
  pctAcumulado: number;
  entradaPrevisto: number;
  saidaPrevisto: number;
  saldoPrevisto: number;
  saldoAcumuladoPrevisto: number;
  // null quando não dá pra calcular (obra sem data_inicio preenchida)
  entradaReal: number | null;
  saidaReal: number | null;
  // true quando o mês já começou (data_inicio + i meses <= hoje) — usado
  // pra separar "orçado até agora" de "orçado do cronograma inteiro".
  jaComecou: boolean;
}

export function custoMaximoPermitido(obra: Obra): number {
  const venda = obra.valor_venda ?? 0;
  return venda - (venda * (obra.lucro_previsto_pct ?? 0)) / 100;
}

// Mesma base usada em toda a Sprint 12: o Orçado de cada mês vem do
// cronograma_financeiro (% acumulada) × Valor de Venda / Custo Máximo
// Permitido. O Realizado vem dos lançamentos reais (pagos) datados dentro
// do intervalo daquele mês, calculado a partir de obra.data_inicio.
export function calcularCronogramaMensal(obra: Obra, lancamentosObra: Lancamento[]): LinhaCronograma[] {
  const meses = obra.cronograma_financeiro ?? [];
  const custoMaximo = custoMaximoPermitido(obra);
  const valorVenda = obra.valor_venda ?? 0;
  const dataInicio = obra.data_inicio ? new Date(`${obra.data_inicio}T00:00:00`) : null;

  let saldoAcumuladoPrevisto = 0;

  return meses.map((m, i) => {
    const pctAnterior = i === 0 ? 0 : (meses[i - 1]?.pctAcumulado ?? 0);
    const pctIncremental = Math.max(m.pctAcumulado - pctAnterior, 0);
    const entradaPrevisto = (pctIncremental / 100) * valorVenda;
    const saidaPrevisto = (pctIncremental / 100) * custoMaximo;
    saldoAcumuladoPrevisto += entradaPrevisto - saidaPrevisto;

    let entradaReal: number | null = null;
    let saidaReal: number | null = null;
    let jaComecou = false;
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      inicio.setMonth(inicio.getMonth() + i);
      const fim = new Date(dataInicio);
      fim.setMonth(fim.getMonth() + i + 1);
      jaComecou = inicio <= new Date();
      const doMes = lancamentosObra.filter((l) => {
        const d = new Date(`${l.data}T00:00:00`);
        return d >= inicio && d < fim && l.status_pagamento === "pago";
      });
      entradaReal = doMes.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
      saidaReal = doMes.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
    }

    return {
      mes: m.mes,
      pctAcumulado: m.pctAcumulado,
      entradaPrevisto,
      saidaPrevisto,
      saldoPrevisto: entradaPrevisto - saidaPrevisto,
      saldoAcumuladoPrevisto,
      entradaReal,
      saidaReal,
      jaComecou,
    };
  });
}

// Previsto (Entrada/Saída) pra um período arbitrário (usado no Fluxo de
// Caixa) — o cronograma só tem granularidade mensal, então rateia o
// previsto de cada mês proporcionalmente aos dias desse mês que caem
// dentro do período pedido.
export function calcularPrevistoNoPeriodo(obra: Obra, inicio: Date, fim: Date): { entradasPrevistas: number; saidasPrevistas: number } {
  if (!obra.data_inicio || (obra.cronograma_financeiro?.length ?? 0) === 0) {
    return { entradasPrevistas: 0, saidasPrevistas: 0 };
  }

  const linhas = calcularCronogramaMensal(obra, []);
  const dataInicioObra = new Date(`${obra.data_inicio}T00:00:00`);

  let entradasPrevistas = 0;
  let saidasPrevistas = 0;

  linhas.forEach((l, i) => {
    const mesInicio = new Date(dataInicioObra);
    mesInicio.setMonth(mesInicio.getMonth() + i);
    const mesFim = new Date(dataInicioObra);
    mesFim.setMonth(mesFim.getMonth() + i + 1);
    const diasNoMes = Math.round((mesFim.getTime() - mesInicio.getTime()) / 86_400_000);

    const overlapInicio = inicio > mesInicio ? inicio : mesInicio;
    const fimExclusivo = new Date(fim.getTime() + 86_400_000); // fim é inclusivo
    const overlapFim = fimExclusivo < mesFim ? fimExclusivo : mesFim;
    const diasOverlap = Math.max(0, Math.round((overlapFim.getTime() - overlapInicio.getTime()) / 86_400_000));

    if (diasOverlap > 0 && diasNoMes > 0) {
      const fracao = diasOverlap / diasNoMes;
      entradasPrevistas += l.entradaPrevisto * fracao;
      saidasPrevistas += l.saidaPrevisto * fracao;
    }
  });

  return { entradasPrevistas, saidasPrevistas };
}

export interface FluxoCaixaPeriodo {
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoPrevisto: number;
  entradasRecebidas: number;
  saidasRealizadas: number;
  saldoRealizado: number;
  // Posição de caixa acumulada da obra até o fim do período (tudo pago,
  // não só o que caiu dentro da janela) — mesma base usada na tela.
  saldoFuturo: number;
}

// Mesmo cálculo usado na tela (AbaFluxoCaixaObra) e no relatório em PDF.
export function calcularFluxoCaixaPeriodo(obra: Obra, lancamentosObra: Lancamento[], inicio: Date, fim: Date): FluxoCaixaPeriodo {
  const lancsNoPeriodo = lancamentosObra.filter((l) => {
    const d = new Date(`${l.data}T00:00:00`);
    return d >= inicio && d <= fim;
  });

  const entradasRecebidas = lancsNoPeriodo.filter((l) => l.tipo === "entrada" && l.status_pagamento === "pago").reduce((s, l) => s + l.valor, 0);
  const saidasRealizadas = lancsNoPeriodo.filter((l) => l.tipo === "saida" && l.status_pagamento === "pago").reduce((s, l) => s + l.valor, 0);

  const { entradasPrevistas, saidasPrevistas } = calcularPrevistoNoPeriodo(obra, inicio, fim);

  const saldoFuturo = lancamentosObra
    .filter((l) => l.status_pagamento === "pago" && new Date(`${l.data}T00:00:00`) <= fim)
    .reduce((s, l) => s + (l.tipo === "entrada" ? l.valor : -l.valor), 0);

  return {
    entradasPrevistas,
    saidasPrevistas,
    saldoPrevisto: entradasPrevistas - saidasPrevistas,
    entradasRecebidas,
    saidasRealizadas,
    saldoRealizado: entradasRecebidas - saidasRealizadas,
    saldoFuturo,
  };
}
