-- 003: Obras and obra_log tables

create table if not exists public.obras (
  id               uuid primary key default gen_random_uuid(),
  cliente          text not null,
  cpf              text,
  telefone         text,
  cidade           text,
  modalidade       text,
  engenheiro       text,
  pls              text,
  renda_bruta      numeric(12,2) default 0,
  valor_caixa      numeric(12,2) default 0,
  valor_venda      numeric(12,2) default 0,
  valor_subsidio   numeric(12,2) default 0,
  etapa            text not null default 'contrato',
  obs              text,
  data_inicio      date,
  prazo_conclusao  date,
  correspondente_id uuid references public.correspondentes(id),
  lead_id          uuid references public.leads(id),
  responsavel_id   uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.obras enable row level security;
create policy "obras_all" on public.obras
  for all to authenticated using (true) with check (true);

create trigger obras_updated_at before update on public.obras
  for each row execute procedure public.set_updated_at();

create table if not exists public.obra_log (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references public.obras(id) on delete cascade,
  etapa      text not null,
  obs        text,
  user_id    uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.obra_log enable row level security;
create policy "obra_log_all" on public.obra_log
  for all to authenticated using (true) with check (true);

-- Trigger: auto-log on etapa change
create or replace function public.log_obra_etapa()
returns trigger language plpgsql security definer as $$
begin
  if new.etapa <> old.etapa then
    insert into public.obra_log (obra_id, etapa, user_id)
    values (new.id, new.etapa, auth.uid());
  end if;
  return new;
end;
$$;

create trigger obras_log_etapa after update of etapa on public.obras
  for each row execute procedure public.log_obra_etapa();
