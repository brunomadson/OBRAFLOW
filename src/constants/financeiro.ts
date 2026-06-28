// ─── Cores por grupo ──────────────────────────────────────────────────────────
export const GRUPOS_COR: Record<string, string> = {
  "Custo Obra":    "#3B82F6",
  "Administrativo":"#8B5CF6",
  "Operacional":   "#06B6D4",
  "Comercial":     "#F59E0B",
  "Impostos":      "#EF4444",
  "Marketing":     "#EC4899",
  "Outros":        "#94A3B8",
  "Receita Obras": "#10B981",
  "Receita Outras":"#34D399",
  "Capital":       "#6366F1",
};

// ─── 19 categorias de saída em 7 grupos ──────────────────────────────────────
export const CATEGORIAS_SAIDA: Record<string, string[]> = {
  "Custo Obra":    ["Material de construção", "Mão de obra", "Projetos e taxas técnicas"],
  "Administrativo":["Salário / Pro-labore", "Aluguel", "Contador / Contabilidade"],
  "Operacional":   ["Combustível", "Cartório"],
  "Comercial":     ["Comissão corretor", "Bônus indicação"],
  "Impostos":      ["DAS / Simples Nacional", "ISS", "Tarifas bancárias", "INSS", "FGTS"],
  "Marketing":     ["Influenciador", "Tráfego pago"],
  "Outros":        ["Outros"],
};

// ─── 7 categorias de entrada em 3 grupos ─────────────────────────────────────
export const CATEGORIAS_ENTRADA: Record<string, string[]> = {
  "Receita Obras": ["Medição Caixa", "Adiantamento cliente", "Venda de lote"],
  "Receita Outras":["Receita diversa"],
  "Capital":       ["Aporte sócio", "Empréstimo", "Investidor"],
};

// ─── Lookup: categoria → grupo ────────────────────────────────────────────────
export const GRUPO_DE_CATEGORIA: Record<string, string> = {};
for (const [g, cats] of Object.entries(CATEGORIAS_SAIDA))
  cats.forEach((c) => { GRUPO_DE_CATEGORIA[c] = g; });
for (const [g, cats] of Object.entries(CATEGORIAS_ENTRADA))
  cats.forEach((c) => { GRUPO_DE_CATEGORIA[c] = g; });

// ─── Formas de pagamento ──────────────────────────────────────────────────────
export const FORMAS_PAGAMENTO = [
  "Pix", "Transferência", "Boleto",
  "Cartão Débito", "Cartão Crédito", "Dinheiro", "Cheque",
] as const;

// ─── Grupos DRE em ordem ──────────────────────────────────────────────────────
export const GRUPOS_SAIDA_ORDEM = [
  "Custo Obra", "Administrativo", "Operacional", "Comercial", "Impostos", "Marketing", "Outros",
];

export const GRUPOS_SAIDA_DRE: Record<string, { titulo: string; cor: string }> = {
  "Custo Obra":    { titulo: "Custo das Obras",          cor: "#3B82F6" },
  "Administrativo":{ titulo: "Despesas Administrativas", cor: "#8B5CF6" },
  "Operacional":   { titulo: "Despesas Operacionais",    cor: "#06B6D4" },
  "Comercial":     { titulo: "Despesas Comerciais",      cor: "#F59E0B" },
  "Impostos":      { titulo: "Impostos e Encargos",      cor: "#EF4444" },
  "Marketing":     { titulo: "Marketing",                cor: "#EC4899" },
  "Outros":        { titulo: "Outros",                   cor: "#94A3B8" },
};
