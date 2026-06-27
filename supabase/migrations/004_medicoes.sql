-- 004: Medicoes table

create table if not exists public.medicoes (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references public.obras(id) on delete cascade,
  numero_medicao   integer not null,
  valor            numeric(12,2) not null default 0,
  status           text not null default 'pendente',   -- pendente | enviada | pago
  data_envio       date,
  data_vencimento  date,
  obs              text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (obra_id, numero_medicao)
);

alter table public.medicoes enable row level security;
create policy "medicoes_all" on public.medicoes
  for all to authenticated using (true) with check (true);

create trigger medicoes_updated_at before update on public.medicoes
  for each row execute procedure public.set_updated_at();
