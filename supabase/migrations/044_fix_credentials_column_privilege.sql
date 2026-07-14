-- 044: corrige vazamento real achado testando a migration 043 ao vivo
--
-- `REVOKE SELECT (credentials_encrypted) ON workspace_integracoes FROM
-- authenticated` (043) NÃO bloqueou a leitura — confirmado com um teste
-- real: um usuário autenticado conseguiu ler o valor da coluna
-- normalmente. Causa: o Postgres já concede SELECT em TODAS as colunas de
-- workspace_integracoes pro papel "authenticated" via GRANT de nível de
-- TABELA (configuração padrão do Supabase, `GRANT ALL ON ALL TABLES IN
-- SCHEMA public TO authenticated`). Acesso a uma coluna é permitido se
-- table-level OU column-level autorizar — revogar só no nível de coluna
-- não anula um GRANT que já existe no nível da tabela inteira.
--
-- Correção correta (padrão documentado do Postgres pra restringir 1
-- coluna sensível numa tabela que já tem GRANT de tabela inteira):
--   1. Remove o GRANT de tabela inteira pra "authenticated".
--   2. Concede SELECT explicitamente só nas colunas seguras.
-- RLS (row-level) continua idêntico, não foi tocado — isso é só sobre
-- COLUNA, não sobre QUAL LINHA.

REVOKE SELECT ON public.workspace_integracoes FROM authenticated, anon;

GRANT SELECT (
  id, workspace_id, integracao_id, status, conectado_em,
  created_at, updated_at, connected_by, settings, last_sync
) ON public.workspace_integracoes TO authenticated;

-- INSERT/UPDATE/DELETE de "authenticated" já foram removidos na 043 (só
-- SELECT é concedido a esse papel nesta tabela) — sem GRANT de escrita
-- nenhum aqui, de propósito.
