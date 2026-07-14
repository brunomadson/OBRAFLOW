import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken, createDriveFolder, moveDriveItem } from "@/services/integrations/google-drive/google-drive.service";
import type { IntegrationContext } from "@/services/integrations/core/integration-types";

// Estrutura oficial de pastas do ObraFlow (Sprint 11.2/11.3). "chave" é um
// identificador estável que ESTE arquivo controla — não é um enum no
// banco, então adicionar uma subpasta nova não precisa de migration.
// find-or-create idempotente: chamar 2x a mesma chave nunca cria pasta
// duplicada (proteção contra o mesmo tipo de bug que já pegamos no
// webhook de pagamento da Sprint 9 — duas chamadas quase simultâneas não
// devem duplicar nada).

const NOMES = {
  root: "OBRAFLOW",
  comercial_root: "1.0_COMERCIAL",
  comercial_ativos: "1.1_LEADS_ATIVOS",
  comercial_aprovados: "1.2_LEADS_APROVADOS",
  comercial_reprovados: "1.3_LEADS_REPROVADOS",
  obras_root: "2.0_OBRAS",
  obras_processos: "2.1_PROCESSOS",
  obras_andamento: "2.2_OBRAS_EM_ANDAMENTO",
  obras_entregues: "2.3_CASAS_ENTREGUES",
  financeiro_root: "3.0_FINANCEIRO",
} as const;

// secao (AbaDocumentos.tsx) → nome de subpasta dentro da pasta do cliente.
const SUBPASTA_POR_SECAO: Record<string, string> = {
  pessoal: "01_DOCS_PESSOAIS",
  projetos: "02_PROJETOS",
  engenharia: "03_ENGENHARIA_E_CONFORMIDADE",
  contrato: "04_CONTRATO",
};
const MEDICOES_SUBPASTA = "05_MEDIÇÕES";
// PLS 01..05 — pastas fixas espelhando exatamente o que já existe na tela
// de Documentos (AbaDocumentos.tsx, PLS_NUMS) — não é 1 pasta por linha
// de `medicoes` (a tabela financeira de medição não tem relação 1:1 com
// isso; achado confirmado lendo o componente antes de automatizar).
const PLS_NUMS = ["01", "02", "03", "04", "05"];

interface FolderRow {
  id: string;
  external_folder_id: string;
}

async function getFolder(admin: ReturnType<typeof createAdminClient>, workspaceId: string, provider: string, chave: string): Promise<FolderRow | null> {
  const { data } = await admin
    .from("entity_storage_folders")
    .select("id, external_folder_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("chave", chave)
    .maybeSingle<FolderRow>();
  return data ?? null;
}

// find-or-create de 1 pasta. Se já existe linha em entity_storage_folders
// pra essa chave, reaproveita (idempotente) — só cria de verdade no Drive
// na primeira vez.
async function ensureFolder(
  ctx: IntegrationContext,
  accessToken: string,
  chave: string,
  nome: string,
  entidadeTipo: string | null,
  entidadeId: string | null,
  parentChave: string | null
): Promise<FolderRow> {
  const admin = createAdminClient();
  const existente = await getFolder(admin, ctx.workspaceId, "google_drive", chave);
  if (existente) return existente;

  const parent = parentChave ? await getFolder(admin, ctx.workspaceId, "google_drive", parentChave) : null;
  const externalFolderId = await createDriveFolder(accessToken, nome, parent?.external_folder_id ?? null);

  const { data, error } = await admin
    .from("entity_storage_folders")
    .insert({
      workspace_id: ctx.workspaceId,
      provider: "google_drive",
      chave,
      external_folder_id: externalFolderId,
      nome_pasta: nome,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
    } as never)
    .select("id, external_folder_id")
    .single<FolderRow>();

  // Corrida rara: 2 chamadas simultâneas passaram pelo "existente" antes
  // de qualquer uma inserir. UNIQUE(workspace_id, provider, chave) rejeita
  // a segunda — nesse caso, ignora o erro e busca a que já foi criada.
  if (error) {
    const jaExiste = await getFolder(admin, ctx.workspaceId, "google_drive", chave);
    if (jaExiste) return jaExiste;
    throw error;
  }
  return data;
}

export async function ensureRootStructure(ctx: IntegrationContext, accessToken: string): Promise<void> {
  await ensureFolder(ctx, accessToken, "root", NOMES.root, null, null, null);
  await ensureFolder(ctx, accessToken, "comercial_root", NOMES.comercial_root, null, null, "root");
  await ensureFolder(ctx, accessToken, "comercial_ativos", NOMES.comercial_ativos, null, null, "comercial_root");
  await ensureFolder(ctx, accessToken, "comercial_aprovados", NOMES.comercial_aprovados, null, null, "comercial_root");
  await ensureFolder(ctx, accessToken, "comercial_reprovados", NOMES.comercial_reprovados, null, null, "comercial_root");
  await ensureFolder(ctx, accessToken, "obras_root", NOMES.obras_root, null, null, "root");
  await ensureFolder(ctx, accessToken, "obras_processos", NOMES.obras_processos, null, null, "obras_root");
  await ensureFolder(ctx, accessToken, "obras_andamento", NOMES.obras_andamento, null, null, "obras_root");
  await ensureFolder(ctx, accessToken, "obras_entregues", NOMES.obras_entregues, null, null, "obras_root");
  await ensureFolder(ctx, accessToken, "financeiro_root", NOMES.financeiro_root, null, null, "root");
}

function slugCliente(nome: string, cidade: string | null): string {
  const base = cidade ? `${nome} - ${cidade}` : nome;
  return base.replace(/[\\/:*?"<>|]/g, "-").trim();
}

// Chamado quando o lead chega em "documentacao". Garante toda a estrutura
// (raiz + categoria "ativos" + pasta do cliente + 5 subpastas fixas,
// incluindo PLS 01-05 dentro de medições, criadas de uma vez — evita 5
// gatilhos separados conforme a obra avança de etapa).
export async function ensureClientFolder(
  ctx: IntegrationContext,
  accessToken: string,
  leadId: string,
  nomeCliente: string,
  cidade: string | null
): Promise<void> {
  await ensureRootStructure(ctx, accessToken);
  const chaveCliente = `lead:${leadId}`;
  await ensureFolder(ctx, accessToken, chaveCliente, slugCliente(nomeCliente, cidade), "lead", leadId, "comercial_ativos");

  for (const [secao, nomePasta] of Object.entries(SUBPASTA_POR_SECAO)) {
    await ensureFolder(ctx, accessToken, `${chaveCliente}:${secao}`, nomePasta, "lead", leadId, chaveCliente);
  }
  const chaveMedicoes = `${chaveCliente}:medicoes`;
  await ensureFolder(ctx, accessToken, chaveMedicoes, MEDICOES_SUBPASTA, "lead", leadId, chaveCliente);
  for (const pls of PLS_NUMS) {
    await ensureFolder(ctx, accessToken, `${chaveMedicoes}:pls_${pls}`, `PLS ${pls}`, "lead", leadId, chaveMedicoes);
  }
}

// Move a pasta do cliente entre categorias SEM recriar nada — mesma linha
// (mesmo external_folder_id) muda só de pai no Drive. Idempotente: se já
// está no destino, moveDriveItem falharia tentando remover um parent que
// não existe mais — por isso confere o pai atual antes de mover.
async function moverPastaEntreCategorias(
  ctx: IntegrationContext,
  accessToken: string,
  chaveCliente: string,
  deCategoria: keyof typeof NOMES,
  paraCategoria: keyof typeof NOMES
): Promise<void> {
  const admin = createAdminClient();
  const pasta = await getFolder(admin, ctx.workspaceId, "google_drive", chaveCliente);
  if (!pasta) throw new Error(`Pasta do cliente (${chaveCliente}) não existe ainda — não é possível mover.`);

  const destino = await getFolder(admin, ctx.workspaceId, "google_drive", paraCategoria);
  if (!destino) throw new Error(`Categoria de destino "${paraCategoria}" não existe.`);

  const origem = await getFolder(admin, ctx.workspaceId, "google_drive", deCategoria);
  await moveDriveItem(accessToken, pasta.external_folder_id, destino.external_folder_id, origem?.external_folder_id ?? destino.external_folder_id);
}

export async function moverLeadAprovado(ctx: IntegrationContext, accessToken: string, leadId: string): Promise<void> {
  await moverPastaEntreCategorias(ctx, accessToken, `lead:${leadId}`, "comercial_ativos", "comercial_aprovados");
}

export async function moverLeadReprovado(ctx: IntegrationContext, accessToken: string, leadId: string): Promise<void> {
  await moverPastaEntreCategorias(ctx, accessToken, `lead:${leadId}`, "comercial_ativos", "comercial_reprovados");
}

// Lead → Obra: move a MESMA pasta (chave continua "lead:<id>" pra sempre —
// mesma filosofia de documentos.lead_id nunca virar obra_id, migration
// 038 da Sprint 7.2) do Comercial pra Obras/Processos.
export async function moverLeadParaObras(ctx: IntegrationContext, accessToken: string, leadId: string): Promise<void> {
  const admin = createAdminClient();
  const pasta = await getFolder(admin, ctx.workspaceId, "google_drive", `lead:${leadId}`);
  if (!pasta) return; // sem pasta no Drive (workspace nunca usou Drive, ou lead não passou por documentacao) — nada a mover

  const destino = await getFolder(admin, ctx.workspaceId, "google_drive", "obras_processos");
  if (!destino) throw new Error('Categoria "obras_processos" não existe.');

  // Pode estar em ativos, aprovados, ou (raro) já ter sido movida — tenta
  // achar o pai atual real perguntando pro Drive não é necessário aqui:
  // como só existe 1 pai por vez na nossa modelagem, tentamos remover de
  // qualquer uma das 3 categorias comerciais possíveis.
  for (const categoria of ["comercial_ativos", "comercial_aprovados", "comercial_reprovados"] as const) {
    const origem = await getFolder(admin, ctx.workspaceId, "google_drive", categoria);
    if (!origem) continue;
    try {
      await moveDriveItem(accessToken, pasta.external_folder_id, destino.external_folder_id, origem.external_folder_id);
      return;
    } catch {
      // não era esse o pai atual — tenta a próxima categoria
      continue;
    }
  }
}

// Obra pura (sem lead_id — criada direto em Obras, ver continuidade da
// migration 038): mesma estrutura de 5 subpastas, chave própria
// "obra:<id>", direto dentro de 2.1_PROCESSOS (nunca passa por Comercial).
export async function ensureObraPuraFolder(
  ctx: IntegrationContext,
  accessToken: string,
  obraId: string,
  nomeCliente: string,
  cidade: string | null
): Promise<void> {
  await ensureRootStructure(ctx, accessToken);
  const chaveObra = `obra:${obraId}`;
  await ensureFolder(ctx, accessToken, chaveObra, slugCliente(nomeCliente, cidade), "obra", obraId, "obras_processos");

  for (const [secao, nomePasta] of Object.entries(SUBPASTA_POR_SECAO)) {
    await ensureFolder(ctx, accessToken, `${chaveObra}:${secao}`, nomePasta, "obra", obraId, chaveObra);
  }
  const chaveMedicoes = `${chaveObra}:medicoes`;
  await ensureFolder(ctx, accessToken, chaveMedicoes, MEDICOES_SUBPASTA, "obra", obraId, chaveObra);
  for (const pls of PLS_NUMS) {
    await ensureFolder(ctx, accessToken, `${chaveMedicoes}:pls_${pls}`, `PLS ${pls}`, "obra", obraId, chaveMedicoes);
  }
}

// Mapeia a etapa da obra pra qual das 3 categorias de 2.0_OBRAS ela cai.
// A maior parte das etapas (projeto até contrato) fica em "processos" —
// só execucao/entregue têm categoria própria, então mudar de etapa DENTRO
// de "processos" (ex. licencas → eng_caixa) não precisa mover pasta
// nenhuma, só cruzar a fronteira execucao/entregue precisa.
export function categoriaObraPorEtapa(etapa: string): "obras_processos" | "obras_andamento" | "obras_entregues" {
  if (etapa === "execucao") return "obras_andamento";
  if (etapa === "entregue") return "obras_entregues";
  return "obras_processos";
}

// Chamado no avancarEtapa de useObras.ts. leadId presente → move a pasta
// "lead:<id>" (mesma pasta desde o Comercial); só obraId → pasta
// "obra:<id>" (obra pura, criada direto em Obras). Não-op silencioso se
// as duas etapas caem na mesma categoria, ou se a pasta ainda nem existe
// (obra pura sem nenhum documento enviado ainda — ensureObraPuraFolder só
// roda no primeiro upload, não neste gatilho).
export async function moverObraEtapa(
  ctx: IntegrationContext,
  accessToken: string,
  params: { leadId?: string | null; obraId: string },
  etapaAnterior: string,
  novaEtapa: string
): Promise<void> {
  const categoriaAnterior = categoriaObraPorEtapa(etapaAnterior);
  const categoriaNova = categoriaObraPorEtapa(novaEtapa);
  if (categoriaAnterior === categoriaNova) return;

  const chave = params.leadId ? `lead:${params.leadId}` : `obra:${params.obraId}`;
  const admin = createAdminClient();
  const pasta = await getFolder(admin, ctx.workspaceId, "google_drive", chave);
  if (!pasta) return;

  const destino = await getFolder(admin, ctx.workspaceId, "google_drive", categoriaNova);
  if (!destino) throw new Error(`Categoria de destino "${categoriaNova}" não existe.`);

  const origem = await getFolder(admin, ctx.workspaceId, "google_drive", categoriaAnterior);
  await moveDriveItem(accessToken, pasta.external_folder_id, destino.external_folder_id, origem?.external_folder_id ?? destino.external_folder_id);
}

export function resolveSubpastaChave(params: { leadId?: string | null; obraId?: string | null }, secao: string): string {
  const base = params.leadId ? `lead:${params.leadId}` : `obra:${params.obraId}`;
  if (secao.startsWith("medicoes_pls_")) {
    const pls = secao.replace("medicoes_pls_", "");
    return `${base}:medicoes:pls_${pls}`;
  }
  return `${base}:${secao}`;
}

export async function getFolderExternalId(workspaceId: string, chave: string): Promise<string | null> {
  const admin = createAdminClient();
  const row = await getFolder(admin, workspaceId, "google_drive", chave);
  return row?.external_folder_id ?? null;
}
