# Sprint 9 — Camada Comercial do SaaS (Planos, Assinaturas, Billing Desacoplado)

**Status: código completo, migrations aplicadas, testes rodados de verdade — 29/29 passando.**

## Resumo

ObraFlow ganhou um motor próprio de assinatura, desacoplado de qualquer
gateway de pagamento. Nenhuma lógica específica de Cakto/Stripe vaza pra
fora de `src/services/payments/` — o resto do sistema só conhece
`workspace`, `plano`, `status da assinatura` e `has_feature()`.

## Tabelas criadas

| Tabela | Migration | Responsabilidade |
|---|---|---|
| `subscriptions` | `039_subscriptions.sql` | Quem paga o quê, em qual status, por qual gateway. Fonte de verdade do plano vigente de cada workspace (substitui `workspaces.plano_id`, que nunca foi usado). |
| `saas_admins` | `041_saas_admins.sql` | Quem pode entrar em `/admin` (cross-tenant). Sem policy de RLS pra `authenticated` — só `service_role`/funções `SECURITY DEFINER` acessam. |

## Funções SQL criadas

| Função | Migration | Uso |
|---|---|---|
| `has_feature(workspace_id, codigo)` | `040_has_feature.sql` | "Esse workspace contratou X?" — reaproveita `plano_integracoes`/`integracoes` já existentes (migration 024). Trava `workspace_id` contra `get_my_workspace_id()` (sem isso, dava pra consultar feature de outro tenant). |
| `is_saas_admin()` | `041_saas_admins.sql` | Gate de `/admin` e das rotas `/api/admin/*`. |
| `get_workspace_access_status()` | `042_workspace_access_status.sql` | `'ok' \| 'past_due' \| 'blocked'` — usada pelo middleware (bloqueio real) e pelo banner de "pagamento atrasado". **Sem assinatura nenhuma = `'ok'`, nunca bloqueia** — proposital, pra não trancar workspace legado (todos os existentes, inclusive o de produção) no momento em que a migration rodar. |

## Arquivos criados

- `supabase/migrations/039_subscriptions.sql`, `040_has_feature.sql`, `041_saas_admins.sql`, `042_workspace_access_status.sql`
- `src/lib/supabase/admin.ts` — client service_role server-only (route handlers)
- `src/lib/supabase/requireSaasAdmin.ts` — checagem de admin interno pras rotas `/api/admin/*`
- `src/services/payments/payment.provider.ts` — contrato `PaymentProvider` + registro de gateways
- `src/services/payments/providers/cakto.provider.ts` — implementação de melhor esforço (ver riscos abaixo)
- `src/services/payments/providers/stripe.provider.ts` — stub, "estrutura futura" conforme pedido
- `src/services/payments/processarEventoPagamento.ts` — converte evento interno em mudança de estado (cliente novo, reativação, past_due, cancelamento)
- `src/app/api/webhooks/payment/route.ts` — rota única e genérica (`?provider=cakto`)
- `src/services/email/email.provider.ts` + `providers/log.provider.ts` — arquitetura pronta, só loga (nenhum e-mail de verdade enviado ainda)
- `src/app/api/admin/clientes/route.ts` + `[workspaceId]/route.ts` — listar/editar clientes
- `src/app/admin/page.tsx` — painel interno (lista, troca plano, ativa manual, suspende)
- `src/app/assinatura-pendente/page.tsx` — destino do bloqueio
- `src/hooks/useAssinaturaStatus.ts` — banner de "pagamento atrasado" no app
- `subscriptions-test.mjs` — suíte de testes (Etapa 10)

## Arquivos alterados

- `src/services/integracoes.service.ts` — `getIntegracoes()` agora resolve o plano vigente via `subscriptions` (ativo/trial), não mais via `workspaces.plano_id` (**bug pré-existente corrigido de graça**: essa coluna nunca foi preenchida por nenhum fluxo real, então "disponível no plano" sempre dava `false` pra todo workspace real até agora).
- `src/lib/supabase/middleware.ts` — bloqueio real (`get_workspace_access_status()`) antes de qualquer página autenticada; `/api/webhooks` e `/assinatura-pendente` viram rotas públicas.
- `src/components/layout/AppShell.tsx` — banner de pagamento atrasado.
- `.env.example` / `.env.local` — `NEXT_PUBLIC_SITE_URL`, `CAKTO_WEBHOOK_SECRET`.
- `backup-manual.mjs` — `subscriptions`/`saas_admins` entram no backup manual.

## Testes realizados

**Executados de verdade contra o banco (migrations 039-042 aplicadas) e contra um servidor `npm run dev` real — 29/29 passando** (`subscriptions-test.mjs`):

- RLS: CEO vê a própria assinatura, SDR (sem `configuracoes`) não vê, CEO de outro workspace não vê (cross-tenant).
- Escrita bloqueada pro client: INSERT/UPDATE/DELETE direto em `subscriptions` falham mesmo pro CEO — só `service_role` escreve.
- `get_workspace_access_status()`: `active`→ok, `past_due`→past_due (não bloqueia), `canceled`→blocked, sem assinatura→ok (grandfather), `workspaces.ativo=false`→blocked mesmo com assinatura ativa.
- `has_feature()`: respeita o plano, respeita status da assinatura (cancela → todas as features somem), bloqueia consulta cross-tenant.
- `is_saas_admin()`: false por padrão, true depois de inserido em `saas_admins`, isolado por usuário.
- Webhook (`/api/webhooks/payment?provider=cakto`, contra `npm run dev` real): `payment.approved` cria workspace+convite+assinatura; reenvio do mesmo evento não duplica nem assinatura nem workspace/convite (idempotência); `payment.failed`→`past_due`; `subscription.canceled`→`canceled`; sem secret→401; sem `?provider=`→400.

`npm run build` e `npm run type-check`: **passando**.

### Bug real encontrado e corrigido durante o teste

A primeira execução do teste **encontrou um bug de verdade**: reenviar o
mesmo evento `payment.approved` (simulando o gateway reentregando um
webhook, cenário comum) criava um **segundo workspace duplicado** pro
mesmo e-mail. Causa: a checagem de "esse e-mail já tem workspace?" filtrava
por `workspace_invites.used_at IS NOT NULL`, mas esse campo é preenchido
por um trigger (`handle_new_user`) que não roda de forma síncrona
confiável dentro da janela entre 2 chamadas de webhook em sequência
rápida — na prática, o segundo evento não encontrava o convite "usado"
ainda e seguia pro caminho de "cliente novo". A assinatura em si não
duplicou (índice único em `gateway_subscription_id` segurou), mas o
workspace/convite já tinham sido criados antes disso.

**Corrigido** em `processarEventoPagamento.ts` (`buscarWorkspacePorEmail`):
agora considera QUALQUER convite existente pra aquele e-mail (usado ou
não), não só os já aceitos — essa checagem não depende de nenhum timing
externo, porque o convite é inserido de forma síncrona pelo próprio código
antes de chamar `signInWithOtp`. Reexecutado depois da correção: 29/29,
incluindo 2 asserções novas específicas pra esse cenário (reenvio não cria
segundo workspace nem segundo convite).

## Riscos e lacunas conhecidas (nenhuma escondida)

1. **`cakto.provider.ts` é melhor esforço, não verificado contra a documentação real da Cakto.** Não tenho acesso à documentação/painel da Cakto agora. O nome dos campos do webhook (`event`, `data.customer`, `data.subscription`, `data.product`) e o mecanismo de validação (header `x-cakto-secret` comparado a `CAKTO_WEBHOOK_SECRET`) são suposições plausíveis, não confirmadas. **Antes de ativar de verdade**: conferir o payload real de um webhook de teste da Cakto e ajustar `mapearEvento()`/`validarAssinatura()`/os campos lidos em `parseWebhookEvent()`. `createCustomer`/`createSubscription`/`cancelSubscription`/`verifyPayment` lançam erro explícito — não fingem funcionar.
2. **`workspaces.owner_id` fica `NULL`** pra workspaces criados via webhook (o CEO só existe depois que o convite é aceito, workspace vem primeiro). Não é usado por nenhuma RLS hoje — lacuna cosmética, documentada, não corrigida pra não adicionar complexidade sem necessidade.
3. **Dedup de e-mail que já comprou antes** usa `workspace_invites.used_at IS NOT NULL` como chave de "esse e-mail já tem workspace" — janela pequena de corrida se o mesmo webhook chegar 2x quase simultaneamente antes do primeiro terminar de processar (baixa probabilidade, tráfego inicial baixo; documentado, não resolvido com lock adicional por ora).
4. **E-mail transacional** (`email.provider.ts`) só loga — nenhum e-mail de confirmação/falha de pagamento é enviado de verdade ainda. Convite de membro e recuperação de senha continuam via Supabase Auth (não mudou).
5. **`/api/admin/*` testado só na camada `is_saas_admin()`/RPC**, não numa chamada HTTP real com cookie de sessão de navegador — mesma limitação já conhecida de sprints anteriores (este ambiente não roda um navegador de verdade). `subscriptions-test.mjs` valida o mecanismo de autorização, não a rota HTTP completa.
6. **Bootstrap do primeiro `saas_admin`** (migration 041) usa o e-mail `concretize.eng.contato@gmail.com` — confirme se é esse mesmo o e-mail de login da conta que deve administrar o SaaS antes de rodar a migration; se não for, ajuste o `WHERE email = ...` antes de colar no SQL Editor.
7. **Sem carência de trial automática**: nada no código dispara `status: 'trialing'` automaticamente — todo `INSERT` feito por este código usa `'active'` direto. Se quiserem período de trial de verdade (X dias grátis antes de cobrar), é um ajuste pequeno em `processarEventoPagamento.ts`/no painel admin, não implementado porque o ticket não especificou a regra de duração.

## Próximos passos (na ordem)

1. ~~Colar as migrations `039` → `042` no Supabase SQL Editor.~~ **Feito.**
2. ~~Rodar `subscriptions-test.mjs`.~~ **Feito — 29/29 passando, 1 bug real achado e corrigido no processo.**
3. Quando tiver acesso à documentação da Cakto: ajustar `cakto.provider.ts` e configurar `CAKTO_WEBHOOK_SECRET` de produção na Vercel + `NEXT_PUBLIC_SITE_URL` de produção (hoje só existem valores de DEV local em `.env.local`).
4. Configurar o webhook no painel da Cakto apontando pra `https://<seu-domínio>/api/webhooks/payment?provider=cakto`.
