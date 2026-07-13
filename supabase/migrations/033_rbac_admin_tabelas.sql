-- 033: Sprint 7.1 — RBAC nas tabelas administrativas
--
-- Fecha o risco encontrado na auditoria do RBAC_VALIDACAO.md: config,
-- metas_dashboard, workspace_invites e workspace_integracoes ainda só
-- isolavam por workspace_id, sem checar cargo. Reaproveita exatamente
-- has_permission(setor, ação) já existente (migration 027) — nenhuma
-- estrutura nova, só 3 setores novos na mesma tabela permissoes_cargo e
-- policies no mesmo formato da migration 030.
--
-- Mapeamento tabela → setor:
--   config              → 'configuracoes' (setor já existente)
--   metas_dashboard     → 'metas'         (novo)
--   workspace_invites   → 'membros'       (novo)
--   workspace_integracoes → 'integracoes' (novo)
--
-- Nota sobre Gerente/Diretor em "membros": a UI de convite de membro fica
-- dentro de Configurações → Membros, e hoje Gerente não tem o setor
-- "configuracoes" liberado (não chega nem na página) — ou seja, a
-- arquitetura atual NÃO dá gerenciamento de equipe pro Gerente. Por isso
-- este cargo recebe "sem acesso" em membros, conforme a opção B descrita no
-- ticket ("caso contrário: somente CEO").
--
-- Nota sobre metas: "demais cargos" ganham visualizar=true (não
-- mencionado à toa) porque as dashboards de Comercial/Obras/Financeiro já
-- mostram "Meta x Realizado" pra todo mundo hoje — negar visualizar
-- quebraria esse comparativo pra SDR/Engenheiro/Estagiário/Financeiro.

-- ── 1. Novos setores na matriz de permissão ──────────────────────────────────

ALTER TABLE public.permissoes_cargo DROP CONSTRAINT IF EXISTS permissoes_cargo_setor_check;
ALTER TABLE public.permissoes_cargo ADD CONSTRAINT permissoes_cargo_setor_check
  CHECK (setor IN ('comercial','obras','financeiro','notificacoes','configuracoes','metas','membros','integracoes'));

-- ── 2. seed_cargos_padrao() — versão com os 8 setores, pra todo workspace novo ─

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
    (v_ceo, 'configuracoes', true, true, true, true),
    (v_ceo, 'metas',         true, true, true, true),
    (v_ceo, 'membros',       true, true, true, true),
    (v_ceo, 'integracoes',   true, true, true, true);

  -- Gerente / Diretor — comercial+obras+financeiro (cria/edita, não exclui
  -- lançamento), alertas; config/metas: vê e edita, não cria/exclui;
  -- integrações: só vê; membros: sem acesso (ver nota acima)
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_gerente, 'comercial',     true, true, true, true),
    (v_gerente, 'obras',         true, true, true, true),
    (v_gerente, 'financeiro',    true, true, true, false),
    (v_gerente, 'notificacoes',  true, false, false, false),
    (v_gerente, 'configuracoes', true, false, true, false),
    (v_gerente, 'metas',         true, false, true, false),
    (v_gerente, 'membros',       false, false, false, false),
    (v_gerente, 'integracoes',   true, false, false, false);

  -- SDR / Vendedor — comercial completo, alertas, vê metas (dashboard)
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_sdr, 'comercial',     true, true, true, true),
    (v_sdr, 'obras',         false, false, false, false),
    (v_sdr, 'financeiro',    false, false, false, false),
    (v_sdr, 'notificacoes',  true, false, false, false),
    (v_sdr, 'configuracoes', false, false, false, false),
    (v_sdr, 'metas',         true, false, false, false),
    (v_sdr, 'membros',       false, false, false, false),
    (v_sdr, 'integracoes',   false, false, false, false);

  -- Engenheiro / Arquiteto — obras (cria/edita, não exclui), alertas, vê metas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_engenheiro, 'comercial',     false, false, false, false),
    (v_engenheiro, 'obras',         true, true, true, false),
    (v_engenheiro, 'financeiro',    false, false, false, false),
    (v_engenheiro, 'notificacoes',  true, false, false, false),
    (v_engenheiro, 'configuracoes', false, false, false, false),
    (v_engenheiro, 'metas',         true, false, false, false),
    (v_engenheiro, 'membros',       false, false, false, false),
    (v_engenheiro, 'integracoes',   false, false, false, false);

  -- Estagiário — obras (cria/edita, não exclui), alertas, vê metas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_estagiario, 'comercial',     false, false, false, false),
    (v_estagiario, 'obras',         true, true, true, false),
    (v_estagiario, 'financeiro',    false, false, false, false),
    (v_estagiario, 'notificacoes',  true, false, false, false),
    (v_estagiario, 'configuracoes', false, false, false, false),
    (v_estagiario, 'metas',         true, false, false, false),
    (v_estagiario, 'membros',       false, false, false, false),
    (v_estagiario, 'integracoes',   false, false, false, false);

  -- Financeiro — controle completo dos lançamentos, alertas, vê metas
  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_financeiro, 'comercial',     false, false, false, false),
    (v_financeiro, 'obras',         false, false, false, false),
    (v_financeiro, 'financeiro',    true, true, true, true),
    (v_financeiro, 'notificacoes',  true, false, false, false),
    (v_financeiro, 'configuracoes', false, false, false, false),
    (v_financeiro, 'metas',         true, false, false, false),
    (v_financeiro, 'membros',       false, false, false, false),
    (v_financeiro, 'integracoes',   false, false, false, false);
END;
$$;

-- ── 3. Backfill dos cargos já existentes (Concretize + ObraFlow Padrão) ──────

-- 3a. Gerente/Diretor ganha config: visualizar+editar (não tinha nenhum
-- acesso a configuracoes antes desta sprint)
UPDATE public.permissoes_cargo pc
SET pode_visualizar = true, pode_editar = true
FROM public.cargos c
WHERE pc.cargo_id = c.id AND c.nome = 'Gerente / Diretor' AND pc.setor = 'configuracoes';

-- 3b. Insere as linhas de metas/membros/integracoes pra todo cargo que já
-- existia antes desta migration (sistema ou customizado). Cargos sistema
-- usam os valores do ticket; qualquer outro (customizado, ex. "Supervisor
-- de Obras") cai no bucket "demais cargos": só vê metas, mais nada.
DO $$
DECLARE
  v_cargo RECORD;
BEGIN
  FOR v_cargo IN SELECT id, nome FROM public.cargos LOOP
    IF EXISTS (SELECT 1 FROM public.permissoes_cargo WHERE cargo_id = v_cargo.id AND setor = 'metas') THEN
      CONTINUE; -- já rodou pra este cargo (idempotente)
    END IF;

    IF v_cargo.nome = 'CEO / Dono' THEN
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
        (v_cargo.id, 'metas',       true, true, true, true),
        (v_cargo.id, 'membros',     true, true, true, true),
        (v_cargo.id, 'integracoes', true, true, true, true);
    ELSIF v_cargo.nome = 'Gerente / Diretor' THEN
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
        (v_cargo.id, 'metas',       true, false, true, false),
        (v_cargo.id, 'membros',     false, false, false, false),
        (v_cargo.id, 'integracoes', true, false, false, false);
    ELSE
      -- SDR, Engenheiro, Estagiário, Financeiro e qualquer cargo customizado
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
        (v_cargo.id, 'metas',       true, false, false, false),
        (v_cargo.id, 'membros',     false, false, false, false),
        (v_cargo.id, 'integracoes', false, false, false, false);
    END IF;
  END LOOP;
END $$;

-- 3c. Reforça o sync de profiles.setores pros perfis de Gerente, já que a
-- permissão de "configuracoes" mudou pra esse cargo (o trigger de sync só
-- roda em INSERT/UPDATE de profiles, não quando permissoes_cargo muda).
UPDATE public.profiles
SET cargo_id = cargo_id
WHERE cargo_id IN (SELECT id FROM public.cargos WHERE nome = 'Gerente / Diretor');

-- ── 4. RLS de config (setor: configuracoes) ──────────────────────────────────

DROP POLICY IF EXISTS "config_workspace" ON public.config;

CREATE POLICY "config_select" ON public.config
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'visualizar'));

CREATE POLICY "config_insert" ON public.config
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'criar'));

CREATE POLICY "config_update" ON public.config
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'editar'));

CREATE POLICY "config_delete" ON public.config
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'excluir'));

-- ── 5. RLS de metas_dashboard (setor: metas) ─────────────────────────────────

DROP POLICY IF EXISTS "metas_dashboard_workspace" ON public.metas_dashboard;

CREATE POLICY "metas_dashboard_select" ON public.metas_dashboard
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'visualizar'));

CREATE POLICY "metas_dashboard_insert" ON public.metas_dashboard
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'criar'));

CREATE POLICY "metas_dashboard_update" ON public.metas_dashboard
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'editar'));

CREATE POLICY "metas_dashboard_delete" ON public.metas_dashboard
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('metas', 'excluir'));

-- ── 6. RLS de workspace_invites (setor: membros) ─────────────────────────────

DROP POLICY IF EXISTS "invites_workspace" ON public.workspace_invites;

CREATE POLICY "workspace_invites_select" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'visualizar'));

CREATE POLICY "workspace_invites_insert" ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'criar'));

CREATE POLICY "workspace_invites_update" ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'editar'));

CREATE POLICY "workspace_invites_delete" ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('membros', 'excluir'));

-- ── 7. RLS de workspace_integracoes (setor: integracoes) ─────────────────────

DROP POLICY IF EXISTS "workspace_integracoes_workspace" ON public.workspace_integracoes;

CREATE POLICY "workspace_integracoes_select" ON public.workspace_integracoes
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'visualizar'));

CREATE POLICY "workspace_integracoes_insert" ON public.workspace_integracoes
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'criar'));

CREATE POLICY "workspace_integracoes_update" ON public.workspace_integracoes
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'editar'))
  WITH CHECK (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'editar'));

CREATE POLICY "workspace_integracoes_delete" ON public.workspace_integracoes
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'excluir'));
