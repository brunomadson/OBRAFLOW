# SECURITY_CHECKLIST.md — ObraFlow

Checklist de referência antes de aceitar o primeiro cliente pagante externo.
Atualizar este arquivo sempre que um item mudar de estado — ele é a fonte de
verdade de segurança do projeto, não um documento de uma vez só.

## Autenticação

- [x] JWT validado — todo `auth.uid()` usado em RLS vem de um JWT emitido pelo Supabase Auth
- [x] Login (e-mail/senha) funcional
- [x] Convite de membro funcional (magic link + trigger aplica cargo/setores)
- [ ] Recuperação de senha testada ponta a ponta (rota existe, fluxo completo de e-mail não foi testado nesta sessão)

## Banco

- [x] RLS ativo nas 20 tabelas do schema
- [x] Isolamento por `workspace_id` validado entre dois workspaces reais (Sprint anterior)
- [x] Tabelas-filho sem `workspace_id` próprio (`lead_log`, `obra_log`, `medicoes`) verificadas via subquery contra a tabela pai
- [x] Teste automatizado de isolamento (`security-test.mjs`, `npm run security-test`) — cria 2 workspaces/usuários descartáveis, confirma que um não lê/apaga leads, obras, lançamentos nem arquivos do outro, e limpa tudo sozinho. Roda com segurança contra produção porque só toca dado que ele mesmo cria. 14/14 checagens passando (2026-07-11)
- [ ] RBAC por cargo/setor **não existe em nenhuma policy** — hoje é só filtro de interface. Fora do escopo deste Sprint 0 (ver relatório da auditoria anterior)

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
- [ ] Chave antiga rotacionada no Supabase Dashboard (a chave que esteve exposta no histórico do git continua válida até isso ser feito manualmente — ver checklist de rotação no relatório do Sprint 0)

## Deploy

- [ ] Variáveis de ambiente confirmadas na Vercel (Production) — não verificável nesta sessão, sem acesso ao dashboard
- [ ] Variáveis antigas (se houver) removidas da Vercel após a rotação da chave
- [ ] `.env.local` confirmado fora do git (`git ls-files | grep .env` vazio — já confirmado nesta sessão)
