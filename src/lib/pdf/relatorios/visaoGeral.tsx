import { View } from "@react-pdf/renderer";
import { RelatorioDocument, SecaoTitulo, KpiGrid, Kpi, CORES, type ContextoRelatorio } from "../RelatorioBase";
import { calcularVisaoGeralObra } from "@/lib/visaoGeralObra";
import { fmtBRL } from "@/lib/utils";
import type { Obra, Lancamento, Recebimento } from "@/types/app.types";

export function gerarRelatorioVisaoGeral(
  ctx: Omit<ContextoRelatorio, "tituloRelatorio">,
  obra: Obra,
  lancamentosObra: Lancamento[],
  recebimentos: Recebimento[]
) {
  const v = calcularVisaoGeralObra(obra, lancamentosObra, recebimentos);

  return (
    <RelatorioDocument ctx={{ ...ctx, tituloRelatorio: "Relatório — Visão Geral" }}>
      <SecaoTitulo>Composição da Venda</SecaoTitulo>
      <KpiGrid>
        <Kpi label="Valor de Venda" valor={fmtBRL(v.valorVenda)} cor={CORES.verde} />
        <Kpi label="Valor Financiado" valor={fmtBRL(v.valorFinanciado)} cor="#0891B2" />
        <Kpi label="Recursos Próprios" valor={fmtBRL(v.recursosProprios)} />
        <Kpi label="Subsídio" valor={fmtBRL(v.subsidio)} cor="#9333EA" />
      </KpiGrid>

      <SecaoTitulo>Receita e Custo</SecaoTitulo>
      <KpiGrid>
        <Kpi label="Receita Prevista" valor={fmtBRL(v.valorVenda)} />
        <Kpi label="Receita Recebida" valor={fmtBRL(v.receitaRecebida)} cor={CORES.verde} />
        <Kpi label="Receita Pendente" valor={fmtBRL(v.receitaPendente)} cor={CORES.amarelo} />
        <Kpi label="Custo Previsto" valor={fmtBRL(v.custoPrevisto)} />
        <Kpi label="Custo Realizado" valor={fmtBRL(v.custoRealizado)} cor={CORES.vermelho} />
        <Kpi label="Saldo Disponível" valor={fmtBRL(v.saldoDisponivel)} cor={v.saldoDisponivel >= 0 ? CORES.verde : CORES.vermelho} />
      </KpiGrid>

      <SecaoTitulo>Lucro</SecaoTitulo>
      <KpiGrid>
        <Kpi label="Lucro Previsto" valor={fmtBRL(v.lucroPrevisto)} />
        <Kpi label="Lucro Atual" valor={fmtBRL(v.lucroAtual)} cor={v.lucroAtual >= 0 ? CORES.verde : CORES.vermelho} />
        <Kpi label="Margem Atual" valor={`${v.margemAtual.toFixed(1)}%`} cor={v.margemAtual >= 0 ? CORES.verde : CORES.vermelho} />
      </KpiGrid>

      <SecaoTitulo>Recebimento</SecaoTitulo>
      <KpiGrid>
        <Kpi label="% Financeiro da Obra" valor={`${v.pctFinanceiro.toFixed(1)}%`} />
        <Kpi label="Recebimento Caixa" valor={`${v.pctCaixa.toFixed(1)}%`} />
        <Kpi label="Recebimento Cliente" valor={`${v.pctCliente.toFixed(1)}%`} />
        <Kpi label="Total a Receber" valor={fmtBRL(v.totalAReceber)} cor={CORES.amarelo} />
      </KpiGrid>

      <View style={{ marginTop: 4 }} />
    </RelatorioDocument>
  );
}
