-- 030: Fase 2 do RBAC — RLS de verdade em leads/obras/lançamentos
--
-- Até aqui (027/028/029) só existia a fundação: cargos, matriz de permissão
-- e has_permission(). As tabelas de negócio ainda usavam só isolamento por
-- workspace_id, sem checar cargo nenhum. Esta migration troca a policy
-- única "FOR ALL" de cada tabela por 4 policies (SELECT/INSERT/UPDATE/
-- DELETE), cada uma exigindo workspace_id correto E has_permission(setor,
-- ação) — setor mapeado assim: leads/lead_log → comercial,
-- obras/obra_log/medicoes → obras, lancamentos → financeiro.
--
-- lead_log/obra_log/medicoes (tabelas filho, sem workspace_id próprio) usam
-- has_permission(setor,'editar') tanto pra INSERT quanto UPDATE — são
-- sempre um efeito colateral de editar o registro pai (mudança de etapa,
-- lançamento de medição), e na matriz padrão todo cargo que tem 'criar'
-- também tem 'editar' no mesmo setor, então isso não bloqueia nenhum fluxo
-- hoje existente. DELETE nessas tabelas filho não é usado pela aplicação
-- (a limpeza acontece via ON DELETE CASCADE quando o pai é apagado, que não
-- passa pela RLS do filho), mas a policy é criada por completude/defesa em
-- profundidade.

-- ── LEADS (setor: comercial) ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "leads_workspace" ON public.leads;

CREATE POLICY "leads_select" ON public.leads
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('comercial', 'visualizar'));

CREATE POLICY "leads_insert" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('comercial', 'criar'));

CREATE POLICY "leads_update" ON public.leads
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('comercial', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('comercial', 'editar'));

CREATE POLICY "leads_delete" ON public.leads
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('comercial', 'excluir'));

-- ── LEAD_LOG (filho de leads, setor: comercial) ──────────────────────────────

DROP POLICY IF EXISTS "lead_log_workspace" ON public.lead_log;

CREATE POLICY "lead_log_select" ON public.lead_log
  FOR SELECT TO authenticated
  USING (
    public.has_permission('comercial', 'visualizar')
    AND lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "lead_log_insert" ON public.lead_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('comercial', 'editar')
    AND lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "lead_log_update" ON public.lead_log
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('comercial', 'editar')
    AND lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.get_my_workspace_id())
  )
  WITH CHECK (
    public.has_permission('comercial', 'editar')
    AND lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "lead_log_delete" ON public.lead_log
  FOR DELETE TO authenticated
  USING (
    public.has_permission('comercial', 'excluir')
    AND lead_id IN (SELECT id FROM public.leads WHERE workspace_id = public.get_my_workspace_id())
  );

-- ── OBRAS (setor: obras) ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "obras_workspace" ON public.obras;

CREATE POLICY "obras_select" ON public.obras
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('obras', 'visualizar'));

CREATE POLICY "obras_insert" ON public.obras
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('obras', 'criar'));

CREATE POLICY "obras_update" ON public.obras
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('obras', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('obras', 'editar'));

CREATE POLICY "obras_delete" ON public.obras
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('obras', 'excluir'));

-- ── OBRA_LOG (filho de obras, setor: obras) ──────────────────────────────────

DROP POLICY IF EXISTS "obra_log_workspace" ON public.obra_log;

CREATE POLICY "obra_log_select" ON public.obra_log
  FOR SELECT TO authenticated
  USING (
    public.has_permission('obras', 'visualizar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "obra_log_insert" ON public.obra_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('obras', 'editar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "obra_log_update" ON public.obra_log
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('obras', 'editar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  )
  WITH CHECK (
    public.has_permission('obras', 'editar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "obra_log_delete" ON public.obra_log
  FOR DELETE TO authenticated
  USING (
    public.has_permission('obras', 'excluir')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

-- ── MEDICOES (filho de obras, setor: obras) ──────────────────────────────────

DROP POLICY IF EXISTS "medicoes_workspace" ON public.medicoes;

CREATE POLICY "medicoes_select" ON public.medicoes
  FOR SELECT TO authenticated
  USING (
    public.has_permission('obras', 'visualizar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "medicoes_insert" ON public.medicoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('obras', 'editar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "medicoes_update" ON public.medicoes
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('obras', 'editar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  )
  WITH CHECK (
    public.has_permission('obras', 'editar')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

CREATE POLICY "medicoes_delete" ON public.medicoes
  FOR DELETE TO authenticated
  USING (
    public.has_permission('obras', 'excluir')
    AND obra_id IN (SELECT id FROM public.obras WHERE workspace_id = public.get_my_workspace_id())
  );

-- ── LANCAMENTOS (setor: financeiro) ───────────────────────────────────────────

DROP POLICY IF EXISTS "lancamentos_workspace" ON public.lancamentos;

CREATE POLICY "lancamentos_select" ON public.lancamentos
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('financeiro', 'visualizar'));

CREATE POLICY "lancamentos_insert" ON public.lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('financeiro', 'criar'));

CREATE POLICY "lancamentos_update" ON public.lancamentos
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('financeiro', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('financeiro', 'editar'));

CREATE POLICY "lancamentos_delete" ON public.lancamentos
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('financeiro', 'excluir'));
