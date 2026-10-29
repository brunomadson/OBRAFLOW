import type { StatusTarefa, PrioridadeTarefa, TarefaServico } from "@/types/app.types";

export const STATUS_TAREFA: { id: StatusTarefa; label: string; cor: string }[] = [
  { id: "a_fazer",      label: "A Fazer",      cor: "#94A3B8" },
  { id: "em_andamento", label: "Em Andamento", cor: "#3B82F6" },
  { id: "em_revisao",   label: "Em Revisão",   cor: "#F59E0B" },
  { id: "aprovado",     label: "Aprovado",     cor: "#8B5CF6" },
  { id: "concluido",    label: "Concluído",    cor: "#10B981" },
];

export const PRIORIDADES_TAREFA: { id: PrioridadeTarefa; label: string; cor: string }[] = [
  { id: "baixa", label: "Baixa", cor: "#94A3B8" },
  { id: "media", label: "Média", cor: "#F59E0B" },
  { id: "alta",  label: "Alta",  cor: "#EF4444" },
];

// Tarefas criadas antes do Kanban de status (Sprint 13.10) não têm `status`
// — deriva do `feito` pra elas continuarem aparecendo em algum lugar do
// quadro em vez de quebrar.
export function statusDeTarefa(t: TarefaServico): StatusTarefa {
  return t.status ?? (t.feito ? "concluido" : "a_fazer");
}
