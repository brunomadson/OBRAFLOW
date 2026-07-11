-- 029: Corrige (de vez) o bootstrapping de RLS em cargos durante o onboarding
--
-- A correção da migration 028 não resolveu: a policy criada lá consulta
-- public.workspaces dentro do USING de outra policy — mas workspaces também
-- tem RLS (policy "id = get_my_workspace_id()"), e nesse instante do
-- onboarding o profile.workspace_id do usuário ainda é NULL, então a
-- subquery contra workspaces também vem vazia por RLS (não por falta de
-- owner_id correto). Confirmado com teste real: onboarding ainda falhava no
-- passo 2 (select do cargo CEO) depois da 028.
--
-- Fix de verdade: função SECURITY DEFINER (mesmo padrão de
-- get_my_workspace_id()) que checa owner_id ignorando RLS de workspaces.

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "cargos_select" ON public.cargos;

CREATE POLICY "cargos_select" ON public.cargos
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    OR public.is_workspace_owner(workspace_id)
  );
