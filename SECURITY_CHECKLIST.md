# SECURITY_CHECKLIST.md — ObraFlow

Checklist de referência antes de aceitar o primeiro cliente pagante externo.
Atualizar este arquivo sempre que um item mudar de estado — ele é a fonte de
verdade de segurança do projeto, não um documento de uma vez só.

## Autenticação

- [x] JWT validado — todo `auth.uid()` usado em RLS vem de um JWT emitido pelo Supabase Auth
- [x] Login (e-mail/senha) funcional
- [x] Convite de membro funcional (magic link + trigger aplica cargo/setores)
- [x] Recuperação de senha testada ponta a ponta — achado e corrigido bug real: `/reset-password` não estava na lista de rotas públicas do `middleware.ts`, então o middleware redirecionava pro `/login` no servidor antes do token de recuperação (que vem depois do `#`, nunca chega ao servidor) ser processado pelo navegador. Ninguém conseguia usar o link de recuperação. Testado com link real gerado via API do Supabase (2026-07-11)

## Banco

- [x] RLS ativo nas 20 tabelas do schema
- [x] Isolamento por `workspace_id` validado entre dois workspaces reais (Sprint anterior)
- [x] Tabelas-filho sem `workspace_id` próprio (`lead_log`, `obra_log`, `medicoes`) verificadas via subquery contra a tabela pai
- [x] Teste automatizado de isolamento (`security-test.mjs`, `npm run security-test`) — cria 2 workspaces/usuários descartáveis, confirma que um não lê/apaga leads, obras, lançamentos nem arquivos do outro, e limpa tudo sozinho. Roda com segurança contra produção porque só toca dado que ele mesmo cria. 14/14 checagens passando (2026-07-11)
- [x] RBAC por cargo/setor implementado de verdade em RLS (migrations 027–032): tabela `cargos` (6 cargos padrão por workspace + customizados pelo CEO), `permissoes_cargo` (matriz visualizar/criar/editar/excluir × comercial/obras/financeiro/alertas/configurações), função `has_permission()`, RLS de `leads/lead_log/obras/obra_log/medicoes/lancamentos` exigindo permissão real além de `workspace_id`. Teste automatizado por cargo (`rbac-test.mjs`, `npm run rbac-test`) — 25/25 checagens passando (2026-07-11), inclusive a regra "Gerente não exclui lançamento" e "Estagiário/Engenheiro não excluem obra"

## Storage

- [x] Bucket `documentos` confirmado como privado (`public: false`)
- [x] Migration `025_storage_documentos_rls.sql` aplicada — policies de select/insert/update/delete por workspace
- [x] Migration `026_remove_old_permissive_storage_policies.sql` aplicada — removeu 3 policies antigas (`documentos_select`/`_delete`/`_upload`) criadas manualmente no Dashboard que liberavam o bucket inteiro sem checar workspace. Sem essa remoção, a 025 sozinha não tinha efeito (RLS combina policies PERMISSIVE com OR)
- [x] Upload testado com usuário autenticado real — funciona no próprio workspace
- [x] Download (signed URL) testado com usuário autenticado real — funciona no próprio workspace
- [x] Confirmado com usuário autenticado real que workspace A **não** acessa arquivo de workspace B (testado após a 026 — antes dela, o acesso vazava)

## Código

- [x] Nenhuma chave secreta hardcoded em nenhum arquivo de código (`.mjs`, `.ts`, `.tsx`) — confirmado por busca no repositório inteiro
- [x] `service_role` nunca referenciada em `src/` (frontend) — confirmado
- [x] Scripts locais (`seed-*.mjs`, `check-schema.mjs`, `run-migration.mjs`, `add-cor.mjs`, `reset-teste-demo.mjs`) migrados para ler a chave de variável de ambiente via `supabase-admin.mjs`
- [x] Chave antiga rotacionada no Supabase Dashboard — `service_role`/`anon` antigos (legacy JWT) desabilitados, novas chaves `sb_secret_.../sb_publishable_...` em uso

## Deploy

- [x] Variáveis de ambiente confirmadas na Vercel (Production) — `NEXT_PUBLIC_SUPABASE_ANON_KEY` atualizada pro novo formato, redeploy confirmado funcionando
- [x] Variáveis antigas removidas da Vercel — `SUPABASE_SERVICE_ROLE_KEY` (não usada no client, só scripts locais) deletada
- [x] `.env.local` confirmado fora do git (`git ls-files | grep .env` vazio — já confirmado nesta sessão)
