-- 027: Fundação de RBAC — cargos, matriz de permissões e has_permission()
--
-- Hoje profiles.cargo (texto livre) e profiles.setores (array) só controlam
-- o que o Sidebar mostra e pra onde o AppShell redireciona — nenhuma RLS
-- olha pra isso. Esta migration cria a base de um RBAC de verdade: cargos
-- por workspace (6 padrão + customizados pelo CEO), uma matriz de permissão
-- (visualizar/criar/editar/excluir por setor) por cargo, e a função
-- has_permission() que a Fase 2 (migration 028) vai usar nas policies de
-- leads/obras/lancamentos.
--
-- Esta migration NÃO altera RLS de leads/obras/lancamentos ainda — só
-- prepara a fundação (cargos/permissoes_cargo/profiles.cargo_id) e corrige
-- um bug pré-existente: a policy de UPDATE em profiles é "id = auth.uid()",
-- ou seja, hoje um CEO não consegue editar o cargo de um colega.

-- ── 1. Tabelas ──────────────────────────────────────────────────────────────

CREATE TABLE public.cargos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nome         TEXT        NOT NULL,
  sistema      BOOLEAN     NOT NULL DEFAULT false, -- true = um dos 6 cargos padrão (nome/existência protegidos)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cargos_workspace_nome_unique UNIQUE (workspace_id, nome)
);

CREATE TRIGGER cargos_updated_at
  BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.permissoes_cargo (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id        UUID    NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  setor           TEXT    NOT NULL CHECK (setor IN ('comercial','obras','financeiro','notificacoes','configuracoes')),
  pode_visualizar BOOLEAN NOT NULL DEFAULT false,
  pode_criar      BOOLEAN NOT NULL DEFAULT false,
  pode_editar     BOOLEAN NOT NULL DEFAULT false,
  pode_excluir    BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT permissoes_cargo_unique UNIQUE (cargo_id, setor)
);

ALTER TABLE public.profiles
  ADD COLUMN cargo_id UUID REFERENCES public.cargos(id) ON DELETE SET NULL;

-- ── 2. Seed dos 6 cargos padrão + matriz de permissão ────────────────────────

CREATE OR REPLACE FUNCTION public.seed_cargos_padrao(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ceo UUID; v_gerente UUID; v_sdr UUID; v_engenheiro UUID; v_estagiario UUID; v_financeiro UUID;
BEGIN
  INSERT INTO public.cargos (workspace_id, nome, sistema) VALUES (p_workspace_id, 'CEO / Dono', true) RETURNING id INTO v_ceo;
  INSERT INTO public.cargos (workspace_id, nome, sistema) VALUES (p_workspace_id, 'Gerente / Diretor', true) RETURNING id INTO v_gerente;
  INSERT INTO public.cargos (workspace_id, nome, sistema) VALUES (p_workspace_id, 'SDR / Vendedor', true) RETURNING id INTO v_sdr;
  INSERT INTO public.cargos (workspace_id, nome, sistema) VALUES (p_workspace_id, 'Engenheiro / Arquiteto', true) RETURNING id INTO v_engenheiro;
  INSERT INTO public.cargos (workspace_id, nome, sistema) VALUES (p_workspace_id, 'Estagiário', true) RETURNING id INTO v_estagiario;
  INSERT INTO public.cargos (workspace_id, nome, sistema) VALUES (p_workspace_id, 'Financeiro', true) RETURNING id INTO v_financeiro;

  -- CEO / Dono — acesso total
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_ceo, 'comercial',     true, true, true, true),
    (v_ceo, 'obras',         true, true, true, true),
    (v_ceo, 'financeiro',    true, true, true, true),
    (v_ceo, 'notificacoes',  true, false, false, false),
    (v_ceo, 'configuracoes', true, true, true, true);

  -- Gerente / Diretor — comercial+obras+financeiro (cria/edita, não exclui lançamento), alertas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_gerente, 'comercial',     true, true, true, true),
    (v_gerente, 'obras',         true, true, true, true),
    (v_gerente, 'financeiro',    true, true, true, false),
    (v_gerente, 'notificacoes',  true, false, false, false),
    (v_gerente, 'configuracoes', false, false, false, false);

  -- SDR / Vendedor — comercial completo (inclusive excluir leads), alertas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_sdr, 'comercial',     true, true, true, true),
    (v_sdr, 'obras',         false, false, false, false),
    (v_sdr, 'financeiro',    false, false, false, false),
    (v_sdr, 'notificacoes',  true, false, false, false),
    (v_sdr, 'configuracoes', false, false, false, false);

  -- Engenheiro / Arquiteto — obras (cria/edita, não exclui), alertas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_engenheiro, 'comercial',     false, false, false, false),
    (v_engenheiro, 'obras',         true, true, true, false),
    (v_engenheiro, 'financeiro',    false, false, false, false),
    (v_engenheiro, 'notificacoes',  true, false, false, false),
    (v_engenheiro, 'configuracoes', false, false, false, false);

  -- Estagiário — obras (cria/edita, não exclui), alertas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_estagiario, 'comercial',     false, false, false, false),
    (v_estagiario, 'obras',         true, true, true, false),
    (v_estagiario, 'financeiro',    false, false, false, false),
    (v_estagiario, 'notificacoes',  true, false, false, false),
    (v_estagiario, 'configuracoes', false, false, false, false);

  -- Financeiro — controle completo dos lançamentos, alertas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_financeiro, 'comercial',     false, false, false, false),
    (v_financeiro, 'obras',         false, false, false, false),
    (v_financeiro, 'financeiro',    true, true, true, true),
    (v_financeiro, 'notificacoes',  true, false, false, false),
    (v_financeiro, 'configuracoes', false, false, false, false);
END;
$$;

-- Roda o seed automaticamente pra todo workspace novo (mesmo padrão de auto_set_workspace_id).
CREATE OR REPLACE FUNCTION public.trigger_seed_cargos_padrao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_cargos_padrao(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER workspaces_seed_cargos
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE PROCEDURE public.trigger_seed_cargos_padrao();

-- ── 3. Backfill dos workspaces/perfis reais já existentes ────────────────────

DO $$
DECLARE
  v_ws RECORD;
BEGIN
  FOR v_ws IN SELECT id FROM public.workspaces LOOP
    IF NOT EXISTS (SELECT 1 FROM public.cargos WHERE workspace_id = v_ws.id) THEN
      PERFORM public.seed_cargos_padrao(v_ws.id);
    END IF;
  END LOOP;

  UPDATE public.profiles p
  SET cargo_id = c.id
  FROM public.cargos c
  WHERE c.workspace_id = p.workspace_id
    AND c.nome = 'CEO / Dono'
    AND p.cargo = 'CEO / Dono'
    AND p.cargo_id IS NULL;
END $$;

-- ── 4. has_permission() — mesmo padrão SECURITY DEFINER de get_my_workspace_id() ─

CREATE OR REPLACE FUNCTION public.has_permission(p_setor TEXT, p_acao TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE p_acao
        WHEN 'visualizar' THEN pc.pode_visualizar
        WHEN 'criar'      THEN pc.pode_criar
        WHEN 'editar'     THEN pc.pode_editar
        WHEN 'excluir'    THEN pc.pode_excluir
        ELSE false
      END
      FROM public.profiles p
      JOIN public.permissoes_cargo pc ON pc.cargo_id = p.cargo_id AND pc.setor = p_setor
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

-- ── 5. Sincroniza profiles.cargo/setores a partir de cargo_id ────────────────
-- Sempre recalcula (ignora qualquer cargo/setores que o cliente tente mandar
-- direto), mantendo Sidebar/AppShell/getSetorInicial funcionando sem mudar
-- nenhum código de frontend, e fechando a porta de escrever setores à mão.

CREATE OR REPLACE FUNCTION public.sync_profile_cargo_label()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cargo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO NEW.cargo FROM public.cargos WHERE id = NEW.cargo_id;

  SELECT COALESCE(array_agg(setor ORDER BY setor), '{}')
  INTO NEW.setores
  FROM public.permissoes_cargo
  WHERE cargo_id = NEW.cargo_id AND pode_visualizar = true;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_sync_cargo_label
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_cargo_label();

-- ── 6. Proteção contra auto-promoção de cargo ────────────────────────────────
-- Sem isso, qualquer usuário poderia chamar a API direto e setar o próprio
-- cargo_id pro cargo de CEO, já que a policy de UPDATE permite id=auth.uid().

CREATE OR REPLACE FUNCTION public.guard_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.workspace_id IS NOT NULL
     AND (NEW.cargo_id IS DISTINCT FROM OLD.cargo_id OR NEW.ativo IS DISTINCT FROM OLD.ativo)
     AND NOT public.has_permission('configuracoes', 'editar')
  THEN
    RAISE EXCEPTION 'Sem permissão para alterar cargo ou status de um membro';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.guard_profile_privilege_escalation();

-- ── 7. Corrige a policy de UPDATE em profiles ────────────────────────────────
-- Antes: só dava pra editar a própria linha. Agora: a própria linha, OU
-- qualquer perfil do mesmo workspace se tiver permissão de configuracoes.

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'editar'))
  )
  WITH CHECK (
    id = auth.uid()
    OR (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'editar'))
  );

-- ── 8. RLS de cargos / permissoes_cargo ──────────────────────────────────────

ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissoes_cargo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cargos_select" ON public.cargos
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id());

CREATE POLICY "cargos_insert" ON public.cargos
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'criar'));

CREATE POLICY "cargos_update" ON public.cargos
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'editar'));

CREATE POLICY "cargos_delete" ON public.cargos
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'excluir'));

-- Protege os 6 cargos padrão: não deixa renomear nem apagar (a matriz de
-- permissão deles ainda pode ser editada normalmente pela policy acima).
CREATE OR REPLACE FUNCTION public.guard_cargo_sistema()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sistema THEN
      RAISE EXCEPTION 'Cargo padrão do sistema não pode ser excluído';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.sistema AND (NEW.nome IS DISTINCT FROM OLD.nome OR NEW.sistema IS DISTINCT FROM OLD.sistema) THEN
    RAISE EXCEPTION 'Cargo padrão do sistema não pode ser renomeado';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cargos_guard_sistema
  BEFORE UPDATE OR DELETE ON public.cargos
  FOR EACH ROW EXECUTE PROCEDURE public.guard_cargo_sistema();

CREATE POLICY "permissoes_cargo_select" ON public.permissoes_cargo
  FOR SELECT TO authenticated
  USING (cargo_id IN (SELECT id FROM public.cargos WHERE workspace_id = public.get_my_workspace_id()));

CREATE POLICY "permissoes_cargo_insert" ON public.permissoes_cargo
  FOR INSERT TO authenticated
  WITH CHECK (
    cargo_id IN (SELECT id FROM public.cargos WHERE workspace_id = public.get_my_workspace_id())
    AND public.has_permission('configuracoes', 'criar')
  );

CREATE POLICY "permissoes_cargo_update" ON public.permissoes_cargo
  FOR UPDATE TO authenticated
  USING (
    cargo_id IN (SELECT id FROM public.cargos WHERE workspace_id = public.get_my_workspace_id())
    AND public.has_permission('configuracoes', 'editar')
  )
  WITH CHECK (
    cargo_id IN (SELECT id FROM public.cargos WHERE workspace_id = public.get_my_workspace_id())
    AND public.has_permission('configuracoes', 'editar')
  );

CREATE POLICY "permissoes_cargo_delete" ON public.permissoes_cargo
  FOR DELETE TO authenticated
  USING (
    cargo_id IN (SELECT id FROM public.cargos WHERE workspace_id = public.get_my_workspace_id())
    AND public.has_permission('configuracoes', 'excluir')
  );

-- ── 9. Força o sync de cargo/setores nos perfis já backfillados na seção 3 ───
-- A seção 3 roda antes do trigger profiles_sync_cargo_label existir (seção 5),
-- então o backfill setou cargo_id mas não recalculou cargo/setores. Refaz o
-- UPDATE agora que o trigger já existe, pra ficar 100% alinhado à matriz.

UPDATE public.profiles SET cargo_id = cargo_id WHERE cargo_id IS NOT NULL;
