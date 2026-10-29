// Agrupamento de tarefas por etapa — usado tanto na aba Tarefas (checklist
// por seção) quanto no Cronograma (timeline por seção) e no relatório PDF.
// Uma função só, três renderizações — nunca lógica de agrupar duplicada.

const PALETA_GRUPOS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#06B6D4", "#EC4899", "#6366F1"];

export function corDoGrupo(grupo: string, ordemGrupos: string[]): string {
  const idx = ordemGrupos.indexOf(grupo);
  return PALETA_GRUPOS[(idx < 0 ? 0 : idx) % PALETA_GRUPOS.length];
}

export interface GrupoDeTarefas<T> {
  grupo: string;
  itens: T[];
}

// Tarefas sem grupo (avulsas, ou criadas antes da Sprint 13.7) caem em
// "Geral" — nunca desaparecem, nunca quebram a tela.
export function agruparTarefas<T extends { grupo?: string }>(tarefas: T[]): GrupoDeTarefas<T>[] {
  const ordem: string[] = [];
  const porGrupo = new Map<string, T[]>();
  for (const t of tarefas) {
    const g = t.grupo?.trim() || "Geral";
    if (!porGrupo.has(g)) { porGrupo.set(g, []); ordem.push(g); }
    porGrupo.get(g)!.push(t);
  }
  return ordem.map((grupo) => ({ grupo, itens: porGrupo.get(grupo)! }));
}
