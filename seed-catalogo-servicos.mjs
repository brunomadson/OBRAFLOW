// Sprint 13.8 — seed da lista curada de categorias + catálogo de serviços
// (definida pelo usuário em 2026-08-18, substitui a lista de ~150-180 itens
// do brief original). Idempotente: roda de novo sem duplicar.
import { sb } from "./supabase-admin.mjs";

const WORKSPACE_ID = "88d8716f-083e-44bd-91f3-a391cda59d66";
const COMMIT = process.argv.includes("--commit");

const CATEGORIAS = {
  "Projetos Arquitetônicos": [
    "Projeto Residencial", "Projeto de Ampliação", "Projeto de Reforma", "Projeto Comercial",
    "Projeto Multifamiliar", "Projeto de Fachada", "Projeto de Interiores", "Projeto de Paisagismo",
  ],
  "Projetos Complementares": [
    "Projeto Estrutural", "Projeto Elétrico", "Projeto Hidrossanitário", "Projeto de Água Fria",
    "Projeto de Água Quente", "Projeto Sanitário", "Projeto de Águas Pluviais", "Projeto de Drenagem",
    "Projeto de SPDA", "Projeto de Prevenção e Combate a Incêndio", "Projeto de Gás",
    "Projeto de Climatização", "Projeto de Telecomunicações", "Projeto de CFTV", "Projeto de Lógica",
    "Projeto de Automação", "Projeto Acústico",
  ],
  "Obra / Reforma": [
    "Acompanhamento de Obra", "Administração de Obra", "Empreita Global", "Empreita da Mão de Obra",
  ],
  "Regularização": [
    "Regularização de Imóvel", "Regularização de Obra", "INSS de Obra", "Cadastro CNO", "CND de Obra",
  ],
  "Laudos e Vistorias": [
    "Laudo Técnico", "Laudo de Patologia", "Laudo de Infiltração", "Laudo Estrutural",
    "Laudo de Inspeção Predial", "Vistoria Cautelar", "Vistoria de Entrega de Imóvel",
  ],
  "Topografia e Levantamentos": [
    "Levantamento Topográfico", "Levantamento Planialtimétrico", "Levantamento Planimétrico",
    "Georreferenciamento", "Cadastro de Terreno",
  ],
};

function normalizar(nome) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// ── Categorias ────────────────────────────────────────────────────────────
const { data: categoriasExistentes, error: errCat } = await sb
  .from("categorias_servico").select("id, nome").eq("workspace_id", WORKSPACE_ID);
if (errCat) throw errCat;

const nomesCatExistentes = new Set(categoriasExistentes.map((c) => normalizar(c.nome)));
const categoriasNovas = Object.keys(CATEGORIAS).filter((nome) => !nomesCatExistentes.has(normalizar(nome)));

console.log(`Categorias já existentes: ${categoriasExistentes.length}`, categoriasExistentes.map((c) => c.nome));
console.log(`Categorias novas a criar: ${categoriasNovas.length}`, categoriasNovas);

// ── Catálogo ──────────────────────────────────────────────────────────────
const { data: catalogoExistente, error: errCatalogo } = await sb
  .from("catalogo_servicos").select("id, nome, ativo").eq("workspace_id", WORKSPACE_ID);
if (errCatalogo) throw errCatalogo;

// Itens inativados (ex: retirados manualmente antes do seed) não bloqueiam
// a versão nova/curada de criar um item com o mesmo nome — só os ativos
// contam como "já existe".
const catalogoAtivo = catalogoExistente.filter((s) => s.ativo);
const nomesCatalogoExistentes = new Set(catalogoAtivo.map((s) => normalizar(s.nome)));
const planoServicos = [];
for (const [categoria, itens] of Object.entries(CATEGORIAS)) {
  for (const nome of itens) {
    if (nomesCatalogoExistentes.has(normalizar(nome))) continue;
    planoServicos.push({ categoria, nome });
  }
}

console.log(`\nServiços ativos já existentes (ignorados): ${catalogoAtivo.length}`, catalogoAtivo.map((s) => s.nome));
const catalogoInativo = catalogoExistente.filter((s) => !s.ativo);
if (catalogoInativo.length) console.log(`Serviços inativos (não contam como duplicata, novo item pode ser criado igual): ${catalogoInativo.length}`, catalogoInativo.map((s) => s.nome));
console.log(`Serviços novos a criar: ${planoServicos.length}`);
for (const [categoria, itens] of Object.entries(CATEGORIAS)) {
  const novos = planoServicos.filter((p) => p.categoria === categoria);
  if (novos.length) console.log(`  ${categoria}: ${novos.length}/${itens.length} novos`);
}

if (!COMMIT) {
  console.log("\n[DRY-RUN] Nenhuma alteração foi feita. Rode com --commit para gravar.");
  process.exit(0);
}

const idPorCategoria = {};
for (const c of categoriasExistentes) idPorCategoria[normalizar(c.nome)] = c.id;

let ordem = categoriasExistentes.length;
for (const nome of categoriasNovas) {
  const { data, error } = await sb
    .from("categorias_servico")
    .insert({ nome, ordem: ordem++, ativo: true, workspace_id: WORKSPACE_ID })
    .select("id, nome").single();
  if (error) throw error;
  idPorCategoria[normalizar(nome)] = data.id;
  console.log("Categoria criada:", nome);
}

for (const { categoria, nome } of planoServicos) {
  const categoria_id = idPorCategoria[normalizar(categoria)];
  const { error } = await sb
    .from("catalogo_servicos")
    .insert({ nome, categoria_id, ativo: true, workspace_id: WORKSPACE_ID });
  if (error) throw error;
  console.log("Serviço criado:", nome, `(${categoria})`);
}

console.log("\nConcluído.");
