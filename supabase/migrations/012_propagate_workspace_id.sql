-- 012: Propagação do workspace_id nas tabelas principais
--
-- Adiciona workspace_id (NULLABLE) em leads, obras, lancamentos,
-- documentos e historico, e preenche todos os registros existentes
-- com o workspace padrão criado na migration 011.
--
-- REGRAS:
--   ① workspace_id permanece NULLABLE — sem quebrar o sistema atual.
--   ② Todos os registros existentes recebem o workspace padrão.
--   ③ RLS continua using(true) — isolamento real vem na Sprint 3.
--   ④ Safe para re-execução: ADD COLUMN IF NOT EXISTS + UPDATE WHERE NULL.

-- ── DDL: Adiciona colunas (IF NOT EXISTS garante idempotência) ────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.historico
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- ── DML: Backfill — preenche registros existentes com o workspace padrão ──────

DO $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE slug = 'obraflow-padrao';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace padrão não encontrado. Execute a migration 011 primeiro.';
  END IF;

  UPDATE public.leads       SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.obras       SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.lancamentos SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.documentos  SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.historico   SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;

  RAISE NOTICE 'Backfill concluído para workspace_id = %', v_workspace_id;
END $$;

-- ── Índices: aceleram as queries de isolamento que virão na Sprint 3 ──────────

CREATE INDEX IF NOT EXISTS idx_leads_workspace_id
  ON public.leads(workspace_id)       WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obras_workspace_id
  ON public.obras(workspace_id)       WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_workspace_id
  ON public.lancamentos(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_workspace_id
  ON public.documentos(workspace_id)  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_historico_workspace_id
  ON public.historico(workspace_id)   WHERE workspace_id IS NOT NULL;
