// Init do Sentry pro runtime Node (rotas de servidor, middleware em node).
// Sem SENTRY_DSN no ambiente, "enabled: false" desliga o SDK por completo —
// nenhuma rede, nenhum custo, nenhum comportamento novo até alguém
// preencher a variável (ver AMBIENTES.md / MONITORAMENTO.md).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.2,
});
