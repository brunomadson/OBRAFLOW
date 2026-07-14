import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getValidAccessToken, uploadDriveFile, downloadDriveFile, deleteDriveFile } from "@/services/integrations/google-drive/google-drive.service";
import { ensureClientFolder, ensureObraPuraFolder, resolveSubpastaChave, getFolderExternalId } from "./folderStructure";
import { gerarNomePadronizado } from "./documentNaming.service";
import type { IntegrationContext } from "@/services/integrations/core/integration-types";

// Orquestra upload híbrido: tenta o provider externo do workspace: se
// não tiver, ou se a tentativa falhar, cai pro Supabase Storage (fluxo já
// existente e testado — SupabaseStorageProvider) e marca a linha em
// document_storage_sync como 'pendente_migracao' — a promoção pro
// externo acontece sozinha na próxima vez que a conexão for confirmada
// saudável (ver promoverPendentes()), não precisa de sincronização
// bidirecional completa pra isso funcionar bem.
//
// Server-only (usa credencial cifrada) — chamado só a partir de
// /api/storage/documentos/route.ts.

interface UploadParams {
  workspaceId: string;
  userId: string;
  leadId: string | null;
  obraId: string | null;
  secao: string;
  tipoDoc: string;
  nomeCliente: string;
  cidade: string | null;
  nomeOriginal: string;
  mimeType: string;
  bytes: Uint8Array;
}

interface UploadResultado {
  storagePath: string; // sempre preenchido — pra manter documentos.storage_path funcionando mesmo quando o arquivo físico não está lá (pendente) ou nunca esteve (Drive), como referência de nome
  syncRow: {
    provider: string;
    external_file_id: string | null;
    external_folder_id: string | null;
    external_url: string | null;
    nome_original: string;
    nome_padronizado: string;
    sync_status: "sincronizado" | "pendente_migracao";
  } | null; // null = ficou 100% no fluxo Supabase padrão, sem linha em document_storage_sync
}

async function uploadParaSupabaseFallback(bytes: Uint8Array, mimeType: string, pathSugerido: string): Promise<string> {
  const supabase = await createSessionClient();
  const { error } = await supabase.storage.from("documentos").upload(pathSugerido, new Blob([bytes as BlobPart], { type: mimeType }), { upsert: false });
  if (error) throw error;
  return pathSugerido;
}

export async function uploadDocumentoHibrido(params: UploadParams): Promise<UploadResultado> {
  const admin = createAdminClient();
  const { data: workspace } = await admin.from("workspaces").select("storage_provider").eq("id", params.workspaceId).single<{ storage_provider: string }>();
  const provider = workspace?.storage_provider ?? "supabase";

  const nomePadronizado = gerarNomePadronizado({ tipoDoc: params.tipoDoc, nomeCliente: params.nomeCliente, cidade: params.cidade, nomeOriginal: params.nomeOriginal });
  const ownerId = params.leadId ?? params.obraId ?? "sem-id";
  const pathFallback = `${ownerId}/${params.secao}/${Date.now()}_${nomePadronizado}`;

  if (provider === "supabase") {
    const storagePath = await uploadParaSupabaseFallback(params.bytes, params.mimeType, pathFallback);
    return { storagePath, syncRow: null };
  }

  if (provider !== "google_drive") {
    // dropbox/onedrive: ainda não têm provider implementado (Sprint 11.1/
    // 11.2 só entregaram Google Drive de verdade) — cai pro Supabase em
    // vez de quebrar o upload do usuário.
    const storagePath = await uploadParaSupabaseFallback(params.bytes, params.mimeType, pathFallback);
    return {
      storagePath,
      syncRow: {
        provider, external_file_id: null, external_folder_id: null, external_url: null,
        nome_original: params.nomeOriginal, nome_padronizado: nomePadronizado, sync_status: "pendente_migracao",
      },
    };
  }

  const ctx: IntegrationContext = { workspaceId: params.workspaceId, userId: params.userId };

  try {
    const { accessToken } = await getValidAccessToken(ctx);

    if (params.leadId) {
      await ensureClientFolder(ctx, accessToken, params.leadId, params.nomeCliente, params.cidade);
    } else if (params.obraId) {
      await ensureObraPuraFolder(ctx, accessToken, params.obraId, params.nomeCliente, params.cidade);
    }

    const chavePasta = resolveSubpastaChave({ leadId: params.leadId, obraId: params.obraId }, params.secao);
    const folderId = await getFolderExternalId(params.workspaceId, chavePasta);
    if (!folderId) throw new Error(`Pasta "${chavePasta}" não foi encontrada/criada — não é possível enviar o arquivo.`);

    const uploaded = await uploadDriveFile(accessToken, { nome: nomePadronizado, mimeType: params.mimeType, bytes: params.bytes, parentId: folderId });

    return {
      storagePath: `drive:${uploaded.id}`, // não é um path de verdade — só um marcador; quem baixa usa document_storage_sync, não este campo
      syncRow: {
        provider: "google_drive", external_file_id: uploaded.id, external_folder_id: folderId, external_url: uploaded.webViewLink,
        nome_original: params.nomeOriginal, nome_padronizado: nomePadronizado, sync_status: "sincronizado",
      },
    };
  } catch (e) {
    console.error("[documentoHibrido] falha ao enviar pro Google Drive, caindo pro Supabase como reserva:", e);
    const storagePath = await uploadParaSupabaseFallback(params.bytes, params.mimeType, pathFallback);
    return {
      storagePath,
      syncRow: {
        provider: "google_drive", external_file_id: null, external_folder_id: null, external_url: null,
        nome_original: params.nomeOriginal, nome_padronizado: nomePadronizado, sync_status: "pendente_migracao",
      },
    };
  }
}

// Baixa o arquivo de verdade, seja de onde for — quem chama (rota de
// download) não precisa saber se é Drive ou Supabase.
export async function baixarDocumentoHibrido(workspaceId: string, userId: string, documentoId: string): Promise<{ bytes: ArrayBuffer; mimeType: string | null; nome: string } | null> {
  const admin = createAdminClient();
  const { data: sync } = await admin
    .from("document_storage_sync")
    .select("provider, external_file_id, sync_status, nome_original")
    .eq("documento_id", documentoId)
    .maybeSingle<{ provider: string; external_file_id: string | null; sync_status: string; nome_original: string }>();

  if (!sync || sync.sync_status !== "sincronizado" || !sync.external_file_id) return null; // caller deve tentar Supabase Storage direto

  if (sync.provider === "google_drive") {
    const ctx: IntegrationContext = { workspaceId, userId };
    const { accessToken } = await getValidAccessToken(ctx);
    const bytes = await downloadDriveFile(accessToken, sync.external_file_id);
    return { bytes, mimeType: null, nome: sync.nome_original };
  }
  return null;
}

// Retorna se o caller ainda precisa apagar bytes físicos do Supabase
// Storage: true quando o documento nunca chegou a sair de lá (nunca
// teve linha de sync, OU estava 'pendente_migracao' — casos em que o
// arquivo real está no bucket do Supabase, mesmo que a intenção fosse
// outro provider). false só quando já estava sincronizado no externo (o
// Supabase nunca teve cópia física desse arquivo).
export async function excluirDocumentoHibrido(workspaceId: string, userId: string, documentoId: string): Promise<{ removerDoSupabase: boolean }> {
  const admin = createAdminClient();
  const { data: sync } = await admin
    .from("document_storage_sync")
    .select("provider, external_file_id, sync_status")
    .eq("documento_id", documentoId)
    .maybeSingle<{ provider: string; external_file_id: string | null; sync_status: string }>();

  if (!sync) return { removerDoSupabase: true }; // documento nunca teve linha de sync — sempre foi Supabase puro

  if (sync.sync_status === "sincronizado" && sync.external_file_id) {
    if (sync.provider === "google_drive") {
      const ctx: IntegrationContext = { workspaceId, userId };
      const { accessToken } = await getValidAccessToken(ctx);
      await deleteDriveFile(accessToken, sync.external_file_id);
    }
    await admin.from("document_storage_sync").delete().eq("documento_id", documentoId);
    return { removerDoSupabase: false };
  }

  // 'pendente_migracao' (ou 'erro'): nunca chegou a sair do Supabase de
  // verdade — remove a linha de sync (senão promoverPendentes tentaria
  // "ressuscitar" um documento já excluído) e deixa o caller apagar o
  // arquivo físico normalmente.
  await admin.from("document_storage_sync").delete().eq("documento_id", documentoId);
  return { removerDoSupabase: true };
}

// Chamado toda vez que a conexão de um workspace é confirmada saudável
// (rota /test, ou logo depois de um upload que deu certo) — promove
// documentos que ficaram temporariamente no Supabase por causa de uma
// falha anterior.
export async function promoverPendentes(ctx: IntegrationContext, maxPorVez = 5): Promise<number> {
  const admin = createAdminClient();
  const { data: pendentes } = await admin
    .from("document_storage_sync")
    .select("id, documento_id, nome_padronizado")
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", "google_drive")
    .eq("sync_status", "pendente_migracao")
    .limit(maxPorVez)
    .returns<Array<{ id: string; documento_id: string; nome_padronizado: string }>>();

  if (!pendentes || pendentes.length === 0) return 0;

  const { accessToken } = await getValidAccessToken(ctx);
  let promovidos = 0;

  for (const p of pendentes) {
    const { data: doc } = await admin
      .from("documentos")
      .select("lead_id, obra_id, secao, storage_path, mime_type, ativo")
      .eq("id", p.documento_id)
      .maybeSingle<{ lead_id: string | null; obra_id: string | null; secao: string; storage_path: string; mime_type: string | null; ativo: boolean }>();
    // documento não existe mais, ou foi excluído (soft-delete) — não
    // promove um arquivo que o usuário já apagou.
    if (!doc || doc.ativo === false) {
      await admin.from("document_storage_sync").delete().eq("id", p.id);
      continue;
    }

    const chavePasta = resolveSubpastaChave({ leadId: doc.lead_id, obraId: doc.obra_id }, doc.secao);
    const folderId = await getFolderExternalId(ctx.workspaceId, chavePasta);
    if (!folderId) continue; // pasta ainda não existe (raro) — tenta de novo na próxima promoção

    const supabase = await createSessionClient();
    const { data: bytesBlob, error: downloadErr } = await supabase.storage.from("documentos").download(doc.storage_path);
    if (downloadErr || !bytesBlob) continue;
    const bytes = new Uint8Array(await bytesBlob.arrayBuffer());

    const uploaded = await uploadDriveFile(accessToken, { nome: p.nome_padronizado, mimeType: doc.mime_type ?? "application/octet-stream", bytes, parentId: folderId });

    await admin.from("document_storage_sync").update({
      external_file_id: uploaded.id, external_folder_id: folderId, external_url: uploaded.webViewLink,
      sync_status: "sincronizado", ultima_sincronizacao: new Date().toISOString(),
    } as never).eq("id", p.id);

    await supabase.storage.from("documentos").remove([doc.storage_path]);
    promovidos++;
  }

  return promovidos;
}
