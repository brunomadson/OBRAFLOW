import { View, Text, Page, Document } from "@react-pdf/renderer";
import { styles, CORES } from "./theme";

export interface ContextoRelatorio {
  empresaNome: string;
  usuarioNome: string;
  tituloRelatorio: string;
  obraCliente: string;
  obraCidade: string | null;
}

// Só os 3 campos que o cabeçalho realmente usa — assim qualquer contexto de
// relatório (Obra, Serviço Técnico, ...) serve sem precisar do formato
// inteiro de ContextoRelatorio (que carrega campos Obra-específicos).
export function Cabecalho({ ctx }: { ctx: Pick<ContextoRelatorio, "empresaNome" | "usuarioNome" | "tituloRelatorio"> }) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <View style={styles.cabecalho}>
      <View style={styles.empresaLinha}>
        <View style={styles.logoBox}><Text style={styles.logoTexto}>O</Text></View>
        <View>
          <Text style={styles.empresaNome}>{ctx.empresaNome}</Text>
          <Text style={styles.tituloRelatorio}>{ctx.tituloRelatorio}</Text>
        </View>
      </View>
      <View style={styles.cabecalhoDireita}>
        <Text style={styles.metaLinha}>Emitido em {hoje}</Text>
        <Text style={styles.metaLinha}>Responsável: {ctx.usuarioNome}</Text>
      </View>
    </View>
  );
}

function InfoObra({ ctx }: { ctx: ContextoRelatorio }) {
  return (
    <View style={styles.obraBox}>
      <View style={styles.obraCampo}>
        <Text style={styles.obraLabel}>Obra / Cliente</Text>
        <Text style={styles.obraValor}>{ctx.obraCliente}</Text>
      </View>
      <View style={styles.obraCampo}>
        <Text style={styles.obraLabel}>Cidade</Text>
        <Text style={styles.obraValor}>{ctx.obraCidade ?? "—"}</Text>
      </View>
    </View>
  );
}

export function Rodape() {
  return (
    <View style={styles.rodape} fixed>
      <Text style={styles.rodapeTexto}>Gerado automaticamente pelo ObraFlow</Text>
      <Text
        style={styles.rodapeTexto}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

export function SecaoTitulo({ children }: { children: string }) {
  return <Text style={styles.secaoTitulo}>{children}</Text>;
}

export function Kpi({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <View style={styles.kpiBox}>
      <View style={styles.kpiInner}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={[styles.kpiValor, cor ? { color: cor } : {}]}>{valor}</Text>
      </View>
    </View>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.kpiGrid}>{children}</View>;
}

export { CORES };

export function RelatorioDocument({ ctx, children }: { ctx: ContextoRelatorio; children: React.ReactNode }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Cabecalho ctx={ctx} />
        <InfoObra ctx={ctx} />
        {children}
        <Rodape />
      </Page>
    </Document>
  );
}
