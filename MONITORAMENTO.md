# MONITORAMENTO.md — Rastreamento de erros (Sentry)

## Estado atual

O código já está pronto (`@sentry/nextjs` instalado e configurado —
`instrumentation.ts`, `instrumentation-client.ts`,
`sentry.server.config.ts`, `sentry.edge.config.ts`,
`src/app/global-error.tsx`, `next.config.ts`), mas **inativo**: sem a
variável `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` preenchida, `Sentry.init`
roda com `enabled: false` — nenhuma chamada de rede, nenhum custo, nenhuma
mudança de comportamento. Decisão consciente desta sprint: preparar o
código agora, decidir ativar quando fizer sentido (ver
`SPRINT 8 — O que me diz?` na conversa que criou isto).

## O que já está cabeado, pronto pra funcionar assim que ativar

- Erros de frontend (componentes React) — via `global-error.tsx` (raiz do
  App Router) + captura automática do SDK.
- Erros de rotas/servidor (Server Components, route handlers, middleware)
  — via `onRequestError` em `instrumentation.ts`.
- Identificação de quem gerou o erro — `AuthContext.tsx` chama
  `Sentry.setUser({id, email})` e `Sentry.setContext("workspace", {id, cargo})`
  toda vez que a sessão muda, então todo evento reportado já vem com
  workspace e usuário identificados (crucial pra dar suporte).

## Como ativar de verdade

1. Criar conta em [sentry.io](https://sentry.io) (tem plano free, 5k
   eventos/mês).
2. Criar um projeto do tipo "Next.js".
3. Copiar o DSN mostrado (formato `https://xxxx@xxxx.ingest.sentry.io/xxxx`).
4. Preencher no `.env.local` (dev) e nas variáveis de ambiente da Vercel
   (produção):
   ```
   NEXT_PUBLIC_SENTRY_DSN=<dsn>
   SENTRY_DSN=<mesmo dsn>
   SENTRY_ENVIRONMENT=production   (ou "development" no ambiente DEV)
   NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
   ```
5. Opcional (upload de sourcemap pra stack trace legível em produção):
   `SENTRY_ORG`, `SENTRY_PROJECT` (achados na URL do projeto no Sentry) e
   `SENTRY_AUTH_TOKEN` (Settings → Auth Tokens, escopo `project:releases`).
6. Redeploy. Pronto — a partir daí todo erro não tratado aparece no painel
   do Sentry já com workspace/usuário identificados.

## Por que não ativado nesta sprint

Sistema ainda pequeno (poucos usuários reais) — o custo de criar a conta
agora não compensa o benefício ainda. O código pronto elimina o único
custo real (tempo de integração), então ativar depois é só a etapa 4 acima,
sem nenhuma mudança de código.
