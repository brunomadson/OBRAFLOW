import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider } from "@/services/email/email.provider";
import type { PaymentEvent } from "./payment.provider";

// Server-only. Converte um PaymentEvent (já traduzido do formato do
// gateway pelo provider) em mudança de estado real no banco:
//   payment.approved         → cliente novo (cria workspace+convite) OU
//                               assinatura existente (reativa/atualiza)
//   payment.failed           → marca past_due se já existir assinatura
//   subscription.canceled    → marca canceled
//   subscription.past_due    → marca past_due
//
// Idempotente por gateway_subscription_id: reprocessar o mesmo evento (o
// gateway pode reenviar) só atualiza a linha existente, nunca duplica.

interface SubscriptionRow {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: string;
}

interface CargoRow {
  id: string;
}

interface PlanoRow {
  id: string;
  nome: string;
}

async function buscarSubscriptionExistente(
  admin: ReturnType<typeof createAdminClient>,
  evento: PaymentEvent
): Promise<SubscriptionRow | null> {
  if (!evento.gatewaySubscriptionId) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("id, workspace_id, plan_id, status")
    .eq("gateway_provider", evento.gatewayProvider)
    .eq("gateway_subscription_id", evento.gatewaySubscriptionId)
    .maybeSingle<SubscriptionRow>();
  return data ?? null;
}

async function buscarEmailDoWorkspace(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ email: string; nome: string } | null> {
  const { data } = await admin
    .from("workspace_invites")
    .select("email, nome")
    .eq("workspace_id", workspaceId)
    .eq("cargo", "CEO / Dono")
    .not("used_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ email: string; nome: string | null }>();
  return data ? { email: data.email, nome: data.nome ?? data.email } : null;
}

// E-mail já comprou antes (workspace existe)? Reaproveita o workspace do
// convite mais recente pra esse e-mail, em vez de criar um novo — evita
// duplicar workspace se o cliente comprar de novo ou o webhook reenviar o
// evento.
//
// Achado testando de verdade (subscriptions-test.mjs): filtrar por
// used_at IS NOT NULL aqui parecia mais "correto" (só considerar convite
// já aceito), mas causou uma duplicação real — handle_new_user (o trigger
// que marca used_at) não roda de forma síncrona confiável dentro da janela
// entre 2 chamadas de webhook em sequência rápida. O convite em si é
// inserido de forma síncrona por ESTE código (criarWorkspaceEConvidarCeo,
// antes de chamar signInWithOtp), então checar só "existe algum convite
// pra esse e-mail" (usado ou não) é a checagem que não depende de nenhum
// timing externo.
async function buscarWorkspacePorEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  const { data } = await admin
    .from("workspace_invites")
    .select("workspace_id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ workspace_id: string }>();
  return data?.workspace_id ?? null;
}

async function criarWorkspaceEConvidarCeo(
  admin: ReturnType<typeof createAdminClient>,
  evento: PaymentEvent
): Promise<string> {
  if (!evento.email) throw new Error("Evento sem e-mail — não é possível criar cliente.");
  if (!evento.planoCodigo) throw new Error("Evento sem código de plano — não é possível criar cliente.");

  const { data: plano, error: planoErr } = await admin
    .from("planos")
    .select("id, nome")
    .eq("codigo", evento.planoCodigo)
    .maybeSingle<PlanoRow>();
  if (planoErr) throw planoErr;
  if (!plano) throw new Error(`Plano "${evento.planoCodigo}" não existe na tabela planos.`);

  const workspaceId = crypto.randomUUID();
  const nomeWorkspace = evento.nome ? `${evento.nome}` : evento.email;

  // owner_id fica NULL aqui — só é preenchido no fluxo normal de onboarding
  // (createWorkspaceAndLink), onde o usuário já existe antes do workspace.
  // Aqui é o contrário (workspace existe antes do usuário aceitar o
  // convite), e owner_id não é usado por nenhuma policy de RLS hoje —
  // fica como lacuna conhecida, documentada no relatório da sprint.
  const { error: wErr } = await admin.from("workspaces").insert({
    id: workspaceId,
    nome: nomeWorkspace,
    tipo_conta: "PJ",
    ativo: true,
  } as never);
  if (wErr) throw wErr;

  // O INSERT acima dispara workspaces_seed_cargos (migration 027), que já
  // criou os 6 cargos padrão pra este workspace.
  const { data: cargoCeo, error: cErr } = await admin
    .from("cargos")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("nome", "CEO / Dono")
    .maybeSingle<CargoRow>();
  if (cErr) throw cErr;
  if (!cargoCeo) throw new Error("Cargo CEO / Dono não foi criado para o novo workspace.");

  // Mesma tabela e mesmo mecanismo do convite manual (ModalMembro.tsx) —
  // handle_new_user (migration 032) aplica workspace_id/cargo_id ao criar
  // o profile quando o e-mail bate com um convite pendente.
  const { error: iErr } = await admin.from("workspace_invites").insert({
    email: evento.email,
    nome: evento.nome ?? evento.email,
    cargo: "CEO / Dono",
    cargo_id: cargoCeo.id,
    workspace_id: workspaceId,
    created_by: null,
  } as never);
  if (iErr) throw iErr;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL não configurado — não é possível montar o link de convite.");

  // Mesmo mecanismo de e-mail do convite manual — reaproveita o fluxo já
  // existente (/auth/callback → /aceitar-convite), conforme pedido no
  // ticket ("não criar outro fluxo de cadastro").
  const { error: otpErr } = await admin.auth.signInWithOtp({
    email: evento.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/aceitar-convite`,
    },
  });
  if (otpErr) {
    console.error(`[processarEventoPagamento] falha ao enviar convite por e-mail para ${evento.email}:`, otpErr.message);
  }

  return workspaceId;
}

export async function processarEventoPagamento(evento: PaymentEvent): Promise<void> {
  const admin = createAdminClient();

  const existente = await buscarSubscriptionExistente(admin, evento);

  switch (evento.type) {
    case "payment.approved": {
      const email = await getEmailProvider();

      if (existente) {
        const { error } = await admin
          .from("subscriptions")
          .update({
            status: "active",
            subscription_start: existente.status === "trialing" ? new Date().toISOString() : undefined,
            next_billing_date: evento.nextBillingDate,
            canceled_at: null,
          } as never)
          .eq("id", existente.id);
        if (error) throw error;

        const [{ data: plano }, contato] = await Promise.all([
          admin.from("planos").select("id, nome").eq("id", existente.plan_id).maybeSingle<PlanoRow>(),
          buscarEmailDoWorkspace(admin, existente.workspace_id),
        ]);
        if (contato) {
          await email.sendPaymentConfirmation({ email: contato.email, nome: contato.nome, planoNome: plano?.nome ?? evento.planoCodigo ?? "" });
        }
        return;
      }

      // Cliente novo ou renovação de um workspace que já existe mas ainda
      // não tinha uma linha de subscription pra esse gateway_subscription_id.
      const workspaceId = evento.email ? await buscarWorkspacePorEmail(admin, evento.email) : null;
      const workspaceFinal = workspaceId ?? (await criarWorkspaceEConvidarCeo(admin, evento));

      let plano: PlanoRow | null = null;
      if (evento.planoCodigo) {
        const { data } = await admin
          .from("planos")
          .select("id, nome")
          .eq("codigo", evento.planoCodigo)
          .maybeSingle<PlanoRow>();
        plano = data ?? null;
      }
      if (!plano) throw new Error(`Não foi possível resolver plano_id para o código "${evento.planoCodigo}".`);

      const { error: sErr } = await admin.from("subscriptions").insert({
        workspace_id: workspaceFinal,
        plan_id: plano.id,
        gateway_provider: evento.gatewayProvider,
        gateway_customer_id: evento.gatewayCustomerId,
        gateway_subscription_id: evento.gatewaySubscriptionId,
        status: "active",
        subscription_start: new Date().toISOString(),
        next_billing_date: evento.nextBillingDate,
      } as never);
      if (sErr) throw sErr;

      if (evento.email) {
        await email.sendPaymentConfirmation({ email: evento.email, nome: evento.nome ?? evento.email, planoNome: plano.nome });
      }
      return;
    }

    case "payment.failed": {
      if (!existente) {
        console.error(`[processarEventoPagamento] payment.failed sem assinatura correspondente (gateway_subscription_id=${evento.gatewaySubscriptionId}) — ignorado.`);
        return;
      }
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "past_due" } as never)
        .eq("id", existente.id);
      if (error) throw error;

      const [{ data: plano }, contato] = await Promise.all([
        admin.from("planos").select("id, nome").eq("id", existente.plan_id).maybeSingle<PlanoRow>(),
        buscarEmailDoWorkspace(admin, existente.workspace_id),
      ]);
      if (contato) {
        const email = await getEmailProvider();
        await email.sendPaymentFailed({ email: contato.email, nome: contato.nome, planoNome: plano?.nome ?? "" });
      }
      return;
    }

    case "subscription.past_due": {
      if (!existente) {
        console.error(`[processarEventoPagamento] subscription.past_due sem assinatura correspondente — ignorado.`);
        return;
      }
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "past_due" } as never)
        .eq("id", existente.id);
      if (error) throw error;
      return;
    }

    case "subscription.canceled": {
      if (!existente) {
        console.error(`[processarEventoPagamento] subscription.canceled sem assinatura correspondente — ignorado.`);
        return;
      }
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() } as never)
        .eq("id", existente.id);
      if (error) throw error;
      return;
    }
  }
}
