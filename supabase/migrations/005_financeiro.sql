-- 005: Lancamentos and config tables

create table if not exists public.lancamentos (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  valor       numeric(12,2) not null,
  tipo        text not null,    -- entrada | saida | comissao | imposto
  data        date not null,
  obs         text,
  obra_id     uuid references public.obras(id),
  user_id     uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

alter table public.lancamentos enable row level security;
create policy "lancamentos_all" on public.lancamentos
  for all to authenticated using (true) with check (true);

-- Config/Prazos (single-row table)
create table if not exists public.config (
  id                              uuid primary key default gen_random_uuid(),
  prazo_analise_credito           integer not null default 30,
  prazo_doc_parada                integer not null default 15,
  prazo_projeto_atrasado          integer not null default 30,
  prazo_pls_sem_retorno           integer not null default 10,
  prazo_pls_intervalo             integer not null default 45,
  prazo_laudo_atraso              integer not null default 20,
  prazo_previsao_termino          integer not null default 7,
  prazo_pagamento_vencido         integer not null default 0,
  prazo_contrato_parado           integer not null default 20,
  prazo_visita_tecnica            integer not null default 15,
  prazo_reuniao_sem_retorno       integer not null default 7,
  prazo_docs_incompletos          integer not null default 10,
  prazo_sem_atividade_lead        integer not null default 20,
  prazo_sem_atividade_obra        integer not null default 15,
  prazo_medicao_pendente          integer not null default 10,
  prazo_etapa_longa               integer not null default 60,
  prazo_doc_obra_parada           integer not null default 10,
  prazo_vistoria_atraso           integer not null default 7,
  prazo_habite_se                 integer not null default 30,
  prazo_registro_atraso           integer not null default 20,
  prazo_pos_entrega               integer not null default 90,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

alter table public.config enable row level security;
create policy "config_select" on public.config for select to authenticated using (true);
create policy "config_insert" on public.config for insert to authenticated with check (true);
create policy "config_update" on public.config for update to authenticated using (true);

create trigger config_updated_at before update on public.config
  for each row execute procedure public.set_updated_at();
