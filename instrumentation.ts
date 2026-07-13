// Ponto de entrada que o Next.js chama uma vez na subida do servidor —
// registra o Sentry pro runtime certo (node ou edge) e conecta o hook
// onRequestError, que o App Router chama automaticamente pra todo erro não
// tratado em Server Components, route handlers e middleware.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
