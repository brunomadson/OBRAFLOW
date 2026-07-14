// email.provider.ts — contrato pra e-mail transacional (Sprint 9, ETAPA 8).
//
// Não implementado de verdade ainda (nem precisa, por enquanto):
//   - Convite de membro e recuperação de senha já são enviados pelo
//     próprio Supabase Auth (signInWithOtp/resetPasswordForEmail) — não
//     duplicar isso aqui. sendInviteEmail()/sendPasswordReset() existem
//     no contrato só porque o ticket pediu explicitamente, mas hoje não
//     são chamados por nenhum código real — Supabase já cobre os dois.
//   - sendPaymentConfirmation()/sendPaymentFailed() são o motivo real
//     desta camada existir: pagamento aprovado/recusado hoje só loga no
//     servidor (processarEventoPagamento.ts) e não manda nada pro
//     cliente. Ativar quando tiver conta em Resend/Sendgrid/SES: criar
//     providers/resend.provider.ts implementando este contrato, registrar
//     abaixo, e chamar sendPaymentConfirmation/sendPaymentFailed a partir
//     de processarEventoPagamento.ts.
//
// Provider padrão (log.provider.ts) só escreve no console — zero custo,
// zero rede, mesma filosofia do Sentry desligado por padrão (Sprint 8).

export interface EmailProvider {
  readonly nome: string;
  sendInviteEmail(input: { email: string; nome: string; linkAceite: string }): Promise<void>;
  sendPasswordReset(input: { email: string; linkReset: string }): Promise<void>;
  sendPaymentConfirmation(input: { email: string; nome: string; planoNome: string }): Promise<void>;
  sendPaymentFailed(input: { email: string; nome: string; planoNome: string }): Promise<void>;
}

let providerAtivo: EmailProvider | null = null;

export async function getEmailProvider(): Promise<EmailProvider> {
  if (!providerAtivo) {
    providerAtivo = (await import("./providers/log.provider")).logProvider;
  }
  return providerAtivo;
}
