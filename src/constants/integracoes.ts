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
