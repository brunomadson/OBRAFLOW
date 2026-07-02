-- 018: Sistema de convites de membros
--
-- Permite que o admin de um workspace convide novos membros sem precisar
-- de Edge Functions ou service role key no cliente.
--
-- FLUXO:
--   1. Admin cria registro em workspace_invites (email, cargo, setores)
--   2. Admin cria o usuário manualmente no Supabase Dashboard
--   3. handle_new_user (atualizado aqui) detecta o invite pelo email
--   4. Novo usuário já entra com workspace, cargo e setores corretos
--
-- Se não houver invite, comportamento padrão: workspace obraflow-padrao.

-- ── 1. Tabela workspace_invites ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cargo        TEXT NOT NULL DEFAULT 'Engenheiro',
  setores      TEXT[] NOT NULL DEFAULT '{}',
  nome         TEXT,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at      TIMESTAMPTZ
);

-- Índice para o lookup no trigger (email é o campo de busca)
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email
  ON public.workspace_invites(email)
  WHERE used_at IS NULL;

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Membros do workspace veem apenas os invites do próprio workspace
CREATE POLICY "invites_workspace" ON public.workspace_invites
  FOR ALL TO authenticated
  USING (workspace_id = public.get_my_workspace_id())
  WITH CHECK (workspace_id = public.get_my_workspace_id());

-- ── 2. Atualiza handle_new_user para respeitar convites ───────────────────────
--
-- Quando um novo usuário é criado no Supabase Auth:
--   a) Busca invite não utilizado com o mesmo email
--   b) Se encontrar: usa workspace_id, cargo, setores e nome do invite
--      e marca o invite como usado
--   c) Se não encontrar: comportamento padrão (workspace obraflow-padrao)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_cargo        TEXT;
  v_setores      TEXT[];
  v_nome         TEXT;
  v_invite_id    UUID;
BEGIN
  -- Busca invite pendente para este email
  SELECT id, workspace_id, cargo, setores, nome
  INTO v_invite_id, v_workspace_id, v_cargo, v_setores, v_nome
  FROM public.workspace_invites
  WHERE email = NEW.email
    AND used_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite_id IS NOT NULL THEN
    -- Tem invite: usa dados do convite
    -- Nome: preferência para o que veio no cadastro, fallback para o do invite
    v_nome := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nome', ''),
      v_nome
    );

    INSERT INTO public.profiles (id, nome, workspace_id, cargo, setores)
    VALUES (NEW.id, v_nome, v_workspace_id, v_cargo, v_setores);

    -- Marca o invite como utilizado
    UPDATE public.workspace_invites
    SET used_at = NOW()
    WHERE id = v_invite_id;

  ELSE
    -- Sem invite: workspace padrão (comportamento original)
    SELECT id INTO v_workspace_id
    FROM public.workspaces
    WHERE slug = 'obraflow-padrao'
    LIMIT 1;

    INSERT INTO public.profiles (id, nome, workspace_id)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'nome', v_workspace_id);
  END IF;

  RETURN NEW;
END;
$$;
