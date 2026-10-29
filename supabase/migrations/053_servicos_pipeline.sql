-- 053: Sprint 13.3 — Comercial de Serviços Técnicos
--
-- indicadores: cadastro próprio (decisão confirmada no due-diligence) — não é
-- só corretor, é parceiro/cliente indicando cliente/engenheiro/arquiteto/
-- construtora/contador, então RLS simples por workspace, mesmo padrão de
-- correspondentes/corretores/cidades/contas_bancarias (master data de
-- quick-add, sem granularidade de RBAC).
--
-- servicos: a entidade central do módulo. Aponta pra clientes (Cliente
-- Único, Sprint 13.1) em vez de duplicar nome/cpf/telefone/email — diferente
-- de leads/obras (que carregam esses campos por razões históricas), servico
-- nasce depois do Cliente Único já existir, então não tem motivo pra
-- duplicar. indicador_id + indicador_pct ficam em servicos (não em uma
-- tabela de "proposta" separada) porque hoje não existe entidade Proposta —
-- é só uma etapa dentro do pipeline do próprio servico.
--
-- servico_log espelha lead_log (id, servico_id, etapa, dados_extras,
-- criado_em, criado_por) — mesmo padrão de timeline usado em Lead/Obra.

-- ── 1. indicadores ────────────────────────────────────────────────────────────

create table if not exists public.indicadores (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  nome         text not null,
  telefone     text,
  email        text,
  tipo         text,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.indicadores enable row level security;

create policy "indicadores_workspace" on public.indicadores
  for all to authenticated
  using (workspace_id = public.get_my_workspace_id())
  with check (workspace_id = public.get_my_workspace_id());

create trigger indicadores_auto_workspace
  before insert on public.indicadores
  for each row execute function public.auto_set_workspace_id();

-- ── 2. servicos ───────────────────────────────────────────────────────────────

create table if not exists public.servicos (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid references public.workspaces(id) on delete cascade,
  cliente_id          uuid not null references public.clientes(id),
  catalogo_servico_id uuid references public.catalogo_servicos(id),
  etapa               text not null default 'novo_lead',
  valor_proposta      numeric(12,2),
  indicador_id        uuid references public.indicadores(id),
  indicador_pct       numeric(5,2),
  responsavel_id      uuid references public.profiles(id),
  anotacoes           text,
  tarefas             jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.servicos enable row level security;

create policy "servicos_select" on public.servicos
  for select to authenticated
  using (workspace_id = public.get_my_workspace_id() and public.has_permission('servicos-tecnicos', 'visualizar'));

create policy "servicos_insert" on public.servicos
  for insert to authenticated
  with check (workspace_id = public.get_my_workspace_id() and public.has_permission('servicos-tecnicos', 'criar'));

create policy "servicos_update" on public.servicos
  for update to authenticated
  using (workspace_id = public.get_my_workspace_id() and public.has_permission('servicos-tecnicos', 'editar'))
  with check (workspace_id = public.get_my_workspace_id() and public.has_permission('servicos-tecnicos', 'editar'));

create policy "servicos_delete" on public.servicos
  for delete to authenticated
  using (workspace_id = public.get_my_workspace_id() and public.has_permission('servicos-tecnicos', 'excluir'));

create trigger servicos_auto_workspace
  before insert on public.servicos
  for each row execute function public.auto_set_workspace_id();

create trigger servicos_updated_at
  before update on public.servicos
  for each row execute procedure public.set_updated_at();

-- ── 3. servico_log (filho de servicos, setor: servicos-tecnicos) ─────────────

create table if not exists public.servico_log (
  id           uuid primary key default gen_random_uuid(),
  servico_id   uuid not null references public.servicos(id) on delete cascade,
  etapa        text not null,
  dados_extras jsonb,
  criado_em    timestamptz not null default now(),
  criado_por   uuid references public.profiles(id)
);

alter table public.servico_log enable row level security;

create policy "servico_log_select" on public.servico_log
  for select to authenticated
  using (
    public.has_permission('servicos-tecnicos', 'visualizar')
    and servico_id in (select id from public.servicos where workspace_id = public.get_my_workspace_id())
  );

create policy "servico_log_insert" on public.servico_log
  for insert to authenticated
  with check (
    public.has_permission('servicos-tecnicos', 'editar')
    and servico_id in (select id from public.servicos where workspace_id = public.get_my_workspace_id())
  );

create policy "servico_log_update" on public.servico_log
  for update to authenticated
  using (
    public.has_permission('servicos-tecnicos', 'editar')
    and servico_id in (select id from public.servicos where workspace_id = public.get_my_workspace_id())
  )
  with check (
    public.has_permission('servicos-tecnicos', 'editar')
    and servico_id in (select id from public.servicos where workspace_id = public.get_my_workspace_id())
  );

create policy "servico_log_delete" on public.servico_log
  for delete to authenticated
  using (
    public.has_permission('servicos-tecnicos', 'excluir')
    and servico_id in (select id from public.servicos where workspace_id = public.get_my_workspace_id())
  );
