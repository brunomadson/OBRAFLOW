-- 058: Sprint 13.8 — Categoria e Template como entidades próprias
--
-- Até aqui catalogo_servicos misturava três coisas na mesma linha: o nome
-- do serviço vendido, uma categoria em texto livre, e o "como executar"
-- (tarefas_padrao/fases_execucao). Isso quebra na escala que o catálogo
-- está indo (~50+ serviços em 6 categorias) — duas pessoas digitando
-- "Projeto Elétrico" como categoria em telas diferentes viram duas
-- categorias por causa de acento/espaço, e não dá pra reaproveitar o mesmo
-- fluxo de execução em dois serviços parecidos sem copiar tudo de novo.
--
-- categorias_servico: navegação Categoria → Serviço, substitui o texto
-- livre catalogo_servicos.categoria (mantido na tabela por enquanto, só
-- não é mais escrito pela UI — evita perder o dado das linhas antigas).
--
-- templates_servico: onde tarefas_padrao/fases_execucao passam a viver de
-- verdade — um template é reutilizável por vários serviços do catálogo
-- (ex: "Projeto Elétrico Residencial" e "Projeto Elétrico Comercial" podem
-- apontar pro mesmo template, ou pra um cada). catalogo_servicos ganha só
-- um ponteiro (template_padrao_id); as colunas antigas
-- catalogo_servicos.tarefas_padrao/fases_execucao ficam pra trás (não são
-- lidas nem escritas pela UI a partir desta sprint) — não são apagadas
-- agora pra não destruir histórico à toa.
--
-- servicos.template_id / servicos.proposta_id: colunas preparatórias pra
-- Sprint 13.9 (aplicar um template na criação do serviço; agrupar N
-- serviços do mesmo cliente numa única proposta com valores somados) — sem
-- uso na UI ainda nesta sprint, mas baratas de já deixar prontas.

-- ── 1. categorias_servico ─────────────────────────────────────────────────

create table if not exists public.categorias_servico (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  nome         text not null,
  ordem        int not null default 0,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.categorias_servico enable row level security;

create policy "categorias_servico_select" on public.categorias_servico
  for select to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'visualizar')
  );

create policy "categorias_servico_insert" on public.categorias_servico
  for insert to authenticated
  with check (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'criar')
  );

create policy "categorias_servico_update" on public.categorias_servico
  for update to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'editar')
  )
  with check (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'editar')
  );

create policy "categorias_servico_delete" on public.categorias_servico
  for delete to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'excluir')
  );

create trigger categorias_servico_auto_workspace
  before insert on public.categorias_servico
  for each row execute function public.auto_set_workspace_id();

-- ── 2. templates_servico ──────────────────────────────────────────────────

create table if not exists public.templates_servico (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  nome            text not null,
  descricao       text,
  fases_execucao  jsonb not null default '[]'::jsonb,
  tarefas_padrao  jsonb not null default '[]'::jsonb,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.templates_servico enable row level security;

create policy "templates_servico_select" on public.templates_servico
  for select to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'visualizar')
  );

create policy "templates_servico_insert" on public.templates_servico
  for insert to authenticated
  with check (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'criar')
  );

create policy "templates_servico_update" on public.templates_servico
  for update to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'editar')
  )
  with check (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'editar')
  );

create policy "templates_servico_delete" on public.templates_servico
  for delete to authenticated
  using (
    workspace_id = public.get_my_workspace_id()
    and public.has_permission('servicos-tecnicos', 'excluir')
  );

create trigger templates_servico_auto_workspace
  before insert on public.templates_servico
  for each row execute function public.auto_set_workspace_id();

create trigger templates_servico_updated_at
  before update on public.templates_servico
  for each row execute procedure public.set_updated_at();

-- ── 3. catalogo_servicos ganha os dois ponteiros novos ────────────────────

alter table public.catalogo_servicos
  add column if not exists categoria_id uuid references public.categorias_servico(id),
  add column if not exists template_padrao_id uuid references public.templates_servico(id);

-- ── 4. servicos: colunas preparatórias pra Sprint 13.9 ────────────────────

alter table public.servicos
  add column if not exists template_id uuid references public.templates_servico(id),
  add column if not exists proposta_id uuid;

-- ── 5. Backfill: catálogo com checklist/fases antigos ganha um Template ───
-- Sem isso, todo item de catálogo que já tinha tarefas_padrao/fases_execucao
-- preenchidos (ex: "Projeto Eletrico", configurado e testado antes desta
-- sprint) ficaria com a aba Tarefas vazia, porque a leitura passa a vir do
-- template ligado, não mais da própria linha do catálogo.

DO $$
DECLARE
  v_cat RECORD;
  v_template_id uuid;
BEGIN
  FOR v_cat IN
    SELECT id, workspace_id, nome, tarefas_padrao, fases_execucao
    FROM public.catalogo_servicos
    WHERE template_padrao_id IS NULL
      AND (tarefas_padrao <> '[]'::jsonb OR fases_execucao <> '[]'::jsonb)
  LOOP
    INSERT INTO public.templates_servico (workspace_id, nome, tarefas_padrao, fases_execucao)
    VALUES (v_cat.workspace_id, v_cat.nome, v_cat.tarefas_padrao, v_cat.fases_execucao)
    RETURNING id INTO v_template_id;

    UPDATE public.catalogo_servicos
    SET template_padrao_id = v_template_id
    WHERE id = v_cat.id;
  END LOOP;
END $$;
