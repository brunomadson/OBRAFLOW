import { StyleSheet } from "@react-pdf/renderer";

export const CORES = {
  texto: "#1E293B",
  textoClaro: "#64748B",
  linha: "#E2E8F0",
  fundo: "#F8FAFC",
  azul: "#3B82F6",
  verde: "#10B981",
  vermelho: "#EF4444",
  amarelo: "#F59E0B",
};

export const styles = StyleSheet.create({
  page: {
    padding: "28 32 60 32",
    fontSize: 9,
    fontFamily: "Helvetica",
    color: CORES.texto,
  },

  // Cabeçalho
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: `2 solid ${CORES.azul}`,
    paddingBottom: 10,
    marginBottom: 14,
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: CORES.azul,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  logoTexto: { color: "#FFFFFF", fontSize: 13, fontFamily: "Helvetica-Bold" },
  empresaNome: { fontSize: 13, fontFamily: "Helvetica-Bold", color: CORES.texto },
  empresaLinha: { flexDirection: "row", alignItems: "center" },
  tituloRelatorio: { fontSize: 10, color: CORES.textoClaro, marginTop: 2 },
  cabecalhoDireita: { alignItems: "flex-end" },
  metaLinha: { fontSize: 8, color: CORES.textoClaro, marginBottom: 1 },

  // Info da obra
  obraBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: CORES.fundo,
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  obraCampo: { flexDirection: "column" },
  obraLabel: { fontSize: 7, color: CORES.textoClaro, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  obraValor: { fontSize: 10, fontFamily: "Helvetica-Bold", color: CORES.texto },

  // Seções
  secaoTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: CORES.textoClaro,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },

  // KPI grid
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  kpiBox: {
    width: "25%",
    padding: 3,
  },
  kpiInner: {
    border: `1 solid ${CORES.linha}`,
    borderRadius: 5,
    padding: 7,
    alignItems: "center",
  },
  kpiLabel: { fontSize: 6.5, color: CORES.textoClaro, textTransform: "uppercase", marginBottom: 3, textAlign: "center" },
  kpiValor: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center" },

  // Tabela
  tabela: { marginTop: 4 },
  tabelaHead: {
    flexDirection: "row",
    backgroundColor: CORES.fundo,
    borderBottom: `1 solid ${CORES.linha}`,
    paddingVertical: 5,
  },
  tabelaRow: {
    flexDirection: "row",
    borderBottom: `0.5 solid ${CORES.linha}`,
    paddingVertical: 4,
  },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: CORES.textoClaro, textTransform: "uppercase" },
  td: { fontSize: 8, color: CORES.texto },

  // Rodapé
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    borderTop: `0.5 solid ${CORES.linha}`,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rodapeTexto: { fontSize: 7, color: CORES.textoClaro },
});
