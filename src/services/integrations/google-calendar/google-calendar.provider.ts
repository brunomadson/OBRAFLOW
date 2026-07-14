import type { IntegrationProvider, IntegrationContext, IntegrationConnectResult, IntegrationStatus } from "../core/integration-types";
import { getWorkspaceIntegracao, clearConnection, markError, logEvent } from "../core/integration-provider";
import { buildAuthUrl, signState } from "../core/google-oauth";
import { getGoogleCalendarScopes, getValidAccessToken, pingCalendar } from "./google-calendar.service";

const SLUG = "google_agenda";

export const googleCalendarProvider: IntegrationProvider = {
  slug: SLUG,

  async connect(ctx: IntegrationContext): Promise<IntegrationConnectResult> {
    const state = signState({ workspaceId: ctx.workspaceId, userId: ctx.userId, slug: SLUG });
    const redirectUrl = buildAuthUrl(getGoogleCalendarScopes(), state);
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
      const ok = await pingCalendar(accessToken);
      if (!ok) await markError(ctx, SLUG, "Ping à API do Google Calendar falhou (token rejeitado).");
      return ok;
    } catch (e) {
      await markError(ctx, SLUG, e instanceof Error ? e.message : String(e));
      return false;
    }
  },

  // Sincronizar reunião ↔ evento — depende da modelagem de "reunião" que
  // ainda não existe (ver google-calendar.service.ts). Loga a tentativa
  // pra manter rastreabilidade, mas não finge sincronizar de verdade.
  async sync(ctx: IntegrationContext): Promise<void> {
    await logEvent(ctx, SLUG, "sync_falhou", "Sincronização de reuniões ainda não implementada (fora do escopo desta sprint).");
    throw new Error("Sincronização de reuniões do Google Calendar ainda não implementada.");
  },
};
