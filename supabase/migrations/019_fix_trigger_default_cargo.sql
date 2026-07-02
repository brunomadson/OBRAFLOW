-- 019: Usuário criado sem invite recebe cargo e setor padrão
--
-- Antes: usuário sem invite entrava com workspace_id preenchido mas
-- cargo/setores NULL → /comercial sem nenhuma aba visível.
--
-- Agora: sem invite → cargo = 'Engenheiro' + setor = ['comercial']
-- O admin pode ajustar depois em Configurações → Membros.

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
    -- Com invite: usa dados do convite
    v_nome := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome', ''), v_nome);

    INSERT INTO public.profiles (id, nome, workspace_id, cargo, setores)
    VALUES (NEW.id, v_nome, v_workspace_id, v_cargo, v_setores);

    UPDATE public.workspace_invites SET used_at = NOW() WHERE id = v_invite_id;

  ELSE
    -- Sem invite: workspace padrão + cargo padrão
    SELECT id INTO v_workspace_id
    FROM public.workspaces
    WHERE slug = 'obraflow-padrao'
    LIMIT 1;

    INSERT INTO public.profiles (id, nome, workspace_id, cargo, setores)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'nome',
      v_workspace_id,
      'Engenheiro',
      ARRAY['comercial']
    );
  END IF;

  RETURN NEW;
END;
$$;
