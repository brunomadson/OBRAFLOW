-- 014: workspace_id em cidades, corretores, correspondentes e config
--
-- Estas 4 tabelas foram criadas antes do conceito de workspace existir
-- e precisam ser alinhadas para o isolamento da Sprint 3.
--
-- Estratégia:
--   ① CREATE TABLE IF NOT EXISTS (cidades, corretores podem não ter migration)
--   ② ADD COLUMN IF NOT EXISTS workspace_id em todas
--   ③ Backfill com workspace padrão (slug = 'obraflow-padrao')
--   ④ Triggers de auto-preenchimento na inserção
--
-- Safe para re-execução: todos os comandos são idempotentes.

-- ── 1. Cidades ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cidades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cidades ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cidades
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cidades_workspace_id
  ON public.cidades(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE OR REPLACE TRIGGER cidades_auto_workspace
  BEFORE INSERT ON public.cidades
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

-- ── 2. Corretores ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.corretores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  telefone   TEXT,
  email      TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.corretores ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.corretores
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_corretores_workspace_id
  ON public.corretores(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE OR REPLACE TRIGGER corretores_auto_workspace
  BEFORE INSERT ON public.corretores
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

-- ── 3. Correspondentes ────────────────────────────────────────────────────────

ALTER TABLE public.correspondentes
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_correspondentes_workspace_id
  ON public.correspondentes(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE OR REPLACE TRIGGER correspondentes_auto_workspace
  BEFORE INSERT ON public.correspondentes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

-- ── 4. Config ─────────────────────────────────────────────────────────────────

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS workspace_id UUID
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_config_workspace_id
  ON public.config(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE OR REPLACE TRIGGER config_auto_workspace
  BEFORE INSERT ON public.config
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

-- ── 5. Backfill — atribui workspace padrão a todos os registros existentes ───

DO $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE slug = 'obraflow-padrao';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace padrão não encontrado. Execute as migrations 011-012 primeiro.';
  END IF;

  UPDATE public.cidades        SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.corretores     SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.correspondentes SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.config         SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;

  RAISE NOTICE 'Backfill concluído para workspace_id = %', v_workspace_id;
END $$;
