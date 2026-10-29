-- 052: Sprint 13.2 — RBAC + esqueleto do módulo Serviços Técnicos
--
-- Só a fundação de acesso e o catálogo — nenhuma tela de pipeline/gestão de
-- projeto ainda (isso é Sprint 13.3+). Segue o mesmo padrão das migrations
-- 033/036: um setor novo na mesma matriz permissoes_cargo, sem mecanismo de
-- permissão paralelo.
--
-- Os valores de permissão padrão abaixo são um ponto de partida por cargo —
-- totalmente ajustável depois em Configurações → Cargos, igual qualquer
-- outro setor.
--
-- catalogo_servicos é o "catálogo, não código" (ver Estratégia de
-- Escalabilidade no due-diligence): cada serviço novo que a empresa passa a
-- vender (ex: "Energia Solar") é uma linha aqui, nunca uma tabela ou tela
-- nova. Fica vazio nesta migration — o cadastro é feito pela tela nova.

-- ── 1. Novo setor "servicos-tecnicos" na matriz ──────────────────────────────

ALTER TABLE public.permissoes_cargo DROP CONSTRAINT IF EXISTS permissoes_cargo_setor_check;
ALTER TABLE public.permissoes_cargo ADD CONSTRAINT permissoes_cargo_setor_check
  CHECK (setor IN ('comercial','obras','financeiro','notificacoes','configuracoes','metas','membros','integracoes','documentos','servicos-tecnicos'));

-- ── 2. seed_cargos_padrao() — versão com os 10 setores, pra todo workspace novo ─

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
    (v_ceo, 'comercial',         true, true, true, true),
    (v_ceo, 'obras',             true, true, true, true),
    (v_ceo, 'financeiro',        true, true, true, true),
    (v_ceo, 'notificacoes',      true, false, false, false),
    (v_ceo, 'configuracoes',     true, true, true, true),
    (v_ceo, 'metas',             true, true, true, true),
    (v_ceo, 'membros',           true, true, true, true),
    (v_ceo, 'integracoes',       true, true, true, true),
    (v_ceo, 'documentos',        true, true, true, true),
    (v_ceo, 'servicos-tecnicos', true, true, true, true);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_gerente, 'comercial',         true, true, true, true),
    (v_gerente, 'obras',             true, true, true, true),
    (v_gerente, 'financeiro',        true, true, true, false),
    (v_gerente, 'notificacoes',      true, false, false, false),
    (v_gerente, 'configuracoes',     true, false, true, false),
    (v_gerente, 'metas',             true, false, true, false),
    (v_gerente, 'membros',           false, false, false, false),
    (v_gerente, 'integracoes',       true, false, false, false),
    (v_gerente, 'documentos',        true, true, true, false),
    (v_gerente, 'servicos-tecnicos', true, true, true, false);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_sdr, 'comercial',         true, true, true, true),
    (v_sdr, 'obras',             false, false, false, false),
    (v_sdr, 'financeiro',        false, false, false, false),
    (v_sdr, 'notificacoes',      true, false, false, false),
    (v_sdr, 'configuracoes',     false, false, false, false),
    (v_sdr, 'metas',             true, false, false, false),
    (v_sdr, 'membros',           false, false, false, false),
    (v_sdr, 'integracoes',       false, false, false, false),
    (v_sdr, 'documentos',        true, true, true, false),
    (v_sdr, 'servicos-tecnicos', true, true, true, true);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_engenheiro, 'comercial',         false, false, false, false),
    (v_engenheiro, 'obras',             true, true, true, false),
    (v_engenheiro, 'financeiro',        false, false, false, false),
    (v_engenheiro, 'notificacoes',      true, false, false, false),
    (v_engenheiro, 'configuracoes',     false, false, false, false),
    (v_engenheiro, 'metas',             true, false, false, false),
    (v_engenheiro, 'membros',           false, false, false, false),
    (v_engenheiro, 'integracoes',       false, false, false, false),
    (v_engenheiro, 'documentos',        true, true, true, false),
    (v_engenheiro, 'servicos-tecnicos', true, true, true, false);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_estagiario, 'comercial',         false, false, false, false),
    (v_estagiario, 'obras',             true, true, true, false),
    (v_estagiario, 'financeiro',        false, false, false, false),
    (v_estagiario, 'notificacoes',      true, false, false, false),
    (v_estagiario, 'configuracoes',     false, false, false, false),
    (v_estagiario, 'metas',             true, false, false, false),
    (v_estagiario, 'membros',           false, false, false, false),
    (v_estagiario, 'integracoes',       false, false, false, false),
    (v_estagiario, 'documentos',        true, true, true, false),
    (v_estagiario, 'servicos-tecnicos', true, true, true, false);

  INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir) VALUES
    (v_financeiro, 'comercial',         false, false, false, false),
    (v_financeiro, 'obras',             false, false, false, false),
    (v_financeiro, 'financeiro',        true, true, true, true),
    (v_financeiro, 'notificacoes',      true, false, false, false),
    (v_financeiro, 'configuracoes',     false, false, false, false),
    (v_financeiro, 'metas',             true, false, false, false),
    (v_financeiro, 'membros',           false, false, false, false),
    (v_financeiro, 'integracoes',       false, false, false, false),
    (v_financeiro, 'documentos',        false, false, false, false),
    (v_financeiro, 'servicos-tecnicos', true, true, true, true);
END;
$$;

-- ── 3. Backfill dos cargos já existentes ─────────────────────────────────────

DO $$
DECLARE
  v_cargo RECORD;
BEGIN
  FOR v_cargo IN SELECT id, nome FROM public.cargos LOOP
    IF EXISTS (SELECT 1 FROM public.permissoes_cargo WHERE cargo_id = v_cargo.id AND setor = 'servicos-tecnicos') THEN
      CONTINUE;
    END IF;

    IF v_cargo.nome IN ('CEO / Dono', 'Financeiro') THEN
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir)
      VALUES (v_cargo.id, 'servicos-tecnicos', true, true, true, true);
    ELSIF v_cargo.nome = 'Gerente / Diretor' THEN
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir)
      VALUES (v_cargo.id, 'servicos-tecnicos', true, true, true, false);
    ELSE
      -- SDR, Engenheiro, Estagiário e qualquer cargo customizado
      INSERT INTO public.permissoes_cargo (cargo_id, setor, pode_visualizar, pode_criar, pode_editar, pode_excluir)
      VALUES (v_cargo.id, 'servicos-tecnicos', true, true, true, false);
    END IF;
  END LOOP;
END $$;

-- ── 4. catalogo_servicos ──────────────────────────────────────────────────────

create table if not exists public.catalogo_servicos (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  nome         text not null,
  categoria    text,
  descricao    text,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.catalogo_servicos enable row level security;

create policy "catalogo_servicos_select" on public.catalogo_servicos
  for select to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'visualizar')
  );

create policy "catalogo_servicos_insert" on public.catalogo_servicos
  for insert to authenticated
  with check (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'criar')
  );

create policy "catalogo_servicos_update" on public.catalogo_servicos
  for update to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'editar')
  )
  with check (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'editar')
  );

create policy "catalogo_servicos_delete" on public.catalogo_servicos
  for delete to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'excluir')
  );

create trigger catalogo_servicos_auto_workspace
  before insert on public.catalogo_servicos
  for each row execute function public.auto_set_workspace_id();

create trigger catalogo_servicos_updated_at
  before update on public.catalogo_servicos
  for each row execute procedure public.set_updated_at();
