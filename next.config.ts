import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zrzqvdurgkqmoizlpeof.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

// Sem SENTRY_DSN configurado, o SDK fica inativo (Sentry.init nunca é
// chamado com dsn vazio) — o wrap abaixo só faz upload de sourcemap/anota
// build quando SENTRY_AUTH_TOKEN existir, senão é praticamente um no-op.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
