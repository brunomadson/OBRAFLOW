import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationProvider, IntegrationContext, IntegrationConnectResult, IntegrationStatus } from "./integration-types";

// Registro de providers implementados — adicionar uma integração nova
// (WhatsApp, IA, Pagamentos) é 1 linha aqui, nunca mexer nas rotas
// /api/integrations/* nem nos outros providers. Só o que está registrado
// aqui pode ser conectado; um código presente em `integracoes` mas sem
// entrada aqui (whatsapp/ia/open_finance/importacao_externa, por
// enquanto) fica "sem implementação" — a UI mostra isso, não deixa clicar.
const registry = new Map<string, () => Promise<IntegrationProvider>>();
registry.set("google_drive", async () => (await import("../google-drive/google-drive.provider")).googleDriveProvider);
registry.set("google_agenda", async () => (await import("../google-calendar/google-calendar.provider")).googleCalendarProvider);

export function getRegisteredSlugs(): string[] {
  return [...registry.keys()];
}

export async function getProvider(slug: string): Promise<IntegrationProvider | null> {
  const factory = registry.get(slug);
  if (!factory) return null;
  return factory();
}

export class IntegracaoIndisponivelError extends Error {}

// Checagem de plano no BACKEND (Etapa 4 do ticket — "não somente escondendo
// botão na tela"). Não usa a RPC has_feature() porque aquela depende de
// auth.uid()/get_my_workspace_id() (pensada pra ser chamada pelo client
// autenticado checando o PRÓPRIO workspace) — aqui quem chama é sempre uma
// rota de servidor com service_role, sem sessão de usuário no sentido do
// Postgres, então repeto a mesma regra de negócio direto contra as
// tabelas, parametrizada pelo workspaceId explícito.
async function workspaceTemAcesso(workspaceId: string, slug: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: integracao } = await admin
    .from("integracoes")
    .select("id, tipo_acesso, ativo")
    .eq("codigo", slug)
    .maybeSingle<{ id: string; tipo_acesso: string; ativo: boolean }>();
  if (!integracao || !integracao.ativo) return false;
  if (integracao.tipo_acesso === "essential") return true;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_id")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "trialing"])
    .maybeSingle<{ plan_id: string }>();
  if (!sub) return false;

  const { data: liberado } = await admin
    .from("plano_integracoes")
    .select("disponivel")
    .eq("plano_id", sub.plan_id)
    .eq("integracao_id", integracao.id)
    .maybeSingle<{ disponivel: boolean }>();
  return liberado?.disponivel === true;
}

async function assertAcesso(ctx: IntegrationContext, slug: string): Promise<void> {
  const ok = await workspaceTemAcesso(ctx.workspaceId, slug);
  if (!ok) throw new IntegracaoIndisponivelError(`Integração "${slug}" não está disponível no plano atual deste workspace.`);
}

export async function connectIntegration(
  ctx: IntegrationContext,
  slug: string,
  params?: Record<string, unknown>
): Promise<IntegrationConnectResult> {
  await assertAcesso(ctx, slug);
  const provider = await getProvider(slug);
  if (!provider) throw new IntegracaoIndisponivelError(`Integração "${slug}" ainda não tem provider implementado.`);
  return provider.connect(ctx, params);
}

export async function disconnectIntegration(ctx: IntegrationContext, slug: string): Promise<void> {
  const provider = await getProvider(slug);
  if (!provider) throw new IntegracaoIndisponivelError(`Integração "${slug}" ainda não tem provider implementado.`);
  return provider.disconnect(ctx);
}

export async function getIntegrationStatus(ctx: IntegrationContext, slug: string): Promise<IntegrationStatus> {
  const provider = await getProvider(slug);
  if (!provider) return "nao_conectado";
  return provider.getStatus(ctx);
}

export async function testIntegrationConnection(ctx: IntegrationContext, slug: string): Promise<boolean> {
  const provider = await getProvider(slug);
  if (!provider) throw new IntegracaoIndisponivelError(`Integração "${slug}" ainda não tem provider implementado.`);
  return provider.validateConnection(ctx);
}
