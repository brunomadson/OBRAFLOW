-- 015: Isolamento real por workspace — substituição de todas as policies
--
-- ANTES: using(true) → qualquer usuário autenticado vê TUDO
-- DEPOIS: workspace_id = get_my_workspace_id() → usuário só vê dados do SEU workspace
--
-- Ordem de execução:
--   1. DROP das policies antigas (using(true))
--   2. CREATE das novas policies por workspace
--
-- TABELAS COM workspace_id DIRETO:
--   leads, obras, lancamentos, documentos, historico,
--   cidades, corretores, correspondentes, config,
--   workspaces, profiles
--
-- TABELAS FILHO (sem workspace_id, checam via FK do pai):
--   lead_log   → via leads.workspace_id
--   obra_log   → via obras.workspace_id
--   medicoes   → via obras.workspace_id
--
-- NOTA: lead_log e obra_log têm INSERTs feitos por triggers SECURITY DEFINER
-- que bypassam RLS. O SELECT ainda é protegido pela policy abaixo.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. WORKSPACES
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "workspaces_authenticated" ON public.workspaces;

-- Lê apenas o próprio workspace
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT TO authenticated
  USING (id = public.get_my_workspace_id());

-- Permite criar workspace (necessário para onboarding de novos tenants)
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Atualiza apenas o próprio workspace
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (id = public.get_my_workspace_id())
  WITH CHECK (id = public.get_my_workspace_id());

-- DELETE negado por omissão (nenhuma policy = negado)

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. PROFILES
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "profiles_select"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Vê apenas profiles do mesmo workspace (necessário para selects de responsável, etc.)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id());

-- Atualiza apenas o próprio perfil
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. LEADS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "leads_all" ON public.leads;

CREATE POLICY "leads_workspace" ON public.leads
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. LEAD_LOG (filho de leads — sem workspace_id próprio)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "lead_log_all" ON public.lead_log;

CREATE POLICY "lead_log_workspace" ON public.lead_log
  FOR ALL TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE workspace_id = public.get_my_workspace_id()
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE workspace_id = public.get_my_workspace_id()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. CORRESPONDENTES
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "correspondentes_all" ON public.correspondentes;

CREATE POLICY "correspondentes_workspace" ON public.correspondentes
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. OBRAS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "obras_all" ON public.obras;

CREATE POLICY "obras_workspace" ON public.obras
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. OBRA_LOG (filho de obras)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "obra_log_all" ON public.obra_log;

CREATE POLICY "obra_log_workspace" ON public.obra_log
  FOR ALL TO authenticated
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE workspace_id = public.get_my_workspace_id()
    )
  )
  WITH CHECK (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE workspace_id = public.get_my_workspace_id()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. MEDICOES (filho de obras)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "medicoes_auth"       ON public.medicoes;
DROP POLICY IF EXISTS "medicoes_all"        ON public.medicoes;
DROP POLICY IF EXISTS "medicoes_workspace"  ON public.medicoes;

CREATE POLICY "medicoes_workspace" ON public.medicoes
  FOR ALL TO authenticated
  USING (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE workspace_id = public.get_my_workspace_id()
    )
  )
  WITH CHECK (
    obra_id IN (
      SELECT id FROM public.obras
      WHERE workspace_id = public.get_my_workspace_id()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. LANCAMENTOS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "lancamentos_all" ON public.lancamentos;

CREATE POLICY "lancamentos_workspace" ON public.lancamentos
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. CONFIG
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "config_select" ON public.config;
DROP POLICY IF EXISTS "config_insert" ON public.config;
DROP POLICY IF EXISTS "config_update" ON public.config;

CREATE POLICY "config_workspace" ON public.config
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. CIDADES
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "cidades_auth"      ON public.cidades;
DROP POLICY IF EXISTS "cidades_workspace" ON public.cidades;

CREATE POLICY "cidades_workspace" ON public.cidades
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. CORRETORES
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "corretores_auth"      ON public.corretores;
DROP POLICY IF EXISTS "corretores_workspace" ON public.corretores;

CREATE POLICY "corretores_workspace" ON public.corretores
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. DOCUMENTOS
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "documentos_auth"      ON public.documentos;
DROP POLICY IF EXISTS "documentos_workspace" ON public.documentos;

CREATE POLICY "documentos_workspace" ON public.documentos
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. HISTORICO
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "historico_authenticated" ON public.historico;
DROP POLICY IF EXISTS "historico_workspace"     ON public.historico;

CREATE POLICY "historico_workspace" ON public.historico
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL (descomente para testar manualmente no SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE '%workspace%'
-- ORDER BY tablename, cmd;
--
-- SELECT public.get_my_workspace_id();   -- deve retornar seu workspace UUID
