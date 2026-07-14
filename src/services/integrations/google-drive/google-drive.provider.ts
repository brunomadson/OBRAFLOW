import type { IntegrationProvider, IntegrationContext, IntegrationConnectResult, IntegrationStatus } from "../core/integration-types";
import { getWorkspaceIntegracao, saveConnection, clearConnection, markError, logEvent, touchLastSync } from "../core/integration-provider";
import { buildAuthUrl, signState } from "../core/google-oauth";
import { getGoogleDriveScopes, getValidAccessToken, pingDrive } from "./google-drive.service";
import { promoverPendentes } from "@/services/storage/documentoHibrido.service";

const SLUG = "google_drive";

export const googleDriveProvider: IntegrationProvider = {
  slug: SLUG,

  // connect() aqui não "conecta" de fato — gera a URL de autorização do
  // Google e devolve pra rota chamadora redirecionar o navegador. A
  // conexão de verdade só é salva quando o Google chama de volta
  // /api/integrations/google-drive/callback com o "code".
  async connect(ctx: IntegrationContext): Promise<IntegrationConnectResult> {
    const state = signState({ workspaceId: ctx.workspaceId, userId: ctx.userId, slug: SLUG });
    const redirectUrl = buildAuthUrl(getGoogleDriveScopes(), state);
    return { status: "nao_conectado", redirectUrl };
  },

  async disconnect(ctx: IntegrationContext): Promise<void> {
    await clearConnection(ctx, SLUG);
  },

  async getStatus(ctx: IntegrationContext): Promise<IntegrationStatus> {
    const row = await getWorkspaceIntegracao(ctx, SLUG);
    return row?.status ?? "nao_conectado";
  },

  async validateConnection(ctx: IntegrationContext): Promise<boolean> {
    try {
      const { accessToken } = await getValidAccessToken(ctx);
      const ok = await pingDrive(accessToken);
      if (!ok) await markError(ctx, SLUG, "Ping à API do Google Drive falhou (token rejeitado).");
      return ok;
    } catch (e) {
      await markError(ctx, SLUG, e instanceof Error ? e.message : String(e));
      return false;
    }
  },

  // "sync" aqui é a fila de pendência de migração (Sprint 11.2), não a
  // sincronização bidirecional completa (Drive→ObraFlow detectar arquivo
  // novo/removido) — essa continua fora do escopo, planejada como sprint
  // futura.
  async sync(ctx: IntegrationContext): Promise<void> {
    await logEvent(ctx, SLUG, "sync_iniciado");
    try {
      await promoverPendentes(ctx);
      await touchLastSync(ctx, SLUG);
      await logEvent(ctx, SLUG, "sync_concluido");
    } catch (e) {
      await logEvent(ctx, SLUG, "sync_falhou", e instanceof Error ? e.message : String(e));
      throw e;
    }
  },
};
