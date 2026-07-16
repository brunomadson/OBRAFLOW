-- 046: Contas bancárias (Financeiro)
--
-- Empresas com múltiplos bancos/carteiras (conta corrente, dinheiro, cartão de
-- crédito etc.) precisam saber por onde cada lançamento passou. Campo opcional
-- em lancamentos — não é obrigatório preencher.

create table if not exists public.contas_bancarias (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  nome         text not null,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, nome)
);

alter table public.contas_bancarias enable row level security;

create policy "contas_bancarias_workspace" on public.contas_bancarias
  for all to authenticated
  using (workspace_id = public.get_my_workspace_id())
  with check (workspace_id = public.get_my_workspace_id());

create trigger contas_bancarias_auto_workspace
  before insert on public.contas_bancarias
  for each row execute function public.auto_set_workspace_id();

create trigger contas_bancarias_updated_at
  before update on public.contas_bancarias
  for each row execute procedure public.set_updated_at();

-- ── Vínculo em lancamentos (opcional) ─────────────────────────────────────────

alter table public.lancamentos
  add column if not exists conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null;
