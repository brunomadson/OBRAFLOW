-- 048: Sprint 12 (Fase 2) — Recebimentos
--
-- Resolve a diferença entre "Caixa liberou pro cliente" (medicoes) e
-- "a construtora recebeu de fato" (aqui). Uma medição pode ser liberada em
-- 1 valor e repassada em várias parcelas ao longo do tempo — cada parcela
-- vira 1 linha aqui, e cada linha gera 1 lançamento real (pago) no
-- Financeiro na hora. O Financeiro nunca reflete o valor liberado, só o
-- que realmente entrou no caixa da empresa.
--
-- Generalizado pra também cobrir repasse de Recursos Próprios (parcelas
-- pagas pelo próprio cliente, fora do financiamento) — mesma mecânica,
-- só muda a origem e a meta contra a qual o saldo é calculado:
--   origem_tipo='medicao'           -> meta = medicoes.valor_liberado
--   origem_tipo='recursos_proprios' -> meta = obras.recursos_proprios

create table if not exists public.recebimentos (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid references public.workspaces(id) on delete cascade,
  obra_id        uuid not null references public.obras(id) on delete cascade,
  origem_tipo    text not null check (origem_tipo in ('medicao', 'recursos_proprios')),
  medicao_id     uuid references public.medicoes(id) on delete set null,
  lancamento_id  uuid references public.lancamentos(id) on delete set null,
  valor          numeric(12,2) not null check (valor > 0),
  data           date not null,
  forma_pagamento text,
  obs            text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id)
);

-- medicao_id só faz sentido (e é obrigatório) quando a origem é 'medicao'.
alter table public.recebimentos
  add constraint recebimentos_medicao_id_check
  check (
    (origem_tipo = 'medicao' and medicao_id is not null)
    or (origem_tipo = 'recursos_proprios' and medicao_id is null)
  );

create index if not exists recebimentos_obra_id_idx on public.recebimentos(obra_id);
create index if not exists recebimentos_medicao_id_idx on public.recebimentos(medicao_id);

alter table public.recebimentos enable row level security;

-- Mesmo padrão RBAC de lancamentos (migration 030) — recebimento só existe
-- pra gerar lançamento real, então usa a permissão de 'financeiro'.
create policy "recebimentos_select" on public.recebimentos
  for select to authenticated
  using (workspace_id = public.get_my_workspace_id() and public.has_permission('financeiro', 'visualizar'));

create policy "recebimentos_insert" on public.recebimentos
  for insert to authenticated
  with check (workspace_id = public.get_my_workspace_id() and public.has_permission('financeiro', 'criar'));

create policy "recebimentos_update" on public.recebimentos
  for update to authenticated
  using (workspace_id = public.get_my_workspace_id() and public.has_permission('financeiro', 'editar'))
  with check (workspace_id = public.get_my_workspace_id() and public.has_permission('financeiro', 'editar'));

create policy "recebimentos_delete" on public.recebimentos
  for delete to authenticated
  using (workspace_id = public.get_my_workspace_id() and public.has_permission('financeiro', 'excluir'));

create trigger recebimentos_auto_workspace
  before insert on public.recebimentos
  for each row execute function public.auto_set_workspace_id();
