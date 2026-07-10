-- 021: Corrige constraint UNIQUE de cidades.nome para ser por workspace
--
-- A tabela cidades foi criada antes do multi-tenant (com "nome TEXT UNIQUE"
-- global). A migration 014 adicionou workspace_id, mas nunca trocou essa
-- constraint — resultado: dois workspaces não podem ter uma cidade com o
-- mesmo nome (ex: "Pedreiras"), mesmo sendo tenants isolados.

ALTER TABLE public.cidades DROP CONSTRAINT IF EXISTS cidades_nome_key;

ALTER TABLE public.cidades
  ADD CONSTRAINT cidades_workspace_nome_key UNIQUE (workspace_id, nome);
