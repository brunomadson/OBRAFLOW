-- 034: Completa a migration 033, que rodou só parcialmente
--
-- Diagnóstico (via SELECT em pg_policies, colado pelo usuário): a 033 parou
-- de executar logo depois de criar "metas_dashboard_select" — "config"
-- ficou 100% correto (as 4 policies novas existem, a antiga sumiu), mas
-- metas_dashboard só ganhou a policy de SELECT (insert/update/delete
-- nunca foram criadas — por isso RLS negava até o Gerente editar meta,
-- já que sem NENHUMA policy de UPDATE o Postgres nega por padrão), e
-- workspace_invites/workspace_integracoes nem chegaram a ter a policy
-- antiga (FOR ALL, só workspace_id) removida — por isso Estagiário
-- conseguia criar convite e Engenheiro conseguia editar integração.
--
-- has_permission() foi confirmado correto via RPC direta pros 3 casos
-- (retornou exatamente o valor esperado sempre) — o problema era 100% na
-- aplicação das policies, não na lógica de permissão.
--
-- Todos os DROP/CREATE abaixo são idempotentes (IF EXISTS / nomes que
-- ainda não existem), seguro rodar de novo se travar no meio outra vez.

-- ── metas_dashboard — faltavam insert/update/delete ──────────────────────────

DROP POLICY IF EXISTS "metas_dashboard_insert" ON public.metas_dashboard;
CREATE POLICY "metas_dashboard_insert" ON public.metas_dashboard
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'criar'));

DROP POLICY IF EXISTS "metas_dashboard_update" ON public.metas_dashboard;
CREATE POLICY "metas_dashboard_update" ON public.metas_dashboard
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'editar'));

DROP POLICY IF EXISTS "metas_dashboard_delete" ON public.metas_dashboard;
CREATE POLICY "metas_dashboard_delete" ON public.metas_dashboard
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'excluir'));

-- ── workspace_invites — policy antiga nunca foi removida, novas nunca criadas ─

DROP POLICY IF EXISTS "invites_workspace" ON public.workspace_invites;

DROP POLICY IF EXISTS "workspace_invites_select" ON public.workspace_invites;
CREATE POLICY "workspace_invites_select" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'visualizar'));

DROP POLICY IF EXISTS "workspace_invites_insert" ON public.workspace_invites;
CREATE POLICY "workspace_invites_insert" ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'criar'));

DROP POLICY IF EXISTS "workspace_invites_update" ON public.workspace_invites;
CREATE POLICY "workspace_invites_update" ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'editar'));

DROP POLICY IF EXISTS "workspace_invites_delete" ON public.workspace_invites;
CREATE POLICY "workspace_invites_delete" ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'excluir'));

-- ── workspace_integracoes — mesma situação ────────────────────────────────────

DROP POLICY IF EXISTS "workspace_integracoes_workspace" ON public.workspace_integracoes;

DROP POLICY IF EXISTS "workspace_integracoes_select" ON public.workspace_integracoes;
CREATE POLICY "workspace_integracoes_select" ON public.workspace_integracoes
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'visualizar'));

DROP POLICY IF EXISTS "workspace_integracoes_insert" ON public.workspace_integracoes;
CREATE POLICY "workspace_integracoes_insert" ON public.workspace_integracoes
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'criar'));

DROP POLICY IF EXISTS "workspace_integracoes_update" ON public.workspace_integracoes;
CREATE POLICY "workspace_integracoes_update" ON public.workspace_integracoes
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'editar'));

DROP POLICY IF EXISTS "workspace_integracoes_delete" ON public.workspace_integracoes;
CREATE POLICY "workspace_integracoes_delete" ON public.workspace_integracoes
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'excluir'));
