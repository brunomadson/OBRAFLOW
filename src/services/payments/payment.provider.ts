// payment.provider.ts — contrato único que qualquer gateway de pagamento
// precisa implementar. Nada no resto do sistema (webhook, fluxo de novo
// cliente, painel admin) conhece Cakto/Stripe/Mercado Pago diretamente —
// só conhece este contrato. Trocar de gateway, ou aceitar vários ao mesmo
// tempo, nunca deve exigir mudar código fora de src/services/payments/.

// Eventos internos do sistema — todo gateway precisa converter seu formato
// de webhook pra um destes 4, é o "idioma comum" entre ObraFlow e qualquer
// provedor externo.
export type PaymentEventType =
  | "payment.approved" // primeira compra aprovada ou renovação cobrada com sucesso
  | "payment.failed" // tentativa de cobrança falhou (cartão recusado etc.)
  | "subscription.canceled" // cliente ou gateway cancelou a assinatura
  | "subscription.past_due"; // pagamento atrasado, assinatura ainda não cancelada

export interface PaymentEvent {
  type: PaymentEventType;
  gatewayProvider: string; // 'cakto', 'stripe' — bate com subscriptions.gateway_provider
  gatewayCustomerId: string | null;
  gatewaySubscriptionId: string | null;
  email: string | null; // pra identificar/criar o cliente quando ainda não existe workspace
  nome: string | null;
  planoCodigo: string | null; // bate com planos.codigo (ex. 'profissional')
  nextBillingDate: string | null; // ISO, quando o gateway informa
  raw: unknown; // payload cru, guardado pra auditoria/debug — nunca confiar só nele
}

export interface CreateCustomerInput {
  email: string;
  nome: string;
}
export interface CreateCustomerResult {
  gatewayCustomerId: string;
}

export interface CreateSubscriptionInput {
  gatewayCustomerId: string;
  planoCodigo: string;
}
export interface CreateSubscriptionResult {
  gatewaySubscriptionId: string;
  checkoutUrl: string | null; // gateways com checkout hospedado (Cakto, Hotmart) retornam link pro cliente pagar
}

export type StatusVerificado = "active" | "past_due" | "canceled" | "expired" | "unknown";

export interface PaymentProvider {
  readonly nome: string;

  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(gatewaySubscriptionId: string): Promise<void>;

  // Consulta o status atual direto na API do gateway (reconciliação/painel
  // admin) — não confiar só no último webhook recebido.
  verifyPayment(gatewaySubscriptionId: string): Promise<StatusVerificado>;

  // Converte o corpo cru do webhook (formato específico do gateway) pro
  // PaymentEvent interno. Deve validar a assinatura/segredo do webhook
  // aqui dentro — retorna null se a assinatura for inválida ou o evento
  // não for reconhecido (o caller deve responder 401/400, não processar).
  parseWebhookEvent(rawBody: string, headers: Record<string, string>): PaymentEvent | null;
}

class GatewayNaoSuportadoError extends Error {
  constructor(nome: string) {
    super(`Gateway de pagamento "${nome}" não está registrado.`);
    this.name = "GatewayNaoSuportadoError";
  }
}

// Registro dos providers disponíveis. Adicionar um gateway novo = criar o
// arquivo em providers/ implementando PaymentProvider e adicionar 1 linha
// aqui — nunca mexer no webhook nem no restante do sistema.
const registry = new Map<string, () => Promise<PaymentProvider>>();

registry.set("cakto", async () => (await import("./providers/cakto.provider")).caktoProvider);
registry.set("stripe", async () => (await import("./providers/stripe.provider")).stripeProvider);

export async function getPaymentProvider(nome: string): Promise<PaymentProvider> {
  const factory = registry.get(nome);
  if (!factory) throw new GatewayNaoSuportadoError(nome);
  return factory();
}
