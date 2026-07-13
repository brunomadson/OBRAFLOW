-- 036: Sprint 7.2 (Etapas 3, 5, 7) — setor "documentos" + RLS real na tabela documentos
--
-- Regra de negócio (definida no ticket, resolvendo a auditoria da Etapa 1):
--
--   VISUALIZAR é compartilhado — quem tem acesso ao lead/obra vê os
--     documentos daquele registro, independente de quem anexou. Documento
--     é patrimônio da empresa, não do setor que criou.
--   CRIAR exige permissão de documentos E do domínio (lead → comercial.criar,
--     obra → obras.criar) — só quem já pode mexer naquele registro anexa
--     arquivo nele.
--   EDITAR: quem criou o documento pode editar o que criou
--     (documentos.usuario_id = auth.uid()). CEO e Gerente editam qualquer
--     documento do domínio que têm acesso, não só o que criaram — usamos
--     has_permission('configuracoes','visualizar') como esse sinal de
--     "gestor", porque hoje são EXATAMENTE CEO e Gerente que têm essa
--     permissão (Sprint 7.1) — nenhum setor/coluna novo precisou ser
--     inventado pra essa distinção, é dado que já existe.
--   EXCLUIR é só CEO — mesmo quem criou o documento não pode apagar. Como
--     a exclusão no app hoje é um soft-delete (UPDATE ativo=false, não um
--     DELETE de verdade — ver documentos.service.ts), a regra de excluir
--     não cabe só na policy de UPDATE comum: uma trigger separada intercepta
--     especificamente a mudança de "ativo" e exige documentos.excluir,
--     mesmo que a policy de UPDATE (regra de editar) already tenha deixado
--     passar. DELETE de verdade na tabela (não usado pelo app hoje, mas
--     protegido por completude) segue a mesma regra.
--
-- Achado à parte na auditoria: documentos.usuario_id nunca foi preenchido
-- pelo código (documentos.service.ts não manda esse campo no INSERT) —
-- corrigido separadamente no frontend. Documentos já existentes ficam com
-- usuario_id NULL, editáveis só por CEO/Gerente até serem reenviados.

-- ── 1. Novo setor "documentos" na matriz ─────────────────────────────────────

ALTER TABLE public.permissoes_cargo DROP CONSTRAINT IF EXISTS permissoes_cargo_setor_check;
ALTER TABLE public.permissoes_cargo ADD CONSTRAINT permissoes_cargo_setor_check
  CHECK (setor IN ('comercial','obras','financeiro','notificacoes','configuracoes','metas','membros','integracoes','documentos'));

-- ── 2. seed_cargos_padrao() — versão com os 9 setores, pra todo workspace novo ─

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

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_ceo, 'comercial',     true, true, true, true),
    (v_ceo, 'obras',         true, true, true, true),
    (v_ceo, 'financeiro',    true, true, true, true),
    (v_ceo, 'notificacoes',  true, false, false, false),
    (v_ceo, 'configuracoes', true, true, true, true),
    (v_ceo, 'metas',         true, true, true, true),
    (v_ceo, 'membros',       true, true, true, true),
    (v_ceo, 'integracoes',   true, true, true, true),
    (v_ceo, 'documentos',    true, true, true, true);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_gerente, 'comercial',     true, true, true, true),
    (v_gerente, 'obras',         true, true, true, true),
    (v_gerente, 'financeiro',    true, true, true, false),
    (v_gerente, 'notificacoes',  true, false, false, false),
    (v_gerente, 'configuracoes', true, false, true, false),
    (v_gerente, 'metas',         true, false, true, false),
    (v_gerente, 'membros',       false, false, false, false),
    (v_gerente, 'integracoes',   true, false, false, false),
    (v_gerente, 'documentos',    true, true, true, false);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_sdr, 'comercial',     true, true, true, true),
    (v_sdr, 'obras',         false, false, false, false),
    (v_sdr, 'financeiro',    false, false, false, false),
    (v_sdr, 'notificacoes',  true, false, false, false),
    (v_sdr, 'configuracoes', false, false, false, false),
    (v_sdr, 'metas',         true, false, false, false),
    (v_sdr, 'membros',       false, false, false, false),
    (v_sdr, 'integracoes',   false, false, false, false),
    (v_sdr, 'documentos',    true, true, true, false);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_engenheiro, 'comercial',     false, false, false, false),
    (v_engenheiro, 'obras',         true, true, true, false),
    (v_engenheiro, 'financeiro',    false, false, false, false),
    (v_engenheiro, 'notificacoes',  true, false, false, false),
    (v_engenheiro, 'configuracoes', false, false, false, false),
    (v_engenheiro, 'metas',         true, false, false, false),
    (v_engenheiro, 'membros',       false, false, false, false),
    (v_engenheiro, 'integracoes',   false, false, false, false),
    (v_engenheiro, 'documentos',    true, true, true, false);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_estagiario, 'comercial',     false, false, false, false),
    (v_estagiario, 'obras',         true, true, true, false),
    (v_estagiario, 'financeiro',    false, false, false, false),
    (v_estagiario, 'notificacoes',  true, false, false, false),
    (v_estagiario, 'configuracoes', false, false, false, false),
    (v_estagiario, 'metas',         true, false, false, false),
    (v_estagiario, 'membros',       false, false, false, false),
    (v_estagiario, 'integracoes',   false, false, false, false),
    (v_estagiario, 'documentos',    true, true, true, false);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_financeiro, 'comercial',     false, false, false, false),
    (v_financeiro, 'obras',         false, false, false, false),
    (v_financeiro, 'financeiro',    true, true, true, true),
    (v_financeiro, 'notificacoes',  true, false, false, false),
    (v_financeiro, 'configuracoes', false, false, false, false),
    (v_financeiro, 'metas',         true, false, false, false),
    (v_financeiro, 'membros',       false, false, false, false),
    (v_financeiro, 'integracoes',   false, false, false, false),
    (v_financeiro, 'documentos',    false, false, false, false);
END;
$$;

-- ── 3. Backfill dos cargos já existentes ─────────────────────────────────────
-- Documentos ainda não existe pra nenhum cargo que já foi criado antes desta
-- migration (sistema ou customizado) — insere pra todos, usando o nome pra
-- decidir os valores dos cargos padrão, e o bucket "demais" (ver·criar·editar,
-- sem excluir) pra qualquer cargo customizado.

DO $$
DECLARE
  v_cargo RECORD;
BEGIN
  FOR v_cargo IN SELECT id, nome FROM public.cargos LOOP
    IF EXISTS (SELECT 1 FROM public.permissoes_cargo WHERE cargo_id = v_cargo.id AND setor = 'documentos') THEN
      CONTINUE;
    END IF;

    IF v_cargo.nome = 'CEO / Dono' THEN
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir)
      VALUES (v_cargo.id, 'documentos', true, true, true, true);
    ELSIF v_cargo.nome = 'Financeiro' THEN
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir)
      VALUES (v_cargo.id, 'documentos', false, false, false, false);
    ELSE
      -- Gerente, SDR, Engenheiro, Estagiário e qualquer cargo customizado
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir)
      VALUES (v_cargo.id, 'documentos', true, true, true, false);
    END IF;
  END LOOP;
END $$;

-- ── 4. RLS de documentos ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "documentos_workspace" ON public.documentos;
DROP POLICY IF EXISTS "documentos_auth" ON public.documentos;

DROP POLICY IF EXISTS "documentos_select" ON public.documentos;
CREATE POLICY "documentos_select" ON public.documentos
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'visualizar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'visualizar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'visualizar'))
    )
  );

DROP POLICY IF EXISTS "documentos_insert" ON public.documentos;
CREATE POLICY "documentos_insert" ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'criar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'criar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'criar'))
    )
  );

DROP POLICY IF EXISTS "documentos_update" ON public.documentos;
CREATE POLICY "documentos_update" ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'editar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'editar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'editar'))
    )
    AND (usuario_id = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
  )
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'editar')
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'editar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'editar'))
    )
    AND (usuario_id = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
  );

DROP POLICY IF EXISTS "documentos_delete" ON public.documentos;
CREATE POLICY "documentos_delete" ON public.documentos
  FOR DELETE TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'excluir')
  );

-- ── 5. Trigger: soft-delete (ativo=false/true) exige documentos.excluir ──────
-- A regra de editar acima (usuario_id = auth.uid() OR gestor) deixaria o
-- próprio criador "editar" o registro, o que incluiria desativar (soft-
-- delete) o próprio documento — mas a Etapa 6 do ticket é clara: excluir é
-- só CEO, mesmo pra quem criou. Esta trigger intercepta especificamente a
-- mudança de "ativo" e reforça essa regra por cima da policy de UPDATE.

CREATE OR REPLACE FUNCTION public.guard_documento_exclusao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ativo IS DISTINCT FROM OLD.ativo AND NOT public.has_permission('documentos', 'excluir') THEN
    RAISE EXCEPTION 'Sem permissão para excluir este documento';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documentos_guard_exclusao ON public.documentos;
CREATE TRIGGER documentos_guard_exclusao
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW EXECUTE PROCEDURE public.guard_documento_exclusao();
