-- 002: Leads and lead_log tables

create table if not exists public.correspondentes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  contato    text,
  banco      text,
  ativo      boolean not null default true,
  obs        text,
  created_at timestamptz not null default now()
);

alter table public.correspondentes enable row level security;
create policy "correspondentes_all" on public.correspondentes
  for all to authenticated using (true) with check (true);

create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  cpf              text,
  telefone         text,
  cidade           text,
  origem           text,
  tipo_renda       text,
  modalidade       text,
  renda_bruta      numeric(12,2) default 0,
  valor_caixa      numeric(12,2) default 0,
  valor_venda      numeric(12,2) default 0,
  valor_subsidio   numeric(12,2) default 0,
  com_conjuge      boolean default false,
  dependente       boolean default false,
  fgts_3anos       boolean default false,
  etapa            text not null default 'leads',
  obs              text,
  pls              text,
  data_contato     text,
  data_reuniao     text,
  local_reuniao    text,
  data_analise     text,
  correspondente_id uuid references public.correspondentes(id),
  responsavel_id   uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.leads enable row level security;
create policy "leads_all" on public.leads
  for all to authenticated using (true) with check (true);

create trigger leads_updated_at before update on public.leads
  for each row execute procedure public.set_updated_at();

create table if not exists public.lead_log (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  etapa      text not null,
  obs        text,
  user_id    uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.lead_log enable row level security;
create policy "lead_log_all" on public.lead_log
  for all to authenticated using (true) with check (true);

-- Trigger: auto-log on etapa change
create or replace function public.log_lead_etapa()
returns trigger language plpgsql security definer as $$
begin
  if new.etapa <> old.etapa then
    insert into public.lead_log (lead_id, etapa, user_id)
    values (new.id, new.etapa, auth.uid());
  end if;
  return new;
end;
$$;

create trigger leads_log_etapa after update of etapa on public.leads
  for each row execute procedure public.log_lead_etapa();
