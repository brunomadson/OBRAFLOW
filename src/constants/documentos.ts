export interface DocItem {
  id: string;
  label: string;
  icone: string;
  multiplo?: boolean;
  quantidade?: number;
  descricao?: string;
  condicao?: string;
}

export const DOCS_PESSOAIS_FIXOS: DocItem[] = [
  { id: "rg",          label: "RG / CNH",                   icone: "🪪" },
  { id: "cpf",         label: "CPF",                         icone: "📄" },
  { id: "certidao",    label: "Certidão de nascimento/casamento", icone: "📜" },
  { id: "compResid",   label: "Comprovante de residência",    icone: "🏠" },
  { id: "extBanco",    label: "Extrato bancário (3 meses)",   icone: "🏦", multiplo:true, quantidade:3, descricao:"últimos 3 meses" },
  { id: "fgtsExtrato", label: "Extrato FGTS",                 icone: "💰", condicao:"fgts3anos" },
];

export const DOCS_CONJUGE: DocItem[] = [
  { id: "conj_rg",       label: "RG / CNH do cônjuge",             icone: "🪪" },
  { id: "conj_cpf",      label: "CPF do cônjuge",                   icone: "📄" },
  { id: "conj_certidao", label: "Certidão de casamento",            icone: "📜" },
];

export const DOCS_DEPENDENTE: DocItem[] = [
  { id: "dep_nascimento", label: "Certidão de nascimento do dependente", icone: "📜" },
  { id: "dep_cpf",        label: "CPF do dependente",                     icone: "📄" },
];

export const DOCS_POR_RENDA: Record<string, { label: string; grupos: DocItem[] }> = {
  "Carteira assinada": {
    label: "Carteira assinada",
    grupos: [
      { id: "holerite1", label: "Holerite (mês 1)", icone: "💵" },
      { id: "holerite2", label: "Holerite (mês 2)", icone: "💵" },
      { id: "holerite3", label: "Holerite (mês 3)", icone: "💵" },
      { id: "ctps",      label: "CTPS (carteira de trabalho)", icone: "📋" },
    ],
  },
  "Contrato prefeitura/estado": {
    label: "Contrato prefeitura/estado",
    grupos: [
      { id: "contracheque1", label: "Contracheque (mês 1)", icone: "💵" },
      { id: "contracheque2", label: "Contracheque (mês 2)", icone: "💵" },
      { id: "contracheque3", label: "Contracheque (mês 3)", icone: "💵" },
      { id: "contratoServidor", label: "Contrato de serviço público", icone: "📋" },
    ],
  },
  "Autônomo": {
    label: "Autônomo",
    grupos: [
      { id: "decore",    label: "DECORE (declaração do contador)", icone: "📋" },
      { id: "irpf",      label: "IRPF última declaração",           icone: "📊" },
      { id: "extAut1",   label: "Extrato bancário (mês 1)",         icone: "🏦" },
      { id: "extAut2",   label: "Extrato bancário (mês 2)",         icone: "🏦" },
      { id: "extAut3",   label: "Extrato bancário (mês 3)",         icone: "🏦" },
    ],
  },
  "Empresário": {
    label: "Empresário",
    grupos: [
      { id: "contrato_social", label: "Contrato Social",          icone: "📋" },
      { id: "irpf_emp",        label: "IRPJ última declaração",    icone: "📊" },
      { id: "extEmp1",         label: "Extrato bancário (mês 1)",  icone: "🏦" },
      { id: "extEmp2",         label: "Extrato bancário (mês 2)",  icone: "🏦" },
      { id: "extEmp3",         label: "Extrato bancário (mês 3)",  icone: "🏦" },
    ],
  },
  "Aposentadoria": {
    label: "Aposentadoria",
    grupos: [
      { id: "extrato_inss1", label: "Extrato INSS (mês 1)", icone: "👴" },
      { id: "extrato_inss2", label: "Extrato INSS (mês 2)", icone: "👴" },
      { id: "extrato_inss3", label: "Extrato INSS (mês 3)", icone: "👴" },
    ],
  },
};

export const DOCS_ENG_CONFORMIDADE: DocItem[] = [
  { id: "art",      label: "ART do Engenheiro",         icone: "📋" },
  { id: "pci",      label: "PCI (Planilha de Custos)",  icone: "📊" },
  { id: "memorial", label: "Memorial Descritivo",        icone: "📝" },
  { id: "cronograma",label: "Cronograma Físico-Financeiro", icone: "📅" },
];

export const DOCS_PROJETOS: DocItem[] = [
  { id: "proj_arq",  label: "Projeto Arquitetônico", icone: "🏠" },
  { id: "proj_est",  label: "Projeto Estrutural",    icone: "🏗" },
  { id: "proj_ele",  label: "Projeto Elétrico",      icone: "⚡" },
  { id: "proj_hid",  label: "Projeto Hidrossanitário",icone: "💧" },
];

export const DOCS_CONTRATO: DocItem[] = [
  { id: "contrato_assinado", label: "Contrato assinado pela Caixa", icone: "✍" },
  { id: "matricula",         label: "Matrícula do imóvel atualizada", icone: "📜" },
  { id: "habite_se",         label: "Habite-se (quando concluído)", icone: "🏠" },
];
