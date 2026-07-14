import type { CodigoIntegracao } from "@/types/app.types";

// Só decoração de UI — a disponibilidade real vem do banco (plano_integracoes).
export const ICONE_INTEGRACAO: Record<CodigoIntegracao, string> = {
  whatsapp:           "💬",
  google_drive:       "📁",
  google_agenda:      "📅",
  ia:                 "🤖",
  open_finance:       "🏦",
  importacao_externa: "📥",
};

// Espelha o registry de src/services/integrations/core/integration-manager.ts
// (arquivo server-only, não pode ser importado por componente client) — só
// pra saber se o botão "Conectar" deve ficar habilitado. A validação de
// verdade continua sendo feita no backend (integration-manager.ts), isto
// aqui é só pra não mostrar um botão que vai dar erro 100% das vezes.
export const INTEGRACOES_COM_PROVIDER: CodigoIntegracao[] = ["google_drive", "google_agenda"];

export const CATEGORIA_LABEL: Record<string, string> = {
  produtividade: "Produtividade",
  comunicacao:   "Comunicação",
  ia:            "Inteligência Artificial",
  financeiro:    "Financeiro",
  dados:         "Dados",
};
