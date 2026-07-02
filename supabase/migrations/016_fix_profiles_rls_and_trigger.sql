-- 016: Corrige policy de profiles e trigger de novo usuário
--
-- PROBLEMA 1: profiles_select com USING (workspace_id = get_my_workspace_id())
--   cria uma dependência circular: para ler o profile é preciso saber o
--   workspace_id, que só existe no profile. Se workspace_id = NULL, o usuário
--   não consegue ler nem o próprio perfil → AuthContext retorna null → sem abas.
--
-- FIX: adiciona cláusula OR id = auth.uid() para que o usuário sempre
--   consiga ler o próprio perfil, independente do workspace_id.
--
-- PROBLEMA 2: handle_new_user cria profile sem workspace_id.
--   Todo usuário criado após a migration 011 fica com workspace_id = NULL.
--
-- FIX: atualiza o trigger para auto-atribuir o workspace padrão.
--
-- PROBLEMA 3: perfis existentes com workspace_id = NULL.
--   Backfill imediato.

-- ── 1. Corrige policy de SELECT em profiles ───────────────────────────────────

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                                     -- sempre lê o próprio perfil
    OR workspace_id = public.get_my_workspace_id()      -- lê colegas do mesmo workspace
  );

-- ── 2. Atualiza trigger handle_new_user para auto-atribuir workspace ──────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE slug = 'obraflow-padrao'
  LIMIT 1;

  INSERT INTO public.profiles (id, nome, workspace_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nome',
    v_workspace_id
  );

  RETURN NEW;
END;
$$;

-- ── 3. Backfill: corrige perfis existentes com workspace_id = NULL ────────────

DO $$
DECLARE
  v_workspace_id UUID;
  v_count INTEGER;
BEGIN
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE slug = 'obraflow-padrao';

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace padrão não encontrado.';
  END IF;

  UPDATE public.profiles
  SET workspace_id = v_workspace_id
  WHERE workspace_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfill: % profile(s) atualizado(s) com workspace_id = %', v_count, v_workspace_id;
END $$;
