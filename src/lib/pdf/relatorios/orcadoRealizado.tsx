import { View, Text } from "@react-pdf/renderer";
import { RelatorioDocument, SecaoTitulo, KpiGrid, Kpi, CORES, type ContextoRelatorio } from "../RelatorioBase";
import { styles } from "../theme";
import { calcularCronogramaMensal, custoMaximoPermitido } from "@/lib/cronogramaFinanceiro";
import { fmtBRL } from "@/lib/utils";
import type { Obra, Lancamento } from "@/types/app.types";

export function gerarRelatorioOrcadoRealizado(
  ctx: Omit<ContextoRelatorio, "tituloRelatorio">,
  obra: Obra,
  lancamentosObra: Lancamento[]
) {
  const linhas = calcularCronogramaMensal(obra, lancamentosObra);
  const custoMaximo = custoMaximoPermitido(obra);
  const valorVenda = obra.valor_venda ?? 0;
  const temDataInicio = !!obra.data_inicio;

  const linhasAteAgora = temDataInicio ? linhas.filter((l) => l.jaComecou) : linhas;
  const totalEntradaPrevisto = linhasAteAgora.reduce((s, l) => s + l.entradaPrevisto, 0);
  const totalEntradaReal = linhasAteAgora.reduce((s, l) => s + (l.entradaReal ?? 0), 0);
  const totalSaidaPrevisto = linhasAteAgora.reduce((s, l) => s + l.saidaPrevisto, 0);
  const totalSaidaReal = linhasAteAgora.reduce((s, l) => s + (l.saidaReal ?? 0), 0);

  return (
    <RelatorioDocument ctx={{ ...ctx, tituloRelatorio: "Relatório — Orçado × Realizado" }}>
      <SecaoTitulo>Receita (Entrada)</SecaoTitulo>
      <KpiGrid>
        <Kpi label="Valor de Venda" valor={fmtBRL(valorVenda)} />
        <Kpi label="Orçado até agora" valor={fmtBRL(totalEntradaPrevisto)} />
        <Kpi label="Realizado" valor={fmtBRL(totalEntradaReal)} cor={totalEntradaReal >= totalEntradaPrevisto ? CORES.verde : CORES.amarelo} />
      </KpiGrid>

      <SecaoTitulo>Custo (Saída)</SecaoTitulo>
      <KpiGrid>
        <Kpi label="Custo Máximo Permitido" valor={fmtBRL(custoMaximo)} />
        <Kpi label="Orçado até agora" valor={fmtBRL(totalSaidaPrevisto)} />
        <Kpi label="Realizado" valor={fmtBRL(totalSaidaReal)} cor={totalSaidaReal > totalSaidaPrevisto ? CORES.vermelho : CORES.verde} />
      </KpiGrid>

      <SecaoTitulo>Cronograma Mensal</SecaoTitulo>
      <View style={styles.tabela}>
        <View style={styles.tabelaHead}>
          <Text style={[styles.th, { width: "10%" }]}>Mês</Text>
          <Text style={[styles.th, { width: "12%" }]}>% Acum.</Text>
          <Text style={[styles.th, { width: "19%", textAlign: "right" }]}>Entr. Orçado</Text>
          <Text style={[styles.th, { width: "19%", textAlign: "right" }]}>Entr. Real</Text>
          <Text style={[styles.th, { width: "20%", textAlign: "right" }]}>Saída Orçado</Text>
          <Text style={[styles.th, { width: "20%", textAlign: "right" }]}>Saída Real</Text>
        </View>
        {linhas.map((l) => (
          <View key={l.mes} style={styles.tabelaRow}>
            <Text style={[styles.td, { width: "10%" }]}>{l.mes}ºM</Text>
            <Text style={[styles.td, { width: "12%" }]}>{l.pctAcumulado}%</Text>
            <Text style={[styles.td, { width: "19%", textAlign: "right" }]}>{fmtBRL(l.entradaPrevisto)}</Text>
            <Text style={[styles.td, { width: "19%", textAlign: "right" }]}>{l.entradaReal != null ? fmtBRL(l.entradaReal) : "—"}</Text>
            <Text style={[styles.td, { width: "20%", textAlign: "right" }]}>{fmtBRL(l.saidaPrevisto)}</Text>
            <Text style={[styles.td, { width: "20%", textAlign: "right" }]}>{l.saidaReal != null ? fmtBRL(l.saidaReal) : "—"}</Text>
          </View>
        ))}
      </View>
    </RelatorioDocument>
  );
}
