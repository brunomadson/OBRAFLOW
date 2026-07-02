-- 020: Sem invite → workspace_id NULL → usuário vai para /onboarding
--
-- LÓGICA CORRETA:
--   Com invite  → usa workspace/cargo/setores do convite → vai para /comercial
--   Sem invite  → workspace_id = NULL → AppShell redireciona para /onboarding
--                 → usuário cria seu próprio workspace e vira CEO
--
-- Isso separa claramente os dois fluxos:
--   Novo cliente    → cria conta → onboarding → cria workspace → CEO
--   Membro da equipe → é convidado → cria conta → entra direto no workspace

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
    -- Com invite: entra direto com workspace, cargo e setores do convite
    v_nome := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome', ''), v_nome);

    INSERT INTO public.profiles (id, nome, workspace_id, cargo, setores)
    VALUES (NEW.id, v_nome, v_workspace_id, v_cargo, v_setores);

    UPDATE public.workspace_invites SET used_at = NOW() WHERE id = v_invite_id;

  ELSE
    -- Sem invite: workspace_id NULL → onboarding vai criar o workspace
    INSERT INTO public.profiles (id, nome)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'nome');
  END IF;

  RETURN NEW;
END;
$$;
