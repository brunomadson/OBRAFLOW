import { View } from "@react-pdf/renderer";
import { RelatorioDocument, SecaoTitulo, KpiGrid, Kpi, CORES, type ContextoRelatorio } from "../RelatorioBase";
import { calcularFluxoCaixaPeriodo } from "@/lib/cronogramaFinanceiro";
import { fmtBRL, fmtDate } from "@/lib/utils";
import type { Obra, Lancamento } from "@/types/app.types";

export function gerarRelatorioFluxoCaixa(
  ctx: Omit<ContextoRelatorio, "tituloRelatorio">,
  obra: Obra,
  lancamentosObra: Lancamento[],
  inicio: Date,
  fim: Date
) {
  const f = calcularFluxoCaixaPeriodo(obra, lancamentosObra, inicio, fim);
  const periodoTexto = `${fmtDate(inicio.toISOString().slice(0, 10))} a ${fmtDate(fim.toISOString().slice(0, 10))}`;

  return (
    <RelatorioDocument ctx={{ ...ctx, tituloRelatorio: `Relatório — Fluxo de Caixa (${periodoTexto})` }}>
      <SecaoTitulo>Entradas e Saídas do Período</SecaoTitulo>
      <KpiGrid>
        <Kpi label="Entradas Previstas" valor={fmtBRL(f.entradasPrevistas)} />
        <Kpi label="Entradas Recebidas" valor={fmtBRL(f.entradasRecebidas)} cor={CORES.verde} />
        <Kpi label="Saídas Previstas" valor={fmtBRL(f.saidasPrevistas)} />
        <Kpi label="Saídas Realizadas" valor={fmtBRL(f.saidasRealizadas)} cor={CORES.vermelho} />
      </KpiGrid>

      <SecaoTitulo>Saldos</SecaoTitulo>
      <KpiGrid>
        <Kpi label="Saldo Previsto" valor={fmtBRL(f.saldoPrevisto)} cor={f.saldoPrevisto >= 0 ? CORES.verde : CORES.vermelho} />
        <Kpi label="Saldo Realizado" valor={fmtBRL(f.saldoRealizado)} cor={f.saldoRealizado >= 0 ? CORES.verde : CORES.vermelho} />
        <Kpi label="Saldo Futuro (acumulado)" valor={fmtBRL(f.saldoFuturo)} cor={f.saldoFuturo >= 0 ? CORES.azul : CORES.vermelho} />
      </KpiGrid>

      <View style={{ marginTop: 4 }} />
    </RelatorioDocument>
  );
}
