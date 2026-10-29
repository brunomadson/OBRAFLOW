// ─── Domínio: Usuário / Perfil ────────────────────────────────────────────────
export interface Profile {
  id: string;
  nome: string;
  cargo: string;
  cargo_id: string | null;
  ativo: boolean;
  avatar_url: string | null;
  setores: string[];
  workspace_id?: string | null;
}

// ─── Domínio: RBAC (cargos e matriz de permissão) ─────────────────────────────
export type SetorPermissao =
  | "comercial" | "obras" | "financeiro" | "notificacoes" | "configuracoes"
  | "metas" | "membros" | "integracoes" | "documentos" | "servicos-tecnicos";
export type AcaoPermissao = "visualizar" | "criar" | "editar" | "excluir";

export interface Cargo {
  id: string;
  workspace_id?: string | null;
  nome: string;
  sistema: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissaoCargo {
  id: string;
  cargo_id: string;
  setor: SetorPermissao;
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

export interface CargoComPermissoes extends Cargo {
  permissoes: PermissaoCargo[];
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
  workspace_id?: string | null;
}

// ─── Domínio: Serviços Técnicos ───────────────────────────────────────────────
// "Catálogo, não código" (Sprint 13.2) — um serviço novo que a empresa passa
// a vender (ex: "Energia Solar") é uma linha aqui, nunca uma tabela/tela nova.
// Checklist-modelo agrupado por etapa — um serviço de "Reforma" tem um fluxo
// (ex: Levantamento, Execução, Entrega) bem diferente de um "Projeto
// Arquitetônico" (Estudo Preliminar, Detalhamento, Compatibilização) ou de
// um "INSS de Obra". Cada grupo vira uma seção na aba Tarefas quando
// carregado (Sprint 13.7).
export interface GrupoTarefasPadrao {
  grupo: string;
  tarefas: string[];
}

// Colunas do quadro Kanban da aba "Gestão de Projetos" — configuráveis por
// tipo de serviço (Sprint 13.7), já que o fluxo de execução de uma Reforma
// não tem nada a ver com o de um Projeto Arquitetônico ou de um INSS de
// Obra. `id` é estável (não muda ao reordenar/renomear) — é o que
// servico.fase_execucao_id referencia.
export interface FaseExecucao {
  id: string;
  nome: string;
  cor: string;
}

// Categoria do catálogo (Sprint 13.8) — substitui o texto livre que
// catalogo_servicos.categoria era antes; navegação vira Categoria → Serviço.
export interface CategoriaServico {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  workspace_id?: string | null;
}

// Template (Sprint 13.8) — separa "o que se vende" (CatalogoServico) de
// "como se executa" (fases/tarefas). Reutilizável: dois serviços do
// catálogo podem apontar pro mesmo template, ou cada um pro seu.
export interface TemplateServico {
  id: string;
  nome: string;
  descricao: string | null;
  fases_execucao: FaseExecucao[];
  tarefas_padrao: GrupoTarefasPadrao[];
  ativo: boolean;
  workspace_id?: string | null;
  created_at: string;
}

export interface CatalogoServico {
  id: string;
  nome: string;
  // Legado (pré-13.8) — não é mais escrito pela UI, só existe pra não
  // perder o dado das linhas antigas. Categoria de verdade é categoria_id.
  categoria: string | null;
  categoria_id: string | null;
  template_padrao_id: string | null;
  descricao: string | null;
  // Resolvidos a partir do template ligado (template_padrao_id) na leitura
  // — ver catalogoServicos.service.ts. Nunca escritos diretamente mais:
  // quem edita fases/tarefas é o template, não o item do catálogo.
  tarefas_padrao: GrupoTarefasPadrao[];
  fases_execucao: FaseExecucao[];
  ativo: boolean;
  workspace_id?: string | null;
  created_at: string;
  // joins
  categoriaServico?: CategoriaServico | null;
}

// Cadastro próprio — não é só corretor, ver decisão confirmada no
// due-diligence (parceiro, cliente indicando cliente, engenheiro, arquiteto,
// construtora, contador também indicam).
export interface Indicador {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tipo: string | null;
  ativo: boolean;
  workspace_id?: string | null;
}

export type EtapaServico =
  | "novo_lead" | "contato" | "proposta" | "negociacao" | "contrato" | "execucao" | "concluido";

// Sobreposto à etapa, não um passo a mais nela — um serviço em
// etapa="execucao" pode estar parado (paralisado) ou ter sido desistido
// (cancelado) sem sair do funil. Ver Servico.status_execucao.
export type StatusExecucaoServico = "ativo" | "paralisado" | "cancelado";

// Kanban de status da tarefa (Sprint 13.10) — eixo diferente da "Fase de
// Execução" do serviço (FaseExecucao/servico.fase_execucao_id): aquela é 1
// card = 1 serviço inteiro, entre serviços do mesmo tipo; esta é 1 card = 1
// tarefa, dentro de um único serviço.
export type StatusTarefa = "a_fazer" | "em_andamento" | "em_revisao" | "aprovado" | "concluido";
export type PrioridadeTarefa = "baixa" | "media" | "alta";

// Tarefas, Cronograma e o Kanban de status (aba do ModalServico) leem a
// MESMA lista — três renderizações (checklist vs. timeline vs. quadro) do
// mesmo dado, nunca tabelas divergentes.
export interface TarefaServico {
  id: string;
  texto: string;
  // Fonte da verdade pro "concluída" em todo lugar que já lia isso antes do
  // Kanban existir (contadores de progresso, PDF, cards) — sempre mantido
  // em sincronia com status==="concluido" nas mutações (ver
  // AbaTarefasServico). Tarefas antigas sem `status` continuam funcionando
  // pela leitura derivada (ver statusDeTarefa).
  feito: boolean;
  status?: StatusTarefa;
  prioridade?: PrioridadeTarefa;
  responsavel_id?: string | null;
  descricao?: string;
  // Etapa/categoria da tarefa (ex: "Arquitetônico", "Levantamento") — igual
  // ao grupo do template de origem. Ausente = tarefas antigas/avulsas,
  // tratadas como grupo "Geral" na renderização.
  grupo?: string;
  // Início/Fim planejados — usados pro Gantt do Cronograma (duração = a
  // diferença entre os dois). data_prevista continua sendo "a data que
  // importa" pra Tarefas/alertas quando só uma das duas está preenchida.
  data_inicio?: string | null;
  data_prevista?: string | null;
  data_conclusao?: string | null;
}

export interface ServicoLog {
  id: string;
  servico_id: string;
  etapa: string;
  dados_extras: Record<string, unknown> | null;
  criado_em: string;
}

export interface Servico {
  id: string;
  cliente_id: string;
  catalogo_servico_id: string | null;
  etapa: EtapaServico;
  status_execucao: StatusExecucaoServico;
  valor_proposta: number | null;
  indicador_id: string | null;
  indicador_pct: number | null;
  responsavel_id: string | null;
  anotacoes: string | null;
  tarefas: TarefaServico[];
  // Coluna atual no quadro Kanban de execução (ver CatalogoServico.fases_execucao
  // do catalogo_servico deste serviço) — null = tipo sem fases configuradas,
  // ou serviço ainda não chegou em Execução.
  fase_execucao_id: string | null;
  // Preparatórios pra Sprint 13.9 (aplicar template na criação; agrupar
  // vários serviços do mesmo cliente numa única proposta) — sem uso na UI
  // ainda.
  template_id: string | null;
  proposta_id: string | null;
  // Orçamento analítico (Sprint 13.11) — mesmo formato do que Obras usa
  // (ItemComposicaoCusto/EtapaCronogramaMensal, ver aquele domínio), mas é
  // uma feature própria daqui: por serviço (não por proposta, cada
  // disciplina tem seu próprio custo), sem "custo máximo" vindo de
  // valor_venda/lucro% (usa valor_proposta direto), e sem comparação com o
  // realizado (isso é papel do Financeiro, que é unificado por proposta).
  composicao_custos: ItemComposicaoCusto[];
  cronograma_financeiro: EtapaCronogramaMensal[];
  workspace_id?: string | null;
  created_at: string;
  updated_at: string;
  // joins
  log?: ServicoLog[];
  cliente?: Cliente | null;
  catalogoServico?: CatalogoServico | null;
  indicador?: Indicador | null;
  responsavel?: Profile | null;
}

// ─── Domínio: Cliente ───────────────────────────────────────────────────────
// Entidade compartilhada entre Obras e (futuro) Serviços Técnicos — a base
// pra histórico cruzado e LTV. Ver Sprint 13.1.
export interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  email: string | null;
  workspace_id?: string | null;
  created_at: string;
}

// ─── Domínio: Correspondente ──────────────────────────────────────────────────
export interface Correspondente {
  id: string;
  nome: string;
  agencia: string | null;
  contato: string | null;
  email: string | null;
  cidade: string | null;
  banco: string | null;
  ativo: boolean;
  obs: string | null;
  workspace_id?: string | null;
}

// ─── Domínio: Corretor ────────────────────────────────────────────────────────
export interface Corretor {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  workspace_id?: string | null;
}

// ─── Domínio: Conta Bancária ────────────────────────────────────────────────
export interface ContaBancaria {
  id: string;
  nome: string;
  ativo: boolean;
  workspace_id?: string | null;
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
  recursos_proprios: number | null;
  obs: string | null;
  etapa: EtapaLead;
  enviado_para_obras: boolean;
  data_envio_obras: string | null;
  correspondente_id: string | null;
  cliente_id: string | null;
  workspace_id?: string | null;
  created_at: string;
  updated_at: string;
  // joins
  log?: LeadLog[];
  responsavel?: Profile | null;
  correspondente?: Correspondente | null;
  cliente?: Cliente | null;
}

// ─── Domínio: Obra ────────────────────────────────────────────────────────────
export type EtapaObra =
  | "projeto"
  | "licencas"
  | "eng_caixa"
  | "conformidade"
  | "contrato"
  | "execucao"
  | "entregue"
  | "stand_by";

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

// Composição do custo da obra por item de serviço (Barracão, Infraestrutura,
// Supraestrutura...) — o que o usuário chama de "PCI" na conversa, mas o
// campo/coluna não pode se chamar "pci": esse nome já é usado em
// LicencasObra.pci (Projeto de Combate a Incêndio, outro assunto).
export interface ItemComposicaoCusto {
  item: string;
  incidenciaPct: number;
}

// Planejamento mês a mês da obra (% de conclusão acumulada por mês) — vira
// a base do Orçado x Realizado no Financeiro por Obra.
export interface EtapaCronogramaMensal {
  mes: number;
  pctAcumulado: number;
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
  cliente_id: string | null;
  responsavel_id: string | null;
  tamanho_imovel: string | null;
  com_muro: ComMuro | null;
  valor_obra: number | null;
  valor_caixa: number | null;
  valor_venda: number | null;
  valor_lote: number | null;
  valor_subsidio: number | null;
  valor_financiamento: number | null;
  recursos_proprios: number | null;
  lucro_previsto_pct: number | null;
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
  workspace_id?: string | null;
  projeto: ProjetoObra;
  licencas: LicencasObra;
  eng_caixa: EngCaixaObra;
  conformidade: ConformidadeObra;
  composicao_custos: ItemComposicaoCusto[] | null;
  cronograma_financeiro: EtapaCronogramaMensal[] | null;
  created_at: string;
  updated_at: string;
  // joins
  log?: ObraLog[];
  medicoes?: Medicao[];
  correspondente?: Correspondente | null;
  // "cliente" (string) já é o nome de exibição da obra — o registro
  // vinculado na tabela clientes usa um nome de campo diferente pra não
  // colidir.
  clienteRef?: Cliente | null;
}

// ─── Domínio: Financeiro ──────────────────────────────────────────────────────
export type TipoLancamento  = "entrada" | "saida";
export type StatusPagamento = "pendente" | "pago" | "vencido";

export interface Lancamento {
  id: string;
  obra_id: string | null;
  servico_id: string | null;
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
  conta_bancaria_id: string | null;
  obs: string | null;
  workspace_id?: string | null;
  created_at: string;
}

// ─── Domínio: Recebimento ───────────────────────────────────────────────────
// Repasse real de um valor liberado (medição da Caixa) ou de recursos
// próprios — cada um gera automaticamente 1 lançamento (pago) no Financeiro.
export type OrigemRecebimento = "medicao" | "recursos_proprios";

export interface Recebimento {
  id: string;
  obra_id: string;
  origem_tipo: OrigemRecebimento;
  medicao_id: string | null;
  lancamento_id: string | null;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  obs: string | null;
  workspace_id?: string | null;
  created_at: string;
}

// ─── Domínio: Documento (upload de arquivos) ──────────────────────────────────
export interface Documento {
  id: string;
  lead_id: string | null;
  obra_id: string | null;
  servico_id: string | null;
  secao: string;
  tipo_doc: string;
  nome_arquivo: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  storage_path: string;
  usuario_id: string | null;
  ativo: boolean;
  workspace_id?: string | null;
  created_at: string;
}

// ─── Domínio: Histórico ───────────────────────────────────────────────────────
export type TipoHistorico = "lead" | "comercial" | "obras" | "documento" | "medicao" | "sistema" | "servico_tecnico";

export interface Historico {
  id: string;
  lead_id: string | null;
  obra_id: string | null;
  servico_id: string | null;
  tipo: TipoHistorico;
  acao: string;
  usuario_id: string | null;
  usuario_nome: string;
  setor: string | null;
  etapa: string | null;
  workspace_id?: string | null;
  created_at: string;
}

// ─── Domínio: Notificações ────────────────────────────────────────────────────
export type TipoNotificacao = "critico" | "alerta" | "info";
export type SetorNotificacao = "comercial" | "obras" | "financeiro" | "servicos-tecnicos";

export interface Notificacao {
  id: number;
  tipo: TipoNotificacao;
  setor: SetorNotificacao;
  titulo: string;
  mensagem: string;
  acao?: string;
  // Link de ação (ex: abrir a obra na aba certa do Financeiro/Obras).
  href?: string;
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
  recebimento_pendente_alerta_dias: number;
  recebimento_pendente_critico_dias: number;
  obra_sem_movimentacao_dias: number;
  caixa_minimo: number | null;
  servico_sem_movimentacao_dias: number;
}

// ─── Domínio: Metas de Dashboard ──────────────────────────────────────────────
export type IndicadorMeta =
  | "comercial_oportunidades"
  | "comercial_valor_potencial"
  | "comercial_taxa_conversao"
  | "obras_ativas"
  | "obras_valor_liberado_caixa"
  | "financeiro_receita_total";

export interface MetaDashboard {
  id: string;
  workspace_id?: string | null;
  indicador: IndicadorMeta;
  periodo: string; // "YYYY-MM"
  valor_meta: number;
  created_at: string;
  updated_at: string;
}

// ─── Domínio: Integrações ─────────────────────────────────────────────────────
export type CodigoIntegracao =
  | "whatsapp"
  | "google_drive"
  | "google_agenda"
  | "ia"
  | "open_finance"
  | "importacao_externa";

export type StatusIntegracao = "nao_conectado" | "conectado" | "erro";
export type TipoAcessoIntegracao = "essential" | "premium";

export interface Plano {
  id: string;
  codigo: string;
  nome: string;
}

export interface Integracao {
  id: string;
  codigo: CodigoIntegracao;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  provider: string | null;
  categoria: string | null;
  tipo_acesso: TipoAcessoIntegracao;
}

// Visão já resolvida: integração + se o plano do workspace libera + estado de conexão.
export interface IntegracaoComStatus extends Integracao {
  disponivelNoPlano: boolean;
  status: StatusIntegracao;
  temProvider: boolean; // tem implementação real registrada (Sprint 11.1)? se não, botão "Conectar" fica desabilitado.
  lastSync: string | null;
}
