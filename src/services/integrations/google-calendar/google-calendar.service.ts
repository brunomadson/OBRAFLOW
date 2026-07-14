import { getDecryptedCredentials } from "../core/integration-provider";
import { refreshAccessToken, type GoogleTokens } from "../core/google-oauth";
import type { IntegrationContext } from "../core/integration-types";

// Espelha google-drive.service.ts (mesmo vendor, mesma mecânica de token) —
// só o scope muda. Ver Etapa 7 do ticket: preparar a estrutura de
// criar/editar/cancelar evento e sincronizar reunião, sem implementar o
// fluxo completo ainda.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export function getGoogleCalendarScopes(): string[] {
  return SCOPES;
}

interface StoredCredentials extends GoogleTokens {
  obtained_at: number;
}

export async function getValidAccessToken(ctx: IntegrationContext): Promise<{ accessToken: string; refreshed: GoogleTokens | null }> {
  const creds = await getDecryptedCredentials<StoredCredentials>(ctx, "google_agenda");
  if (!creds) throw new Error("Google Calendar não está conectado neste workspace.");

  const expirado = Date.now() > creds.obtained_at + creds.expires_in * 1000 - 60_000;
  if (!expirado) return { accessToken: creds.access_token, refreshed: null };

  if (!creds.refresh_token) throw new Error("Token do Google Calendar expirou e não há refresh_token salvo — é preciso reconectar.");
  const novo = await refreshAccessToken(creds.refresh_token);
  return { accessToken: novo.access_token, refreshed: novo };
}

export async function pingCalendar(accessToken: string): Promise<boolean> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

// Relacionamento Lead → Reunião → Evento Google Calendar (ticket, Etapa 7).
// A tabela de "reunião" e o vínculo com lead ainda não existem no schema —
// criar isso é decisão de produto (onde mora a reunião? aba do lead?
// campo novo?) fora do escopo desta sprint, que é só a fundação da
// integração. Os 3 métodos abaixo ficam como contrato preparado, cada um
// lançando erro explícito até essa modelagem existir.
export async function criarEventoReuniao(_ctx: IntegrationContext, _leadId: string): Promise<void> {
  throw new Error("Criação de evento a partir de reunião ainda não implementada — depende da modelagem de 'reunião' (fora do escopo desta sprint).");
}

export async function editarEventoReuniao(_ctx: IntegrationContext, _eventoId: string): Promise<void> {
  throw new Error("Edição de evento ainda não implementada.");
}

export async function cancelarEventoReuniao(_ctx: IntegrationContext, _eventoId: string): Promise<void> {
  throw new Error("Cancelamento de evento ainda não implementado.");
}
