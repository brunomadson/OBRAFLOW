-- 055: Sprint 13.5 — Financeiro de Serviços Técnicos + Comissão
--
-- Reaproveita `lancamentos` (mesma engine do Financeiro de Obras) em vez de
-- criar uma tabela paralela — só um `servico_id` nullable, irmão de
-- `obra_id`, com CHECK garantindo que nunca os dois estejam preenchidos ao
-- mesmo tempo na mesma linha (uma linha é de Obras OU de Serviços Técnicos,
-- nunca as duas — general/administrativo continua sendo os dois NULL, como
-- já era antes pro "Sem obra").
--
-- RLS troca de "só has_permission('financeiro', ação)" pra um branch por
-- domínio, mesmo padrão de documentos/historico (054): linha de serviço
-- exige permissão de servicos-tecnicos, linha de obra (ou geral) continua
-- exigindo financeiro — reforça a separação estrita no nível do banco, não
-- só nas telas. Confirmado com o usuário: reaproveitar estrutura não pode
-- significar números somados.

-- ── 1. lancamentos.servico_id ─────────────────────────────────────────────────

alter table public.lancamentos
  add column if not exists servico_id uuid references public.servicos(id) on delete cascade;

alter table public.lancamentos
  drop constraint if exists lancamentos_obra_ou_servico_check;
alter table public.lancamentos
  add constraint lancamentos_obra_ou_servico_check
  check (not (obra_id is not null and servico_id is not null));

-- ── 2. RLS por domínio ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "lancamentos_select" ON public.lancamentos;
CREATE POLICY "lancamentos_select" ON public.lancamentos
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND (
      (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'visualizar'))
      OR (servico_id IS NULL AND public.has_permission('financeiro', 'visualizar'))
    )
  );

DROP POLICY IF EXISTS "lancamentos_insert" ON public.lancamentos;
CREATE POLICY "lancamentos_insert" ON public.lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND (
      (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'criar'))
      OR (servico_id IS NULL AND public.has_permission('financeiro', 'criar'))
    )
  );

DROP POLICY IF EXISTS "lancamentos_update" ON public.lancamentos;
CREATE POLICY "lancamentos_update" ON public.lancamentos
  FOR UPDATE TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND (
      (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'editar'))
      OR (servico_id IS NULL AND public.has_permission('financeiro', 'editar'))
    )
  )
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND (
      (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'editar'))
      OR (servico_id IS NULL AND public.has_permission('financeiro', 'editar'))
    )
  );

DROP POLICY IF EXISTS "lancamentos_delete" ON public.lancamentos;
CREATE POLICY "lancamentos_delete" ON public.lancamentos
  FOR DELETE TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND (
      (servico_id IS NOT NULL AND public.has_permission('servicos-tecnicos', 'excluir'))
      OR (servico_id IS NULL AND public.has_permission('financeiro', 'excluir'))
    )
  );
