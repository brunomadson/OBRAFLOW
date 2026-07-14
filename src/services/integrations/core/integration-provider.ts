import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials, decryptCredentials } from "@/lib/crypto/credentials";
import type { IntegrationContext, IntegrationStatus } from "./integration-types";

// Camada compartilhada de persistência que toda implementação concreta de
// IntegrationProvider usa (google-drive.provider.ts, google-calendar.provider.ts,
// e futuramente whatsapp/ai/payment) — evita reescrever "achar a linha em
// workspace_integracoes", "gravar credencial cifrada", "logar evento" em
// cada provider. Sempre via service_role (admin client): esta camada é
// literalmente onde a credencial cifrada é lida/escrita, nunca deve rodar
// com o client anon/autenticado do navegador.

interface WorkspaceIntegracaoRow {
  id: string;
  status: IntegrationStatus;
  credentials_encrypted: string | null;
  settings: Record<string, unknown>;
}

async function getIntegracaoId(admin: ReturnType<typeof createAdminClient>, codigo: string): Promise<string> {
  const { data, error } = await admin.from("integracoes").select("id").eq("codigo", codigo).single<{ id: string }>();
  if (error || !data) throw new Error(`Integração "${codigo}" não existe no catálogo.`);
  return data.id;
}

export async function getWorkspaceIntegracao(
  ctx: IntegrationContext,
  slug: string
): Promise<WorkspaceIntegracaoRow | null> {
  const admin = createAdminClient();
  const integracaoId = await getIntegracaoId(admin, slug);
  const { data } = await admin
    .from("workspace_integracoes")
    .select("id, status, credentials_encrypted, settings")
    .eq("workspace_id", ctx.workspaceId)
    .eq("integracao_id", integracaoId)
    .maybeSingle<WorkspaceIntegracaoRow>();
  return data ?? null;
}

export async function getDecryptedCredentials<T = Record<string, unknown>>(
  ctx: IntegrationContext,
  slug: string
): Promise<T | null> {
  const row = await getWorkspaceIntegracao(ctx, slug);
  if (!row?.credentials_encrypted) return null;
  return JSON.parse(decryptCredentials(row.credentials_encrypted)) as T;
}

export async function saveConnection(
  ctx: IntegrationContext,
  slug: string,
  credentials: Record<string, unknown>,
  settings: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClient();
  const integracaoId = await getIntegracaoId(admin, slug);
  const { error } = await admin.from("workspace_integracoes").upsert(
    {
      workspace_id: ctx.workspaceId,
      integracao_id: integracaoId,
      status: "conectado",
      conectado_em: new Date().toISOString(),
      connected_by: ctx.userId,
      credentials_encrypted: encryptCredentials(JSON.stringify(credentials)),
      settings,
    } as never,
    { onConflict: "workspace_id,integracao_id" }
  );
  if (error) throw error;
  await logEvent(ctx, slug, "conectado");
}

export async function clearConnection(ctx: IntegrationContext, slug: string): Promise<void> {
  const admin = createAdminClient();
  const integracaoId = await getIntegracaoId(admin, slug);
  const { error } = await admin.from("workspace_integracoes").upsert(
    {
      workspace_id: ctx.workspaceId,
      integracao_id: integracaoId,
      status: "nao_conectado",
      conectado_em: null,
      credentials_encrypted: null,
      settings: {},
    } as never,
    { onConflict: "workspace_id,integracao_id" }
  );
  if (error) throw error;
  await logEvent(ctx, slug, "desconectado");
}

export async function markError(ctx: IntegrationContext, slug: string, detalhe: string): Promise<void> {
  const admin = createAdminClient();
  const integracaoId = await getIntegracaoId(admin, slug);
  await admin
    .from("workspace_integracoes")
    .update({ status: "erro" } as never)
    .eq("workspace_id", ctx.workspaceId)
    .eq("integracao_id", integracaoId);
  await logEvent(ctx, slug, "erro", detalhe);
}

export async function touchLastSync(ctx: IntegrationContext, slug: string): Promise<void> {
  const admin = createAdminClient();
  const integracaoId = await getIntegracaoId(admin, slug);
  await admin
    .from("workspace_integracoes")
    .update({ last_sync: new Date().toISOString() } as never)
    .eq("workspace_id", ctx.workspaceId)
    .eq("integracao_id", integracaoId);
}

export async function logEvent(
  ctx: IntegrationContext,
  slug: string,
  evento: "conectado" | "desconectado" | "erro" | "sync_iniciado" | "sync_concluido" | "sync_falhou",
  detalhe?: string
): Promise<void> {
  const admin = createAdminClient();
  const row = await getWorkspaceIntegracao(ctx, slug);
  if (!row) return; // nada pra logar se a conexão nem existe ainda
  await admin.from("workspace_integration_logs").insert({
    workspace_id: ctx.workspaceId,
    workspace_integracao_id: row.id,
    evento,
    detalhe: detalhe ?? null,
  } as never);
}
