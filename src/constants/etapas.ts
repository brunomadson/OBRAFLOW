import type { Etapa } from "@/types/app.types";

export const ETAPAS_LEAD: Etapa[] = [
  { id: "leads",        label: "Lead",               cor: "#6B7280" },
  { id: "simulacao",    label: "Simulação",          cor: "#3B82F6" },
  { id: "reuniao",      label: "Reunião",            cor: "#8B5CF6" },
  { id: "documentacao", label: "Documentação",       cor: "#F59E0B" },
  { id: "analise",      label: "Análise de Crédito", cor: "#F97316" },
  { id: "reprovada",    label: "Reprovada",          cor: "#EF4444" },
  { id: "aprovada",     label: "Aprovada",           cor: "#10B981" },
];

export const FLUXO_LEAD = ["leads", "simulacao", "reuniao", "documentacao", "analise", "aprovada"];

export const ETAPAS_OBRA: Etapa[] = [
  { id: "projeto",      label: "Projeto",      cor: "#6366F1" },
  { id: "licencas",     label: "Licenças",     cor: "#F59E0B" },
  { id: "eng_caixa",    label: "Eng. Caixa",   cor: "#3B82F6" },
  { id: "conformidade", label: "Conformidade", cor: "#8B5CF6" },
  { id: "contrato",     label: "Contrato",     cor: "#06B6D4" },
  { id: "execucao",     label: "Execução",     cor: "#F97316" },
  { id: "entregue",     label: "Entregue",     cor: "#10B981" },
  { id: "stand_by",     label: "Stand By",     cor: "#64748B" },
];

// Stand By fica de fora do fluxo de avanço: entra/sai por botão próprio
// (pausar/retomar), nunca pelo "→ próxima etapa".
export const FLUXO_OBRA = [
  "projeto",
  "licencas",
  "eng_caixa",
  "conformidade",
  "contrato",
  "execucao",
  "entregue",
];

// Etapa em que a obra estava antes de entrar em Stand By — a última do
// obra_log que não seja "stand_by". Usada pra retomar e pro progresso do card.
export function etapaAntesDoStandBy(log: { etapa: string; created_at: string }[] | undefined): string | null {
  const anteriores = (log ?? [])
    .filter((l) => l.etapa !== "stand_by")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return anteriores[0]?.etapa ?? null;
}

export const ETAPAS_SERVICO: Etapa[] = [
  { id: "novo_lead",   label: "Novo Lead",   cor: "#6B7280" },
  { id: "contato",     label: "Contato",     cor: "#3B82F6" },
  { id: "proposta",    label: "Proposta",    cor: "#8B5CF6" },
  { id: "negociacao",  label: "Negociação",  cor: "#F59E0B" },
  { id: "contrato",    label: "Contrato",    cor: "#06B6D4" },
  { id: "execucao",    label: "Execução",    cor: "#F97316" },
  { id: "concluido",   label: "Concluído",   cor: "#10B981" },
];

export const FLUXO_SERVICO = [
  "novo_lead",
  "contato",
  "proposta",
  "negociacao",
  "contrato",
  "execucao",
  "concluido",
];
