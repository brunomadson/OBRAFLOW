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
- [ ] RBAC por cargo/setor **não existe em nenhuma policy** — hoje é só filtro de interface. Fora do escopo deste Sprint 0 (ver relatório da auditoria anterior)

## Storage

- [x] Bucket `documentos` confirmado como privado (`public: false`)
- [x] Migration `025_storage_documentos_rls.sql` criada com policies de select/insert/update/delete por workspace
- [ ] Migration aplicada no Supabase (pendente — rodar no SQL Editor)
- [ ] Upload testado após aplicar a migration
- [ ] Download (signed URL) testado após aplicar a migration
- [ ] Confirmado que um usuário de outro workspace não acessa arquivo alheio

## Código

- [x] Nenhuma chave secreta hardcoded em nenhum arquivo de código (`.mjs`, `.ts`, `.tsx`) — confirmado por busca no repositório inteiro
- [x] `service_role` nunca referenciada em `src/` (frontend) — confirmado
- [x] Scripts locais (`seed-*.mjs`, `check-schema.mjs`, `run-migration.mjs`, `add-cor.mjs`, `reset-teste-demo.mjs`) migrados para ler a chave de variável de ambiente via `supabase-admin.mjs`
- [ ] Chave antiga rotacionada no Supabase Dashboard (a chave que esteve exposta no histórico do git continua válida até isso ser feito manualmente — ver checklist de rotação no relatório do Sprint 0)

## Deploy

- [ ] Variáveis de ambiente confirmadas na Vercel (Production) — não verificável nesta sessão, sem acesso ao dashboard
- [ ] Variáveis antigas (se houver) removidas da Vercel após a rotação da chave
- [ ] `.env.local` confirmado fora do git (`git ls-files | grep .env` vazio — já confirmado nesta sessão)
