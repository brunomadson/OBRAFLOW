// Init do Sentry no navegador. Convenção "instrumentation-client.ts" (em
// vez de sentry.client.config.ts) porque o projeto builda com Turbopack —
// o plugin webpack antigo não detecta o arquivo nesse modo.
//
// Sem NEXT_PUBLIC_SENTRY_DSN definido, enabled:false desliga o SDK — zero
// chamada de rede, zero custo, zero mudança de comportamento.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.2,
});

// Instrumentação de navegação do App Router (Next.js pede esse export
// quando o hook de transição de rota está disponível).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
