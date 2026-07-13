"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";

// Pega qualquer erro não tratado que escape até a raiz do App Router.
// Precisa definir <html>/<body> porque substitui o layout raiz inteiro
// quando é acionado (única exceção nessa regra em todo o App Router).
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
