import type { EmailProvider } from "../email.provider";

// Provider padrão — só loga, não envia nada de verdade. Existe pra que o
// resto do sistema já possa chamar getEmailProvider() hoje sem precisar
// de nenhuma conta de e-mail transacional configurada. Trocar por
// resend.provider.ts (ou outro) quando decidirem ativar de verdade.
export const logProvider: EmailProvider = {
  nome: "log",

  async sendInviteEmail(input) {
    console.log(`[email:log] sendInviteEmail → ${input.email} (${input.nome}): ${input.linkAceite}`);
  },
  async sendPasswordReset(input) {
    console.log(`[email:log] sendPasswordReset → ${input.email}: ${input.linkReset}`);
  },
  async sendPaymentConfirmation(input) {
    console.log(`[email:log] sendPaymentConfirmation → ${input.email} (${input.nome}), plano ${input.planoNome}`);
  },
  async sendPaymentFailed(input) {
    console.log(`[email:log] sendPaymentFailed → ${input.email} (${input.nome}), plano ${input.planoNome}`);
  },
};
