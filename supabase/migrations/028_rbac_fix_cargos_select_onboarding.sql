-- 028: Corrige bootstrapping de RLS em cargos durante o onboarding
--
-- workspaces.service.ts (fluxo de onboarding) cria o workspace, o que
-- dispara o trigger workspaces_seed_cargos e já semeia os 6 cargos padrão —
-- mas na sequência, quando o app tenta ler o id do cargo "CEO / Dono" recém-
-- criado pra atribuir ao próprio perfil, profiles.workspace_id do usuário
-- AINDA é NULL (só é atualizado no passo seguinte). A policy cargos_select
-- (workspace_id = get_my_workspace_id()) bloqueia essa leitura, porque
-- get_my_workspace_id() ainda retorna NULL nesse instante — quebra o
-- onboarding de todo usuário novo.
--
-- Mesmo problema de "ovo e galinha" que já existia pra workspaces (por isso
-- workspaces.service.ts gera o UUID no client e evita reler o workspace
-- depois de inserir — ver comentário lá). Aqui a correção é simples: também
-- permite enxergar cargos de um workspace do qual o usuário é owner, mesmo
-- antes do profile.workspace_id estar setado.

DROP POLICY IF EXISTS "cargos_select" ON public.cargos;

CREATE POLICY "cargos_select" ON public.cargos
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  );
