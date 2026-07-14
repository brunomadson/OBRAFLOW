// Tipos compartilhados por toda integração (Google Drive, Google Calendar,
// e futuramente WhatsApp/IA/Pagamentos). Server-only por natureza — quem
// implementa IntegrationProvider lida com credencial, então nunca deve ser
// importado por um componente "use client".

export type IntegrationStatus = "nao_conectado" | "conectado" | "erro";

export interface IntegrationContext {
  workspaceId: string;
  userId: string;
}

export interface IntegrationConnectResult {
  status: IntegrationStatus;
  // Presente só em integrações OAuth (Google): a rota chamadora deve
  // fazer NextResponse.redirect(redirectUrl) em vez de responder JSON —
  // o "connect" de verdade só termina quando o provedor externo chama de
  // volta o /callback.
  redirectUrl?: string;
}

export interface IntegrationProvider {
  readonly slug: string; // bate com integracoes.codigo
  connect(ctx: IntegrationContext, params?: Record<string, unknown>): Promise<IntegrationConnectResult>;
  disconnect(ctx: IntegrationContext): Promise<void>;
  getStatus(ctx: IntegrationContext): Promise<IntegrationStatus>;
  validateConnection(ctx: IntegrationContext): Promise<boolean>;
  sync(ctx: IntegrationContext): Promise<void>;
}
