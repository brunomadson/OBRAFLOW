-- 051: Sprint 13.1 — Fundação do módulo Serviços Técnicos: Cliente Único
--
-- Hoje leads/obras guardam nome/cpf/telefone/email duplicados em cada
-- linha — não existe forma de saber se "José" do lead de 2024 é o mesmo
-- "José" do lead de 2025. Essa tabela é a base para histórico cruzado e
-- LTV, tanto de Obras quanto do futuro módulo de Serviços Técnicos.
--
-- cliente_id em leads/obras é NULLABLE de propósito: o backfill (script à
-- parte, dry-run → --commit) só liga um registro a um cliente existente
-- quando cpf/email/telefone realmente batem — nunca força um match
-- arriscado. Sem nenhum dado suficiente pra cruzar, cria cliente novo.
-- Nenhum cliente existente é alterado por esse processo.

create table if not exists public.clientes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  nome         text not null,
  cpf_cnpj     text,
  telefone     text,
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Único por workspace só quando preenchido (permite múltiplos clientes
-- sem CPF ainda cadastrado, sem violar unicidade).
create unique index if not exists clientes_cpf_cnpj_workspace_idx
  on public.clientes (workspace_id, cpf_cnpj)
  where cpf_cnpj is not null;

alter table public.clientes enable row level security;

create policy "clientes_select" on public.clientes
  for select to authenticated
  using (workspace_id = public.get_my_workspace_id());

create policy "clientes_insert" on public.clientes
  for insert to authenticated
  with check (workspace_id = public.get_my_workspace_id());

create policy "clientes_update" on public.clientes
  for update to authenticated
  using (workspace_id = public.get_my_workspace_id())
  with check (workspace_id = public.get_my_workspace_id());

create trigger clientes_auto_workspace
  before insert on public.clientes
  for each row execute function public.auto_set_workspace_id();

create trigger clientes_updated_at
  before update on public.clientes
  for each row execute procedure public.set_updated_at();

alter table public.leads
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

alter table public.obras
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;
