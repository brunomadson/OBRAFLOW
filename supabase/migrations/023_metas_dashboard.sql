-- 023: Metas de dashboard (Comercial, Obras, Financeiro) por workspace
--
-- Uma linha por indicador + período (mês "YYYY-MM"). As dashboards buscam
-- só a linha do mês atual; a tela de Configurações > Metas edita essa
-- mesma linha (cria se ainda não existir).

create table if not exists public.metas_dashboard (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  indicador   text not null,
  periodo     text not null,
  valor_meta  numeric(14,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (workspace_id, indicador, periodo)
);

alter table public.metas_dashboard enable row level security;

create policy "metas_dashboard_workspace" on public.metas_dashboard
  for all to authenticated
  using (workspace_id = public.get_my_workspace_id())
  with check (workspace_id = public.get_my_workspace_id());

create trigger metas_dashboard_auto_workspace
  before insert on public.metas_dashboard
  for each row execute function public.auto_set_workspace_id();

create trigger metas_dashboard_updated_at
  before update on public.metas_dashboard
  for each row execute procedure public.set_updated_at();
