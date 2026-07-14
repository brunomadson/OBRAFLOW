# Sprint 11.1 — Arquitetura Base de Integrações SaaS

**Status: código completo, migrations 043+044 aplicadas, todos os testes passando de verdade — 11/11 em `integracoes-test.mjs` + 61/61 nos testes existentes (`security-test`, `rbac-test`, `rbac-documentos-test`), sem regressão.**

## Arquitetura criada

```
src/services/integrations/
├── core/
│   ├── integration-types.ts      — IntegrationProvider, IntegrationStatus, IntegrationContext
│   ├── integration-provider.ts   — persistência compartilhada (ler/gravar conexão, cifrar credencial, logar evento)
│   ├── integration-manager.ts    — registry (slug → provider) + checagem de plano no backend
│   └── google-oauth.ts           — mecânica OAuth compartilhada (Drive + Calendar são o mesmo vendor)
├── google-drive/
│   ├── google-drive.provider.ts  — implementa IntegrationProvider
│   └── google-drive.service.ts   — chamadas à API do Drive
└── google-calendar/
    ├── google-calendar.provider.ts
    └── google-calendar.service.ts
```

`whatsapp/`, `ai/`, `payment/` **não foram criadas vazias** — pastas sem nenhum arquivo não versionam no git, e um arquivo-placeholder sem código real seria só ruído. A arquitetura já permite adicioná-las: 1 arquivo `<nome>.provider.ts` implementando `IntegrationProvider` + 1 linha no registry de `integration-manager.ts`, nada mais muda.

Cada provider implementa exatamente os 5 métodos do ticket: `connect()`, `disconnect()`, `getStatus()`, `validateConnection()`, `sync()`. A interface React (`AbaIntegracoes`, em `SetorConfiguracoes.tsx`) não conhece Google API nenhuma — só chama `getIntegracoes()`, navega pra `/api/integrations/<slug>/connect`, ou faz `POST` em `/disconnect`/`/test`.

## Migrations criadas

**`043_integracoes_arquitetura_saas.sql`** (ainda não aplicada):

- Estende `integracoes` (não cria tabela paralela): `provider`, `categoria`, `tipo_acesso` ('essential'/'premium'). `codigo` já funcionava como slug.
- Google Drive/Calendar viram `essential` + liberados em todos os planos (inclusive básico, que só tinha Drive antes).
- Estende `workspace_integracoes`: `connected_by`, `credentials_encrypted`, `settings` (jsonb), `last_sync`, status ganha `'erro'`.
- **`REVOKE SELECT (credentials_encrypted)`** de `authenticated`/`anon` — mesmo se algum código pedir `select('*')` por engano, o Postgres recusa devolver essa coluna pro navegador.
- **Remove as policies de INSERT/UPDATE/DELETE de `workspace_integracoes` pra `authenticated`** — antes desta sprint, "conectar" era um `upsert` direto do client (sem credencial real). Agora só rotas de servidor (service_role) escrevem, fechando a brecha de um usuário forjar `status='conectado'` sem OAuth de verdade.
- Nova tabela `workspace_integration_logs` (RLS: mesmo setor `integracoes`, só `SELECT` pra client).
- `has_feature()` recriada (não editada — 040 já está em produção): `'essential'` agora ignora `plano_integracoes` e retorna `true` sempre, pra nunca depender de alguém lembrar de marcar disponível em todo plano novo.

## Tabelas alteradas

`integracoes`, `workspace_integracoes` (ver acima), `plano_integracoes` (Drive/Calendar liberados em todos os planos).

## Serviços/arquivos criados

- `src/lib/crypto/credentials.ts` — AES-256-GCM, chave só em `INTEGRATIONS_ENCRYPTION_KEY` (nunca no banco).
- `src/lib/supabase/requireWorkspaceUser.ts` — contexto de usuário+workspace+`pode()` pras rotas `/api/integrations/*` (mesmo padrão de `requireSaasAdmin.ts`, Sprint 9). Reforça o bloqueio de workspace suspenso/cancelado (essas rotas ficam fora do middleware, igual `/api/webhooks`).
- `src/app/api/integrations/[slug]/{connect,callback,disconnect,status,test}/route.ts`.
- `integracoes-test.mjs` — teste novo (Etapa 9).

## Arquivos modificados

- `src/services/integracoes.service.ts` — `conectarIntegracao`/`desconectarIntegracao` (upsert direto) viraram `urlConectarIntegracao` (navegação) + `desconectarIntegracao`/`testarConexaoIntegracao` (chamam as rotas novas). Nenhum código client toca mais em `credentials_encrypted`.
- `src/components/configuracoes/SetorConfiguracoes.tsx` (`AbaIntegracoes`) — mostra categoria, "Incluso no plano"/"Disponível para upgrade", status com `erro`, botões Conectar/Desconectar/Testar conexão, trata o retorno do OAuth (`?integracao_conectada=`/`?integracao_erro=`).
- `src/types/app.types.ts` — `Integracao`/`IntegracaoComStatus` ganham `provider`, `categoria`, `tipo_acesso`, `temProvider`, `lastSync`; `StatusIntegracao` ganha `'erro'`.
- `src/constants/integracoes.ts` — `INTEGRACOES_COM_PROVIDER` (espelha o registry, só pra UI saber quando desabilitar "Conectar"), `CATEGORIA_LABEL`.
- `src/lib/supabase/middleware.ts` — `/api/integrations` tratada como `/api/webhooks` (rota própria responde JSON, não passa pelo redirect de página).
- `.env.example`, `.env.local`, `backup-manual.mjs`.

## Testes executados

- `npm run build` / `npm run type-check`: **passando**.
- Testes existentes pedidos no ticket — **rodados de verdade, sem regressão**: `security-test.mjs` 14/14, `rbac-test.mjs` 25/25, `rbac-documentos-test.mjs` 22/22.
- `integracoes-test.mjs` (novo): **11/11 passando**, rodado de verdade contra o banco + `npm run dev`. Cobre: `has_feature('google_drive')=true` no plano básico (essential), `has_feature('whatsapp')=false`, bloqueio de leitura de `credentials_encrypted` pelo client (com uma linha REAL na tabela, não uma tabela vazia — ver bug abaixo), outras colunas continuando legíveis, bloqueio de escrita direta em `workspace_integracoes`, isolamento de `workspace_integration_logs` entre workspaces e por RBAC (SDR sem permissão não vê log), e as rotas `/api/integrations/*` recusando requisição sem sessão de navegador.

### 2 bugs reais encontrados e corrigidos durante o teste

1. **Vazamento de coluna (o mais sério)** — `REVOKE SELECT (credentials_encrypted) ... FROM authenticated` (migration 043) **não bloqueou nada**. Testei direto: um usuário autenticado conseguiu ler o valor da coluna normalmente. Causa: o Supabase já concede `GRANT SELECT` na TABELA INTEIRA pro papel `authenticated` por padrão — no Postgres, acesso a uma coluna é permitido se table-level OU column-level autorizar, então revogar só a coluna não anula um grant que já cobre a tabela toda. Descoberto porque o primeiro teste rodou contra uma tabela **vazia** (0 linhas), e `SELECT` sem nenhuma linha visível não gera erro de privilégio — mascarou o problema até eu forçar o teste a rodar contra uma linha real. **Corrigido** na migration `044_fix_credentials_column_privilege.sql`: remove o `GRANT` de tabela inteira e reconcede `SELECT` só nas colunas seguras (padrão documentado do Postgres pra esse cenário). Revalidado: `permission denied for table workspace_integracoes` ao tentar ler a coluna certa, outras colunas continuam acessíveis.
2. **Nome de coluna errado no código** — `saveConnection()` (`integration-provider.ts`) gravava em `connected_at`, coluna que não existe (a coluna real, já existente desde a migration 024, é `conectado_em`). Isso teria feito qualquer tentativa real de conectar Google Drive/Calendar falhar silenciosamente. Corrigido em `saveConnection()` e `clearConnection()`.

## Riscos e lacunas conhecidas

1. **OAuth do Google não testado contra a API real** — não há projeto no Google Cloud Console configurado (`GOOGLE_CLIENT_ID`/`SECRET` ausentes). O fluxo (`connect` → redirect → `callback` → troca de code → `saveConnection`) segue o padrão "Authorization Code" documentado pelo Google, mas só uma configuração real + teste ao vivo confirma. `connect()` lança erro claro enquanto isso não existir.
2. **`sync()` deliberadamente não implementado** em nenhum dos dois providers, conforme pedido no ticket (Etapas 6/7: "não implementar sincronização completa"). Google Calendar também não tem a modelagem de "reunião" ainda — isso é decisão de produto (onde mora a reunião? aba do lead?), fora do escopo desta sprint.
3. **`credentials_encrypted` cifrado com uma chave só** (`INTEGRATIONS_ENCRYPTION_KEY`), sem rotação de chave implementada. Se a chave vazar, toda credencial armazenada precisa ser trocada (reconectar cada workspace) — aceitável pro tamanho atual, mas vale revisitar se a base de clientes crescer.
4. **`INTEGRACOES_COM_PROVIDER`** (`src/constants/integracoes.ts`) precisa ser mantida manualmente em sincronia com o registry de `integration-manager.ts` — são arquivos diferentes porque um é client-safe e o outro é server-only (toca `service_role`). Esquecer de atualizar um dos dois não quebra segurança (a validação real é sempre no backend), só faz o botão "Conectar" aparecer/desaparecer errado na tela.
5. **Sem UI de configuração fina por integração** (campo `settings` existe na tabela, mas nenhuma tela edita isso ainda) — não pedido neste ticket.

## Próxima etapa recomendada

1. Colar a migration `043_integracoes_arquitetura_saas.sql` no SQL Editor do Supabase e rodar `integracoes-test.mjs` pra confirmar de verdade (mesmo processo da Sprint 9).
2. Quando decidirem ativar Google Drive/Calendar pra valer: criar o projeto no Google Cloud Console, configurar OAuth consent screen, preencher `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_OAUTH_REDIRECT_URI` na Vercel, e testar o fluxo de conexão ao vivo com uma conta Google real.
3. Retomar o bug do `/auth/callback` (ainda pausado desde antes da Sprint 9) — continua sendo o item mais urgente fora desta sprint, já que bloqueia a entrada de qualquer cliente novo (pago ou não).
