import type {
  PaymentProvider,
  PaymentEvent,
  PaymentEventType,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  StatusVerificado,
} from "../payment.provider";

// ATENÇÃO — implementação de melhor esforço, não verificada contra a
// documentação real da Cakto (não tenho acesso a ela neste momento).
// O que está pronto e testável hoje: a ESTRUTURA (contrato PaymentProvider,
// registro no payment.provider.ts, rota de webhook genérica). O que
// PRECISA ser conferido/ajustado antes de ativar de verdade:
//
//   1. Nome exato dos campos do payload do webhook da Cakto (assumi um
//      formato plausível abaixo: { event, data: { customer, subscription,
//      product } } — comum nesse tipo de plataforma, mas não confirmado).
//   2. Mecanismo real de validação de assinatura do webhook. A Cakto pode
//      usar um token secreto simples (comparar um header/campo contra
//      CAKTO_WEBHOOK_SECRET, implementado abaixo) OU um HMAC de verdade
//      (assinatura calculada sobre o corpo cru) — precisa confirmar na
//      documentação/painel da Cakto e ajustar validarAssinatura().
//   3. Se a Cakto tem API para createSubscription/cancelSubscription/
//      verifyPayment, ou se (mais provável em plataformas de checkout
//      hospedado, como Hotmart) a compra só acontece na página de
//      checkout deles e a Cakto nunca é "chamada" pelo ObraFlow, só ouvida
//      via webhook. Por isso os 3 métodos abaixo lançam erro explícito em
//      vez de fingir que funcionam — evita uma falha silenciosa em
//      produção por causa de uma suposição errada.
//
// Nenhuma dessas lacunas afeta o fluxo principal (webhook → cliente novo),
// que só depende de parseWebhookEvent().

const CAKTO_WEBHOOK_SECRET = process.env.CAKTO_WEBHOOK_SECRET;

function mapearEvento(eventoCakto: string): PaymentEventType | null {
  const mapa: Record<string, PaymentEventType> = {
    purchase_approved: "payment.approved",
    subscription_renewed: "payment.approved",
    purchase_refused: "payment.failed",
    subscription_canceled: "subscription.canceled",
    subscription_late: "subscription.past_due",
  };
  return mapa[eventoCakto] ?? null;
}

function validarAssinatura(headers: Record<string, string>): boolean {
  if (!CAKTO_WEBHOOK_SECRET) {
    console.error("[cakto.provider] CAKTO_WEBHOOK_SECRET não configurado — recusando webhook.");
    return false;
  }
  // TODO: confirmar o nome real do header que a Cakto usa pra mandar o
  // secret/assinatura (aqui assumido "x-cakto-secret", comparação direta
  // de token — trocar por verificação HMAC se a Cakto usar isso).
  const recebido = headers["x-cakto-secret"];
  return recebido === CAKTO_WEBHOOK_SECRET;
}

export const caktoProvider: PaymentProvider = {
  nome: "cakto",

  async createCustomer(_input: CreateCustomerInput): Promise<CreateCustomerResult> {
    throw new Error(
      "cakto.provider: createCustomer não implementado — a Cakto usa checkout " +
        "hospedado (o cliente compra na página deles, não via API do ObraFlow). " +
        "Confirmar na documentação da Cakto se existe endpoint de criação de cliente."
    );
  },

  async createSubscription(_input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    throw new Error(
      "cakto.provider: createSubscription não implementado — mesmo motivo de createCustomer."
    );
  },

  async cancelSubscription(_gatewaySubscriptionId: string): Promise<void> {
    throw new Error(
      "cakto.provider: cancelSubscription não implementado — confirmar se a Cakto " +
        "expõe API de cancelamento ou se isso só acontece no painel deles."
    );
  },

  async verifyPayment(_gatewaySubscriptionId: string): Promise<StatusVerificado> {
    throw new Error(
      "cakto.provider: verifyPayment não implementado — confirmar endpoint de " +
        "consulta de status na API da Cakto."
    );
  },

  parseWebhookEvent(rawBody: string, headers: Record<string, string>): PaymentEvent | null {
    if (!validarAssinatura(headers)) return null;

    let payload: {
      event?: string;
      data?: {
        customer?: { email?: string; name?: string; id?: string };
        subscription?: { id?: string; next_billing_at?: string };
        product?: { code?: string };
      };
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[cakto.provider] payload do webhook não é JSON válido.");
      return null;
    }

    const tipo = payload.event ? mapearEvento(payload.event) : null;
    if (!tipo) {
      console.error(`[cakto.provider] evento "${payload.event}" desconhecido/ignorado.`);
      return null;
    }

    return {
      type: tipo,
      gatewayProvider: "cakto",
      gatewayCustomerId: payload.data?.customer?.id ?? null,
      gatewaySubscriptionId: payload.data?.subscription?.id ?? null,
      email: payload.data?.customer?.email?.toLowerCase() ?? null,
      nome: payload.data?.customer?.name ?? null,
      planoCodigo: payload.data?.product?.code ?? null,
      nextBillingDate: payload.data?.subscription?.next_billing_at ?? null,
      raw: payload,
    };
  },
};
