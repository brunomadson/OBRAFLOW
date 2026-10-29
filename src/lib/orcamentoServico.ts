import type { ItemComposicaoCusto } from "@/types/app.types";

// Teto do orçamento analítico do serviço — diferente de Obras
// (valor_venda - lucro_previsto_pct%), aqui é direto o valor da proposta:
// serviço técnico não separa "quanto vendi" de "quanto pretendo lucrar" em
// campos distintos.
export function custoMaximoServico(valorProposta: number | null): number {
  return valorProposta ?? 0;
}

export function somaIncidencia(itens: ItemComposicaoCusto[]): number {
  return itens.reduce((s, i) => s + (i.incidenciaPct || 0), 0);
}

export function valorDoItem(item: ItemComposicaoCusto, custoMaximo: number): number {
  return ((item.incidenciaPct || 0) / 100) * custoMaximo;
}
