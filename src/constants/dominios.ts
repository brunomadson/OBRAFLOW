export const CARGOS = [
  "CEO / Dono",
  "Gerente Comercial",
  "SDR / Vendedor",
  "Coordenador de Obras",
  "Engenheiro",
  "Assistente Administrativo",
  "Financeiro",
];

export const SETORES_ACESSO = [
  { id: "comercial",     label: "Comercial",    emoji: "💼", cor: "#3B82F6" },
  { id: "obras",         label: "Obras",        emoji: "🏗", cor: "#10B981" },
  { id: "financeiro",    label: "Financeiro",   emoji: "💰", cor: "#F59E0B" },
  { id: "notificacoes",  label: "Alertas",      emoji: "🔔", cor: "#EF4444" },
  { id: "configuracoes", label: "Config",       emoji: "⚙",  cor: "#8B5CF6" },
];

export const SETORES_NAV = [
  { id: "comercial",     label: "Comercial",     desc: "Leads & Propostas", emoji: "💼", cor: "#3B82F6" },
  { id: "obras",         label: "Obras",         desc: "Projetos em andamento", emoji: "🏗", cor: "#10B981" },
  { id: "financeiro",    label: "Financeiro",    desc: "Lançamentos", emoji: "💰", cor: "#F59E0B" },
  { id: "notificacoes",  label: "Alertas",       desc: "Prazos & Vencimentos", emoji: "🔔", cor: "#EF4444" },
  { id: "configuracoes", label: "Configurações", desc: "Prazos & Equipe", emoji: "⚙",  cor: "#8B5CF6" },
];

export const ORIGENS = [
  "Captação ativa",
  "Instagram",
  "Indicação",
  "Corretor",
  "Tráfego pago",
];

export const ORIGENS_RECURSO = ["SBPE", "FGTS", "PRO-COTISTA"] as const;

export const COM_MURO_OPTIONS: { value: string; label: string }[] = [
  { value: "sem_muro",    label: "Sem muro" },
  { value: "com_muro",    label: "Com muro" },
  { value: "muro_parcial",label: "Muro parcial" },
];

export const TIPOS_RENDA = [
  "Carteira assinada",
  "Contrato prefeitura/estado",
  "Autônomo",
  "Empresário",
  "Aposentadoria",
];

export const MODALIDADES = [
  "Aquisição de terreno e Construção",
  "Terreno próprio",
];

export const CIDADES = [
  "Pedreiras",
  "São Domingos do Maranhão",
  "Trizidela do Vale",
  "Lima Campos",
  "Peritoro",
  "Tuntum",
  "Presidente Dutra",
  "Capinzal do Norte",
];

export const ENGENHEIROS = [
  "Dr. Carlos Engenheiro",
  "Dra. Ana Técnica",
  "Eng. Roberto Silva",
  "Eng. Paula Costa",
];

export const STATUS_MEDICAO_LABEL: Record<string, string> = {
  a_solicitar:  "A Solicitar",
  solicitada:   "Solicitado",
  laudo_emitido:"Laudo Emitido",
  paga:         "Paga",
};

export const STATUS_MEDICAO_COR: Record<string, string> = {
  a_solicitar:  "#94A3B8",
  solicitada:   "#3B82F6",
  laudo_emitido:"#F97316",
  paga:         "#10B981",
};

export const STATUS_ITEM_LABEL: Record<string, string> = {
  concluido:      "Concluído",
  pendente:       "Pendente",
  nao_necessario: "Não necessário",
};

export const PLS_OPCOES = [
  "PLS 1","PLS 2","PLS 3","PLS 4",
  "PLS 5","PLS 6","PLS 7","PLS 8",
];

export const CORES_USER = [
  "#3B82F6","#10B981","#8B5CF6","#F97316",
  "#EF4444","#F59E0B","#6366F1","#06B6D4",
];

export const LOCAIS_REUNIAO = [
  "Escritório",
  "Videoconferência (Meet)",
  "Videoconferência (Zoom)",
  "Na casa do cliente",
  "Outro",
];

export const MOTIVOS_REPROVACAO = [
  "Score de crédito insuficiente",
  "Renda insuficiente",
  "Restrição no CPF (SPC/Serasa)",
  "Documentação incompleta",
  "Comprometimento de renda acima do limite",
  "Imóvel fora das normas da Caixa",
  "Outro",
];
