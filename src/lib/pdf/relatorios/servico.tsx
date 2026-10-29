import { View, Text, Page, Document } from "@react-pdf/renderer";
import { Cabecalho, Rodape, SecaoTitulo, KpiGrid, Kpi, CORES } from "../RelatorioBase";
import { styles } from "../theme";
import { fmtBRL, fmtDate, statusReal } from "@/lib/utils";
import { ETAPAS_SERVICO } from "@/constants/etapas";
import { agruparTarefas } from "@/lib/tarefasGrupos";
import type { Servico, Lancamento } from "@/types/app.types";

// Relatório de Serviços Técnicos — reaproveita Cabecalho/Rodape/SecaoTitulo/
// Kpi/KpiGrid de RelatorioBase.tsx (peças genéricas), mas não usa
// RelatorioDocument/InfoObra porque aqueles são Obra-específicos ("Obra /
// Cliente", "Cidade"). Aqui a "info box" é Cliente + Serviço + Indicador.

export interface ContextoRelatorioServico {
  empresaNome: string;
  usuarioNome: string;
  clienteNome: string;
  servicoNome: string;
}

function InfoServico({ ctx }: { ctx: ContextoRelatorioServico }) {
  return (
    <View style={styles.obraBox}>
      <View style={styles.obraCampo}>
        <Text style={styles.obraLabel}>Cliente</Text>
        <Text style={styles.obraValor}>{ctx.clienteNome}</Text>
      </View>
      <View style={styles.obraCampo}>
        <Text style={styles.obraLabel}>Serviço</Text>
        <Text style={styles.obraValor}>{ctx.servicoNome}</Text>
      </View>
    </View>
  );
}

function statusLabel(l: Lancamento): string {
  const st = statusReal(l);
  if (st === "pago") return "Pago";
  if (st === "vencido") return "Vencido";
  return "A vencer";
}

export function gerarRelatorioServico(
  ctx: Omit<ContextoRelatorioServico, "servicoNome">,
  servico: Servico,
  lancamentosServico: Lancamento[]
) {
  const nomeServico = servico.catalogoServico?.nome ?? "Serviço Técnico";
  const ctxCompleto: ContextoRelatorioServico = { ...ctx, servicoNome: nomeServico };

  const entradas = lancamentosServico.filter((l) => l.tipo === "entrada");
  const saidas = lancamentosServico.filter((l) => l.tipo === "saida");
  const recebido = entradas.filter((l) => statusReal(l) === "pago").reduce((s, l) => s + l.valor, 0);
  const aReceber = entradas.filter((l) => statusReal(l) !== "pago").reduce((s, l) => s + l.valor, 0);
  const comissaoTotal = saidas.reduce((s, l) => s + l.valor, 0);

  const etapaAtual = ETAPAS_SERVICO.find((e) => e.id === servico.etapa);
  const tarefas = servico.tarefas ?? [];
  const tarefasFeitas = tarefas.filter((t) => t.feito).length;
  const gruposTarefas = agruparTarefas(tarefas);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Cabecalho ctx={{ empresaNome: ctx.empresaNome, usuarioNome: ctx.usuarioNome, tituloRelatorio: `Relatório de Serviço — ${etapaAtual?.label ?? servico.etapa}` }} />
        <InfoServico ctx={ctxCompleto} />

        <KpiGrid>
          <Kpi label="Valor da Proposta" valor={fmtBRL(servico.valor_proposta ?? 0)} />
          <Kpi label="Recebido" valor={fmtBRL(recebido)} cor={CORES.verde} />
          <Kpi label="A Receber" valor={fmtBRL(aReceber)} cor={CORES.amarelo} />
          <Kpi label="Comissão de Indicação" valor={fmtBRL(comissaoTotal)} />
        </KpiGrid>

        {servico.indicador && (
          <>
            <SecaoTitulo>Indicação</SecaoTitulo>
            <Text style={styles.td}>
              {servico.indicador.nome} — {servico.indicador_pct ?? 0}% sobre o valor da proposta
            </Text>
          </>
        )}

        <SecaoTitulo>{`Tarefas (${tarefasFeitas}/${tarefas.length})`}</SecaoTitulo>
        {tarefas.length === 0 ? (
          <Text style={styles.td}>Nenhuma tarefa cadastrada.</Text>
        ) : (
          gruposTarefas.map(({ grupo, itens }) => (
            <View key={grupo} style={{ marginBottom: 8 }}>
              <Text style={[styles.th, { marginBottom: 3, textTransform: "none" }]}>{grupo}</Text>
              <View style={styles.tabela}>
                <View style={styles.tabelaHead}>
                  <Text style={[styles.th, { width: "44%" }]}>Tarefa</Text>
                  <Text style={[styles.th, { width: "16%" }]}>Início</Text>
                  <Text style={[styles.th, { width: "16%" }]}>Fim</Text>
                  <Text style={[styles.th, { width: "24%" }]}>Status</Text>
                </View>
                {itens.map((t) => (
                  <View key={t.id} style={styles.tabelaRow} wrap={false}>
                    <Text style={[styles.td, { width: "44%" }]}>{t.texto}</Text>
                    <Text style={[styles.td, { width: "16%" }]}>{t.data_inicio ? fmtDate(t.data_inicio) : "—"}</Text>
                    <Text style={[styles.td, { width: "16%" }]}>{t.data_prevista ? fmtDate(t.data_prevista) : "—"}</Text>
                    <Text style={[styles.td, { width: "24%", color: t.feito ? CORES.verde : CORES.textoClaro }]}>
                      {t.feito ? "Concluída" : "Pendente"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <SecaoTitulo>{`Financeiro (${lancamentosServico.length} lançamentos)`}</SecaoTitulo>
        {lancamentosServico.length === 0 ? (
          <Text style={styles.td}>Nenhum lançamento ainda.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.tabelaHead}>
              <Text style={[styles.th, { width: "12%" }]}>Data</Text>
              <Text style={[styles.th, { width: "36%" }]}>Descrição</Text>
              <Text style={[styles.th, { width: "20%" }]}>Categoria</Text>
              <Text style={[styles.th, { width: "16%" }]}>Status</Text>
              <Text style={[styles.th, { width: "16%", textAlign: "right" }]}>Valor</Text>
            </View>
            {lancamentosServico.map((l) => (
              <View key={l.id} style={styles.tabelaRow} wrap={false}>
                <Text style={[styles.td, { width: "12%" }]}>{fmtDate(l.data)}</Text>
                <Text style={[styles.td, { width: "36%" }]}>{l.descricao}</Text>
                <Text style={[styles.td, { width: "20%" }]}>{l.categoria || "—"}</Text>
                <Text style={[styles.td, { width: "16%" }]}>{statusLabel(l)}</Text>
                <Text style={[styles.td, { width: "16%", textAlign: "right", color: l.tipo === "entrada" ? CORES.verde : CORES.vermelho }]}>
                  {l.tipo === "entrada" ? "+" : "-"}{fmtBRL(l.valor)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {servico.anotacoes && (
          <>
            <SecaoTitulo>Observações</SecaoTitulo>
            <Text style={styles.td}>{servico.anotacoes}</Text>
          </>
        )}

        <Rodape />
      </Page>
    </Document>
  );
}
