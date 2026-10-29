// Sprint 13.8 — cria os 7 templates padrão (fases + checklist) definidos com
// o usuário em 2026-08-18 e liga cada um aos serviços da categoria
// correspondente no catálogo. Idempotente: roda de novo sem duplicar
// template (por nome) nem sobrescrever template_padrao_id já preenchido.
import { sb } from "./supabase-admin.mjs";

const WORKSPACE_ID = "88d8716f-083e-44bd-91f3-a391cda59d66";
const COMMIT = process.argv.includes("--commit");

const PALETA_GRUPOS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#06B6D4", "#EC4899", "#6366F1"];
function corDoFase(nome, ordem) {
  const idx = ordem.indexOf(nome);
  return PALETA_GRUPOS[(idx < 0 ? 0 : idx) % PALETA_GRUPOS.length];
}
let contadorId = 0;
function novaFaseId() { return `f${Date.now()}${contadorId++}`; }

function template(nome, fases, grupos, vinculo) {
  return {
    nome,
    fases_execucao: fases.map((f) => ({ id: novaFaseId(), nome: f, cor: corDoFase(f, fases) })),
    tarefas_padrao: grupos.map(([grupo, tarefas]) => ({ grupo, tarefas })),
    ...vinculo,
  };
}

const TEMPLATES = [
  template(
    "Projeto Arquitetônico — Padrão",
    ["Levantamento e Briefing", "Estudo Preliminar", "Anteprojeto", "Projeto Legal", "Projeto Executivo", "Entrega"],
    [
      ["Levantamento e Briefing", ["Levantamento do imóvel/terreno", "Reunião de briefing", "Definição do programa de necessidades"]],
      ["Estudo Preliminar", ["Desenvolvimento do estudo preliminar", "Apresentação de alternativas", "Aprovação do partido arquitetônico"]],
      ["Anteprojeto", ["Desenvolvimento do anteprojeto", "Compatibilização com complementares", "Revisão interna"]],
      ["Projeto Legal", ["Elaboração do projeto legal", "Protocolo na prefeitura", "Acompanhamento da aprovação"]],
      ["Projeto Executivo", ["Detalhamento executivo", "Memorial descritivo", "Especificações de acabamento"]],
      ["Entrega", ["Emissão de ART/RRT", "Entrega de arquivos (PDF/DWG)", "Assinatura de recebimento"]],
    ],
    { categoria: "Projetos Arquitetônicos" }
  ),
  template(
    "Projeto Complementar — Padrão",
    ["Estudo Preliminar", "Anteprojeto", "Aprovação do Cliente", "Projeto Executivo", "Entrega"],
    [
      ["Estudo Preliminar", ["Levantamento de dados e plantas de referência", "Reunião de briefing com cliente", "Análise de viabilidade técnica"]],
      ["Anteprojeto", ["Desenvolvimento do anteprojeto", "Compatibilização com projeto arquitetônico", "Revisão interna"]],
      ["Aprovação do Cliente", ["Apresentação ao cliente", "Ajustes solicitados", "Aprovação final registrada"]],
      ["Projeto Executivo", ["Detalhamento executivo", "Memorial descritivo", "Especificações técnicas", "Compatibilização final entre disciplinas"]],
      ["Entrega", ["Emissão de ART/RRT", "Entrega de arquivos (PDF/DWG)", "Assinatura de recebimento pelo cliente"]],
    ],
    { categoria: "Projetos Complementares" }
  ),
  template(
    "Obra / Reforma — Padrão",
    ["Planejamento", "Mobilização", "Execução", "Medições", "Entrega da Obra"],
    [
      ["Planejamento", ["Cronograma físico-financeiro", "Definição de equipe e fornecedores", "Orçamento detalhado"]],
      ["Mobilização", ["Mobilização de equipe e canteiro", "Contratação de mão de obra/subempreiteiros", "Compra de materiais iniciais"]],
      ["Execução", ["Acompanhamento das etapas construtivas", "Controle de qualidade", "Reuniões periódicas de obra"]],
      ["Medições", ["Medição de serviços executados", "Controle de cronograma e orçamento", "Relatórios periódicos ao cliente"]],
      ["Entrega da Obra", ["Vistoria final", "Lista de retoque/pendências", "Entrega das chaves e documentação"]],
    ],
    { categoria: "Obra / Reforma" }
  ),
  template(
    "Regularização — Padrão",
    ["Levantamento Documental", "Elaboração do Processo", "Protocolo no Órgão", "Acompanhamento", "Emissão / Entrega"],
    [
      ["Levantamento Documental", ["Coleta de documentos do imóvel/cliente", "Levantamento de pendências", "Análise de viabilidade"]],
      ["Elaboração do Processo", ["Elaboração da documentação técnica", "Preenchimento de requerimentos", "Cálculo de taxas e emolumentos"]],
      ["Protocolo no Órgão", ["Protocolo junto ao órgão competente", "Pagamento de taxas", "Confirmação de abertura do processo"]],
      ["Acompanhamento", ["Acompanhamento do andamento", "Atendimento a exigências/diligências"]],
      ["Emissão / Entrega", ["Emissão do documento final", "Entrega ao cliente", "Arquivamento de cópia"]],
    ],
    { categoria: "Regularização", excluirNomes: ["INSS de Obra"] }
  ),
  template(
    "INSS de Obra — Padrão",
    ["Levantamento da Obra", "Cálculo e Aferição", "Protocolo", "Acompanhamento", "Emissão / Baixa"],
    [
      ["Levantamento da Obra", ["Levantamento de área construída", "Coleta de notas fiscais e documentos", "Análise de mão de obra própria/terceirizada"]],
      ["Cálculo e Aferição", ["Cálculo da base de incidência", "Aferição indireta (quando aplicável)", "Conferência de guias já recolhidas"]],
      ["Protocolo", ["Preenchimento da documentação (GFIP etc.)", "Protocolo na Receita Federal", "Pagamento de guias complementares"]],
      ["Acompanhamento", ["Acompanhamento do processo", "Atendimento a exigências/diligências"]],
      ["Emissão / Baixa", ["Emissão da CND de débitos", "Baixa da matrícula CNO", "Entrega ao cliente"]],
    ],
    { servicoNomes: ["INSS de Obra"] }
  ),
  template(
    "Laudos e Vistorias — Padrão",
    ["Solicitação e Agendamento", "Vistoria Técnica", "Análise e Diagnóstico", "Elaboração do Laudo", "Entrega"],
    [
      ["Solicitação e Agendamento", ["Recebimento da solicitação", "Agendamento com o cliente", "Levantamento de documentos prévios"]],
      ["Vistoria Técnica", ["Vistoria in loco", "Registro fotográfico", "Coleta de medições/dados técnicos"]],
      ["Análise e Diagnóstico", ["Análise técnica dos dados", "Identificação de patologias/não conformidades", "Definição de recomendações"]],
      ["Elaboração do Laudo", ["Redação do laudo", "Elaboração de croquis/plantas de apoio", "Revisão técnica interna"]],
      ["Entrega", ["Emissão de ART/RRT", "Entrega do laudo", "Esclarecimentos finais"]],
    ],
    { categoria: "Laudos e Vistorias" }
  ),
  template(
    "Topografia e Levantamentos — Padrão",
    ["Solicitação e Planejamento", "Levantamento em Campo", "Processamento de Dados", "Elaboração de Planta/Memorial", "Entrega"],
    [
      ["Solicitação e Planejamento", ["Recebimento da solicitação e documentos", "Planejamento de equipe/equipamentos", "Agendamento com cliente"]],
      ["Levantamento em Campo", ["Levantamento com estação/GPS", "Coleta de pontos e referências", "Registro fotográfico"]],
      ["Processamento de Dados", ["Processamento dos dados coletados", "Elaboração da planta topográfica", "Cálculo de área e perímetro"]],
      ["Elaboração de Planta/Memorial", ["Memorial descritivo", "Planta final (PDF/DWG)", "Revisão técnica"]],
      ["Entrega", ["Emissão de ART/RRT", "Entrega dos arquivos", "Assinatura de recebimento"]],
    ],
    { categoria: "Topografia e Levantamentos" }
  ),
];

// ── Estado atual ──────────────────────────────────────────────────────────
const { data: templatesExistentes, error: errTpl } = await sb
  .from("templates_servico").select("id, nome").eq("workspace_id", WORKSPACE_ID);
if (errTpl) throw errTpl;
const nomesTplExistentes = new Set(templatesExistentes.map((t) => t.nome));

const { data: categorias, error: errCat } = await sb
  .from("categorias_servico").select("id, nome").eq("workspace_id", WORKSPACE_ID);
if (errCat) throw errCat;
const idPorCategoria = Object.fromEntries(categorias.map((c) => [c.nome, c.id]));

const { data: catalogo, error: errCatalogo } = await sb
  .from("catalogo_servicos").select("id, nome, categoria_id, template_padrao_id").eq("workspace_id", WORKSPACE_ID);
if (errCatalogo) throw errCatalogo;

const planoTemplates = TEMPLATES.filter((t) => !nomesTplExistentes.has(t.nome));
console.log(`Templates já existentes: ${templatesExistentes.length}`, templatesExistentes.map((t) => t.nome));
console.log(`Templates novos a criar: ${planoTemplates.length}`, planoTemplates.map((t) => t.nome));

console.log("\nVínculos que serão aplicados (só em itens sem template_padrao_id ainda):");
for (const t of TEMPLATES) {
  let alvos;
  if (t.servicoNomes) {
    alvos = catalogo.filter((c) => t.servicoNomes.includes(c.nome));
  } else {
    const catId = idPorCategoria[t.categoria];
    alvos = catalogo.filter((c) => c.categoria_id === catId && !(t.excluirNomes ?? []).includes(c.nome));
  }
  const semTemplate = alvos.filter((c) => !c.template_padrao_id);
  console.log(`  "${t.nome}" → ${semTemplate.length}/${alvos.length} serviços (${semTemplate.map((c) => c.nome).join(", ") || "nenhum pendente"})`);
}

if (!COMMIT) {
  console.log("\n[DRY-RUN] Nenhuma alteração foi feita. Rode com --commit para gravar.");
  process.exit(0);
}

const idTemplatePorNome = Object.fromEntries(templatesExistentes.map((t) => [t.nome, t.id]));
for (const t of planoTemplates) {
  const { data, error } = await sb
    .from("templates_servico")
    .insert({
      nome: t.nome,
      fases_execucao: t.fases_execucao,
      tarefas_padrao: t.tarefas_padrao,
      ativo: true,
      workspace_id: WORKSPACE_ID,
    })
    .select("id, nome").single();
  if (error) throw error;
  idTemplatePorNome[t.nome] = data.id;
  console.log("Template criado:", t.nome);
}

for (const t of TEMPLATES) {
  const templateId = idTemplatePorNome[t.nome];
  let alvos;
  if (t.servicoNomes) {
    alvos = catalogo.filter((c) => t.servicoNomes.includes(c.nome));
  } else {
    const catId = idPorCategoria[t.categoria];
    alvos = catalogo.filter((c) => c.categoria_id === catId && !(t.excluirNomes ?? []).includes(c.nome));
  }
  for (const c of alvos.filter((c) => !c.template_padrao_id)) {
    const { error } = await sb.from("catalogo_servicos").update({ template_padrao_id: templateId }).eq("id", c.id);
    if (error) throw error;
    console.log(`Vinculado: ${c.nome} → ${t.nome}`);
  }
}

console.log("\nConcluído.");
