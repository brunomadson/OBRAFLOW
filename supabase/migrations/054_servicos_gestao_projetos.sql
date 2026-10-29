-- 054: Sprint 13.4 — Gestão de Projetos de Serviços Técnicos
--
-- Reaproveita documentos/historico em vez de criar tabelas paralelas (mesmo
-- princípio de leads/obras) — só adiciona servico_id nullable nas duas,
-- mesmo padrão que lead_id/obra_id já usam lá.
--
-- catalogo_servicos.tarefas_padrao é o checklist-modelo por tipo de serviço
-- (ex: "Projeto Arquitetônico" → Levantamento, Anteprojeto, Aprovação...).
-- servicos.tarefas (já existe desde a 053) é a cópia editável por serviço —
-- Tarefas e Cronograma (Sprint 13.4) leem essa mesma coluna, duas
-- renderizações da mesma lista, sem duplicar dado.

-- ── 1. catalogo_servicos.tarefas_padrao ───────────────────────────────────────

alter table public.catalogo_servicos
  add column if not exists tarefas_padrao jsonb not null default '[]'::jsonb;

-- ── 2. documentos.servico_id ──────────────────────────────────────────────────

alter table public.documentos
  add column if not exists servico_id uuid references public.servicos(id) on delete cascade;

DROP POLICY IF EXISTS "documentos_select" ON public.documentos;
CREATE POLICY "documentos_select" ON public.documentos
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'visualizar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'visualizar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'visualizar'))
      OR (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'visualizar'))
    )
  );

DROP POLICY IF EXISTS "documentos_insert" ON public.documentos;
CREATE POLICY "documentos_insert" ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'criar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'criar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'criar'))
      OR (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'criar'))
    )
  );

DROP POLICY IF EXISTS "documentos_update" ON public.documentos;
CREATE POLICY "documentos_update" ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'editar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'editar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'editar'))
      OR (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'editar'))
    )
    AND (usuario_id = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
  )
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'editar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'editar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'editar'))
      OR (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'editar'))
    )
    AND (usuario_id = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
  );

-- documentos_delete (só documentos.excluir, sem branch de domínio) continua igual.

-- ── 3. historico.servico_id + novo tipo ───────────────────────────────────────

alter table public.historico
  add column if not exists servico_id uuid references public.servicos(id) on delete cascade;

ALTER TABLE public.historico DROP CONSTRAINT IF EXISTS historico_tipo_check;
ALTER TABLE public.historico ADD CONSTRAINT historico_tipo_check
  CHECK (tipo IN ('lead','comercial','obras','documento','medicao','sistema','servico_tecnico'));

DROP POLICY IF EXISTS "historico_select" ON public.historico;
CREATE POLICY "historico_select" ON public.historico
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'visualizar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'visualizar'))
      OR (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'visualizar'))
      OR (lead_id IS NULL AND obra_id IS NULL AND servico_id IS NULL AND public.has_permission('configuracoes', 'visualizar'))
    )
  );

DROP POLICY IF EXISTS "historico_insert" ON public.historico;
CREATE POLICY "historico_insert" ON public.historico
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'visualizar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'visualizar'))
      OR (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'visualizar'))
      OR (lead_id IS NULL AND obra_id IS NULL AND servico_id IS NULL AND public.has_permission('configuracoes', 'visualizar'))
    )
  );

-- historico_delete (só configuracoes.excluir) continua igual, sem branch de domínio.
