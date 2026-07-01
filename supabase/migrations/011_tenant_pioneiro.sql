-- 011: Tenant Pioneiro — workspace padrão para dados existentes
--
-- Esta migration faz três coisas em ordem segura:
--   1. Cria o workspace padrão (idempotente via ON CONFLICT)
--   2. Vincula todos os profiles sem workspace ao workspace padrão
--   3. Resolve a dependência circular: adiciona FK owner_id → profiles
--      (só é seguro agora que profiles já tem workspace_id e pode ser populado)
--
-- É segura para re-execução: cada bloco verifica antes de agir.

DO $$
DECLARE
  v_workspace_id UUID;
BEGIN

  -- ── 1. Cria ou localiza o workspace padrão ─────────────────────────────────
  INSERT INTO public.workspaces (nome, tipo_conta, slug, ativo)
  VALUES ('ObraFlow Padrão', 'PJ', 'obraflow-padrao', TRUE)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE slug = 'obraflow-padrao';

  -- ── 2. Vincula todos os profiles sem workspace ao workspace padrão ──────────
  UPDATE public.profiles
  SET workspace_id = v_workspace_id
  WHERE workspace_id IS NULL;

  -- ── 3. Define o dono do workspace (primeiro CEO / Dono cadastrado) ──────────
  --    Só atualiza se owner_id ainda estiver NULL (idempotente).
  UPDATE public.workspaces
  SET owner_id = (
    SELECT id
    FROM public.profiles
    WHERE cargo = 'CEO / Dono'
      AND workspace_id = v_workspace_id
    ORDER BY created_at ASC
    LIMIT 1
  )
  WHERE slug = 'obraflow-padrao'
    AND owner_id IS NULL;

END $$;

-- ── 4. Adiciona FK owner_id → profiles (resolução da dependência circular) ───
--    Seguro agora que os dados já estão populados.
--    ON DELETE SET NULL: se o dono for removido, workspace não é deletado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workspaces_owner_id_fkey'
      AND table_name      = 'workspaces'
      AND table_schema    = 'public'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_owner_id_fkey
      FOREIGN KEY (owner_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;
