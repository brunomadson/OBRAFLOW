import type { ConfigPrazos } from "@/types/app.types";

export const CONFIG_PADRAO: ConfigPrazos = {
  analise_credito_horas:           48,
  analise_credito_alerta_horas:    36,
  documentacao_alerta_dias:        2,
  documentacao_critico_dias:       4,
  projeto_arquitetonico_dias:      7,
  projeto_arquitetonico_alerta:    5,
  projeto_complementar_dias:       7,
  projeto_complementar_alerta:     5,
  solicitacao_eng_alerta_dias:     3,
  vistoria_eng_caixa_dias:         7,
  laudo_eng_caixa_dias:            14,
  laudo_apos_solicitada_dias:      10,
  conformidade_dias:               5,
  conformidade_alerta_dias:        4,
  contrato_apos_conforme_dias:     5,
  pls_intervalo_dias:              30,
  pls_alerta_dias:                 25,
  pagamento_apos_laudo_dias:       5,
  pagamento_apos_laudo_alerta:     4,
  pagamento_dias_uteis:            5,
  pagamento_alerta_dias_uteis:     4,
};

export const GRUPOS_CONFIG = [
  {
    id: "comercial",
    label: "Setor Comercial",
    emoji: "💼",
    cor: "#3B82F6",
    itens: [
      { key: "analise_credito_horas",        label: "Prazo máximo — Análise de Crédito",     desc: "Horas para o correspondente retornar após o envio.",           unidade: "horas" },
      { key: "analise_credito_alerta_horas", label: "Alerta antecipado — Análise de Crédito",desc: "Horas antes do prazo para disparar alerta amarelo.",            unidade: "horas" },
      { key: "documentacao_alerta_dias",     label: "Alerta antecipado — Documentação",      desc: "Dias parado em Documentação para disparar alerta.",            unidade: "dias"  },
      { key: "documentacao_critico_dias",    label: "Prazo crítico — Documentação",          desc: "Dias parado em Documentação para disparar crítico.",           unidade: "dias"  },
    ],
  },
  {
    id: "projeto",
    label: "Projeto Arquitetônico",
    emoji: "📐",
    cor: "#6366F1",
    itens: [
      { key: "projeto_arquitetonico_dias",   label: "Prazo máximo — Arquitetônico",     desc: "Dias após início da obra para entrega do projeto arquitetônico.", unidade: "dias" },
      { key: "projeto_arquitetonico_alerta", label: "Alerta antecipado — Arquitetônico",desc: "Dias antes do prazo para disparar alerta.",                      unidade: "dias" },
      { key: "projeto_complementar_dias",    label: "Prazo máximo — Complementares",    desc: "Dias para entrega dos projetos complementares.",                  unidade: "dias" },
      { key: "projeto_complementar_alerta",  label: "Alerta antecipado — Complementares",desc: "Dias antes do prazo complementares para alerta.",               unidade: "dias" },
    ],
  },
  {
    id: "engenharia",
    label: "Engenharia Caixa",
    emoji: "🏦",
    cor: "#F97316",
    itens: [
      { key: "solicitacao_eng_alerta_dias",  label: "Alerta — Solicitação sem vistoria",  desc: "Dias após 'Solicitado' sem vistoria registrada.",               unidade: "dias" },
      { key: "vistoria_eng_caixa_dias",      label: "Prazo — Vistoria após envio",        desc: "Dias para vistoria após envio da medição à Caixa.",             unidade: "dias" },
      { key: "laudo_eng_caixa_dias",         label: "Prazo — Laudo após envio",           desc: "Dias para laudo após envio da medição.",                        unidade: "dias" },
      { key: "laudo_apos_solicitada_dias",   label: "Prazo — Laudo após Solicitada",      desc: "Dias após medição 'Solicitada' para laudo emitido.",            unidade: "dias" },
    ],
  },
  {
    id: "conformidade",
    label: "Conformidade & Contrato",
    emoji: "📋",
    cor: "#8B5CF6",
    itens: [
      { key: "conformidade_dias",            label: "Prazo — Retorno conforme/inconforme",  desc: "Dias para retorno após envio dos docs.",                     unidade: "dias" },
      { key: "conformidade_alerta_dias",     label: "Alerta antecipado — Conformidade",     desc: "Dias antes do prazo de conformidade para alerta.",           unidade: "dias" },
      { key: "contrato_apos_conforme_dias",  label: "Prazo — Contrato após Conforme",       desc: "Dias após 'Conforme' para assinar o contrato.",              unidade: "dias" },
    ],
  },
  {
    id: "medicoes",
    label: "Medições (PLS)",
    emoji: "📊",
    cor: "#10B981",
    itens: [
      { key: "pls_intervalo_dias",           label: "Intervalo máximo entre medições",       desc: "Dias máximos entre medições na fase de execução.",           unidade: "dias" },
      { key: "pls_alerta_dias",              label: "Alerta de PLS",                         desc: "Dias para alerta antes do intervalo máximo.",               unidade: "dias" },
      { key: "pagamento_apos_laudo_dias",    label: "Prazo — Pagamento após laudo",          desc: "Dias para liberação do pagamento após laudo emitido.",       unidade: "dias" },
      { key: "pagamento_apos_laudo_alerta",  label: "Alerta antecipado — Pagamento",         desc: "Dias antes do prazo de pagamento para alerta.",             unidade: "dias" },
    ],
  },
];
