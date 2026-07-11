-- 032: workspace_invites passa a carregar cargo_id
--
-- Até aqui o convite de membro (ModalMembro → workspace_invites →
-- handle_new_user) gravava cargo/setores como texto direto no profile
-- recém-criado, sem nunca passar por cargo_id — ou seja, um membro convidado
-- teria has_permission() sempre negando tudo, porque cargo_id ficaria NULL.
--
-- Adiciona workspace_invites.cargo_id e atualiza handle_new_user pra usar
-- ele: a trigger profiles_sync_cargo_label (027) recalcula cargo/setores
-- (texto) automaticamente a partir do cargo_id no INSERT, então não precisa
-- mais passar esses dois campos manualmente.

ALTER TABLE public.workspace_invites
  ADD COLUMN cargo_id UUID REFERENCES public.cargos(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_cargo_id     UUID;
  v_nome         TEXT;
  v_invite_id    UUID;
BEGIN
  SELECT id, workspace_id, cargo_id, nome
  INTO v_invite_id, v_workspace_id, v_cargo_id, v_nome
  FROM public.workspace_invites
  WHERE email = NEW.email
    AND used_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite_id IS NOT NULL THEN
    v_nome := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome', ''), v_nome);

    INSERT INTO public.profiles (id, nome, workspace_id, cargo_id)
    VALUES (NEW.id, v_nome, v_workspace_id, v_cargo_id);

    UPDATE public.workspace_invites SET used_at = NOW() WHERE id = v_invite_id;
  ELSE
    -- Sem invite: workspace_id NULL → onboarding vai criar o workspace
    INSERT INTO public.profiles (id, nome)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'nome');
  END IF;

  RETURN NEW;
END;
$$;
