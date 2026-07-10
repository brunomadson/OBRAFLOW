// Formatação/parsing de valores monetários em Real (R$).
// O banco continua armazenando number puro — isso afeta só a exibição.

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : parseCurrency(value ?? "");
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseCurrency(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;

  let s = value.replace(/[^\d,.-]/g, "");
  // Vírgula é o separador decimal em pt-BR — pontos antes dela são milhar e somem.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
