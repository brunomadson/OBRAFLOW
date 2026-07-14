import type {
  PaymentProvider,
  PaymentEvent,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  StatusVerificado,
} from "../payment.provider";

// Estrutura futura, conforme pedido no ticket (ETAPA 3) — só o contrato
// implementado, sem integração real com a API da Stripe. Ativar quando
// (e se) a Stripe entrar como gateway: instalar o SDK oficial ("stripe"),
// trocar cada método abaixo pela chamada real, e configurar
// STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET no ambiente.
export const stripeProvider: PaymentProvider = {
  nome: "stripe",

  async createCustomer(_input: CreateCustomerInput): Promise<CreateCustomerResult> {
    throw new Error("stripe.provider: ainda não implementado.");
  },

  async createSubscription(_input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    throw new Error("stripe.provider: ainda não implementado.");
  },

  async cancelSubscription(_gatewaySubscriptionId: string): Promise<void> {
    throw new Error("stripe.provider: ainda não implementado.");
  },

  async verifyPayment(_gatewaySubscriptionId: string): Promise<StatusVerificado> {
    throw new Error("stripe.provider: ainda não implementado.");
  },

  parseWebhookEvent(_rawBody: string, _headers: Record<string, string>): PaymentEvent | null {
    console.error("[stripe.provider] webhook recebido mas o provider ainda não está implementado.");
    return null;
  },
};
