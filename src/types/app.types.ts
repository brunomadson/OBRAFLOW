// ─── Domínio: Usuário / Perfil ────────────────────────────────────────────────
export type UserStatus = "ativo" | "inativo" | "pendente";

export interface Profile {
  id: string;
  nome: string;
  cargo: string;
  cpf: string | null;
  email: string;
  status: UserStatus;
  cor: string;
  setores: string[];
}

// ─── Domínio: Etapas ──────────────────────────────────────────────────────────
export interface Etapa {
  id: string;
  label: string;
  cor: string;
}

// ─── Domínio: Cidade ──────────────────────────────────────────────────────────
export interface Cidade {
  id: string;
  nome: string;
  ativo: boolean;
}

// ─── Domínio: Correspondente ──────────────────────────────────────────────────
export interface Correspondente {
  id: string;
  nome: string;       // nome da pessoa (ex: Genilza)
  agencia: string | null; // agência (ex: Agência Presidente Dutra)
  contato: string | null; // telefone
  email: string | null;
  cidade: string | null;
  banco: string | null;
  ativo: boolean;
  obs: string | null;
}

// ─── Domínio: Corretor ────────────────────────────────────────────────────────
export interface Corretor {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
}

// ─── Domínio: Lead ────────────────────────────────────────────────────────────
export type ComMuro = "sem_muro" | "com_muro" | "muro_parcial";
export type EtapaLead =
  | "leads"
  | "simulacao"
  | "reuniao"
  | "documentacao"
  | "analise"
  | "reprovada"
  | "aprovada";


export interface LeadLog {
  id: string;
  lead_id: string;
  etapa: string;
  dados_extras: Record<string, unknown> | null;
  created_at: string;
}

export interface Lead {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  nascimento: string | null;
  origem: string;
  indicado_por: string | null;
  corretor: string | null;
  corretor_id: string | null;
  origem_recurso: string | null;
  renda_bruta: number | null;
  tipo_renda: string | null;
  modalidade: string | null;
  dependente: boolean;
  fgts_3anos: boolean;
  com_conjuge: boolean;
  cidade: string | null;
  tamanho_imovel: string | null;
  com_muro: ComMuro | null;
  data_contato: string | null;
  data_reuniao: string | null;
  local_reuniao: string | null;
  responsavel_id: string | null;
  valor_caixa: number | null;
  valor_venda: number | null;
  valor_lote: number | null;
  valor_subsidio: number | null;
  valor_financiamento: number | null;
  obs: string | null;
  etapa: EtapaLead;
  enviado_para_obras: boolean;
  data_envio_obras: string | null;
  correspondente_id: string | null;
  created_at: string;
  updated_at: string;
  // joins
  log?: LeadLog[];
  responsavel?: Profile | null;
  correspondente?: Correspondente | null;
}

// ─── Domínio: Obra ────────────────────────────────────────────────────────────
export type EtapaObra =
  | "projeto"
  | "licencas"
  | "eng_caixa"
  | "conformidade"
  | "contrato"
  | "execucao"
  | "entregue";

export type StatusItem = "pendente" | "concluido" | "nao_necessario";
export type StatusMedicao = "a_solicitar" | "solicitada" | "laudo_emitido" | "paga";

export interface ProjetoObra {
  arquitetonico: StatusItem;
  dtArquitetonico: string;
  complementares: StatusItem;
  dtComplementares: string;
}

export interface LicencasObra {
  art: StatusItem;
  dtArt: string;
  pci: StatusItem;
  dtPci: string;
  projetoLegal: StatusItem;
  dtProjetoLegalSolicitado: string;
  dtProjetoLegalAprovado: string;
  usoOcupacao: StatusItem;
  dtUsoOcupacaoSolicitado: string;
  dtUsoOcupacaoAprovado: string;
}

export interface EngCaixaObra {
  enviado: StatusItem;
  dtEnviado: string;
  solicitado: StatusItem;
  dtSolicitado: string;
  boletoPago: StatusItem;
  dtBoletoPago: string;
  vistoriaRealizada: StatusItem;
  dtVistoria: string;
  laudoEmitido: StatusItem;
  dtLaudo: string;
}

export interface ConformidadeObra {
  docsGerados: StatusItem;
  dtDocsGerados: string;
  docsAssinados: StatusItem;
  dtDocsAssinados: string;
  docsEnviados: StatusItem;
  dtDocsEnviados: string;
  conforme: StatusItem;
  dtConforme: string;
  inconforme: StatusItem;
  dtInconforme: string;
}

export interface ObraLog {
  id: string;
  obra_id: string;
  etapa: string;
  created_at: string;
}

export interface MedicaoHistoricoEntry {
  status: StatusMedicao;
  data: string;
}

export interface Medicao {
  id: string;
  obra_id: string;
  nome: string;
  pct_solicitada: number | null;
  pct_liberada: number | null;
  valor_liberado: number | null;
  status: StatusMedicao;
  data_envio_caixa: string | null;
  data_laudo: string | null;
  data_liberacao: string | null;
  historico: MedicaoHistoricoEntry[] | null;
  created_at: string;
  updated_at: string;
}

export interface Obra {
  id: string;
  lead_id: string | null;
  // DB usa "cliente" como nome principal da obra
  cliente: string | null;
  nome: string | null;        // alias / legado
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  nascimento: string | null;
  cidade: string | null;
  modalidade: string | null;
  endereco: string | null;
  engenheiro: string | null;
  correspondente_id: string | null;
  responsavel_id: string | null;
  tamanho_imovel: string | null;
  com_muro: ComMuro | null;
  valor_obra: number | null;
  valor_caixa: number | null;
  valor_venda: number | null;
  valor_lote: number | null;
  valor_subsidio: number | null;
  valor_financiamento: number | null;
  renda_bruta: number | null;
  tipo_renda: string | null;
  dependente: boolean;
  fgts_3anos: boolean;
  com_conjuge: boolean;
  origem: string | null;
  corretor: string | null;
  corretor_id: string | null;
  indicado_por: string | null;
  origem_recurso: string | null;
  responsavel_comercial_id: string | null;
  data_contato: string | null;
  data_reuniao: string | null;
  data_inicio: string | null;
  prazo_conclusao: string | null;
  anotacoes_comercial: string | null;
  data_assinatura: string | null;
  previsao_termino: string | null;
  etapa: EtapaObra;
  progresso: number;
  pls: string | null;
  obs: string | null;
  projeto: ProjetoObra;
  licencas: LicencasObra;
  eng_caixa: EngCaixaObra;
  conformidade: ConformidadeObra;
  created_at: string;
  updated_at: string;
  // joins
  log?: ObraLog[];
  medicoes?: Medicao[];
  correspondente?: Correspondente | null;
}

// ─── Domínio: Financeiro ──────────────────────────────────────────────────────
export type TipoLancamento  = "entrada" | "saida";
export type StatusPagamento = "pendente" | "pago" | "vencido";

export interface Lancamento {
  id: string;
  obra_id: string | null;
  tipo: TipoLancamento;
  categoria: string;
  grupo: string | null;
  descricao: string;
  valor: number;
  data: string;
  data_vencimento: string | null;
  data_confirmacao: string | null;
  forma_pagamento: string | null;
  status_pagamento: StatusPagamento;
  parcela_num: number | null;
  parcela_total: number | null;
  obs: string | null;
  created_at: string;
}

// ─── Domínio: Documento (upload de arquivos) ──────────────────────────────────
export interface Documento {
  id: string;
  lead_id: string | null;
  obra_id: string | null;
  secao: string;
  tipo_doc: string;
  nome_arquivo: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
  usuario_id: string | null;
  ativo: boolean;
}

// ─── Domínio: Histórico ───────────────────────────────────────────────────────
export type TipoHistorico = "lead" | "comercial" | "obras" | "documento" | "medicao" | "sistema";

export interface Historico {
  id: string;
  lead_id: string | null;
  obra_id: string | null;
  tipo: TipoHistorico;
  acao: string;
  usuario_id: string | null;
  usuario_nome: string;
  setor: string | null;
  etapa: string | null;
  created_at: string;
}

// ─── Domínio: Notificações ────────────────────────────────────────────────────
export type TipoNotificacao = "critico" | "alerta" | "info";
export type SetorNotificacao = "comercial" | "obras" | "financeiro";

export interface Notificacao {
  id: number;
  tipo: TipoNotificacao;
  setor: SetorNotificacao;
  titulo: string;
  mensagem: string;
  acao?: string;
  dias?: number;
  horas?: number;
  prazo?: number;
  unidade?: "h" | "du" | "d";
}

// ─── Domínio: Configuração ────────────────────────────────────────────────────
export interface ConfigPrazos {
  analise_credito_horas: number;
  analise_credito_alerta_horas: number;
  documentacao_alerta_dias: number;
  documentacao_critico_dias: number;
  projeto_arquitetonico_dias: number;
  projeto_arquitetonico_alerta: number;
  projeto_complementar_dias: number;
  projeto_complementar_alerta: number;
  solicitacao_eng_alerta_dias: number;
  vistoria_eng_caixa_dias: number;
  laudo_eng_caixa_dias: number;
  laudo_apos_solicitada_dias: number;
  conformidade_dias: number;
  conformidade_alerta_dias: number;
  contrato_apos_conforme_dias: number;
  pls_intervalo_dias: number;
  pls_alerta_dias: number;
  pagamento_apos_laudo_dias: number;
  pagamento_apos_laudo_alerta: number;
  pagamento_dias_uteis: number;
  pagamento_alerta_dias_uteis: number;
}
