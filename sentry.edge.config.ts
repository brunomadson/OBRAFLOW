// Init do Sentry pro runtime Edge (middleware.ts roda em edge por padrão no
// Next.js). Mesma regra do sentry.server.config.ts: sem SENTRY_DSN, inativo.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  tracesSampleRate: 0.2,
});
