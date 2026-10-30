import { View, Text } from "@react-pdf/renderer";
import { RelatorioDocument, SecaoTitulo, KpiGrid, Kpi, CORES, type ContextoRelatorio } from "../RelatorioBase";
import { styles } from "../theme";
import { fmtBRL, fmtDate, statusReal } from "@/lib/utils";
import type { Lancamento, Obra } from "@/types/app.types";

function statusLabel(l: Lancamento): string {
  const status = statusReal(l);
  if (status === "pago") return "Pago";
  if (status === "vencido") return "Vencido";
  return "A vencer";
}

export function gerarRelatorioLancamentos(
  ctx: Omit<ContextoRelatorio, "tituloRelatorio">,
  lancamentos: Lancamento[],
  obras: Obra[]
) {
  const entradas = lancamentos.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
  const saidas = lancamentos.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);
  const saldo = entradas - saidas;

  return (
    <RelatorioDocument ctx={{ ...ctx, tituloRelatorio: `Relatório — Lançamentos (${lancamentos.length} registros)` }}>
      <KpiGrid>
        <Kpi label="Entradas" valor={fmtBRL(entradas)} cor={CORES.verde} />
        <Kpi label="Saídas" valor={fmtBRL(saidas)} cor={CORES.vermelho} />
        <Kpi label="Saldo" valor={fmtBRL(saldo)} cor={saldo >= 0 ? CORES.azul : CORES.vermelho} />
        <Kpi label="Registros" valor={String(lancamentos.length)} />
      </KpiGrid>

      <SecaoTitulo>Lançamentos</SecaoTitulo>
      <View style={styles.tabela}>
        <View style={styles.tabelaHead}>
          <Text style={[styles.th, { width: "10%" }]}>Data</Text>
          <Text style={[styles.th, { width: "16%" }]}>Categoria</Text>
          <Text style={[styles.th, { width: "24%" }]}>Descrição</Text>
          <Text style={[styles.th, { width: "16%" }]}>Obra</Text>
          <Text style={[styles.th, { width: "12%" }]}>Status</Text>
          <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>Valor</Text>
        </View>
        {lancamentos.map((l) => {
          const obra = obras.find((o) => o.id === l.obra_id);
          return (
            <View key={l.id} style={styles.tabelaRow} wrap={false}>
              <Text style={[styles.td, { width: "10%" }]}>{fmtDate(l.data)}</Text>
              <Text style={[styles.td, { width: "16%" }]}>{l.categoria || "—"}</Text>
              <Text style={[styles.td, { width: "24%" }]}>{l.descricao}</Text>
              <Text style={[styles.td, { width: "16%" }]}>{obra?.cliente ?? obra?.nome ?? "—"}</Text>
              <Text style={[styles.td, { width: "12%" }]}>{statusLabel(l)}</Text>
              <Text style={[styles.td, { width: "12%", textAlign: "right", color: l.tipo === "entrada" ? CORES.verde : CORES.vermelho }]}>
                {l.tipo === "entrada" ? "+" : "-"}{fmtBRL(l.valor)}
              </Text>
            </View>
          );
        })}
      </View>
    </RelatorioDocument>
  );
}
