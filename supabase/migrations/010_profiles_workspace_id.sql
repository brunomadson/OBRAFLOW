-- 010: Vincula profiles a workspaces
--
-- Adiciona workspace_id na tabela profiles estabelecendo qual workspace
-- (tenant) cada usuário pertence.
--
-- REGRAS DE ROLLOUT INCREMENTAL:
--   ① Adicionamos a coluna como NULLABLE agora.
--      → Todos os usuários existentes ficam com workspace_id = NULL.
--      → Nenhuma quebra de compatibilidade. Sistema continua funcionando.
--
--   ② Sprint 2.2 criará o workspace pioneiro e atualizará todos os
--      profiles existentes com o workspace_id correto via script SQL.
--
--   ③ Sprint 3 tornará workspace_id NOT NULL e ativará RLS real.
--
-- NÃO tornar NOT NULL aqui. O sistema tem usuários sem workspace ainda.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Índice para acelerar a query mais frequente futuramente:
-- SELECT * FROM profiles WHERE workspace_id = $1
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id
  ON public.profiles(workspace_id)
  WHERE workspace_id IS NOT NULL;
