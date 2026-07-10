-- 024: Central de Integrações — catálogo por plano + estado de conexão por workspace
--
-- A estrutura sugerida no ticket (integracoes + plano_integracoes) cobre o
-- CATÁLOGO (o que existe, o que cada plano libera), mas não tem como saber
-- se um workspace específico já conectou uma integração — dois clientes no
-- mesmo plano podem ter estados diferentes (um já conectou WhatsApp, outro
-- não). Por isso adicionei uma 3ª tabela (workspace_integracoes) e a coluna
-- workspaces.plano_id, que também não existia (não havia conceito de plano
-- no banco antes disso).

-- ── 1. Planos ────────────────────────────────────────────────────────────────
create table if not exists public.planos (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,
  nome       text not null,
  created_at timestamptz not null default now()
);

alter table public.planos enable row level security;
create policy "planos_select" on public.planos for select to authenticated using (true);

insert into public.planos (codigo, nome) values
  ('basico', 'Básico'),
  ('profissional', 'Profissional'),
  ('premium', 'Premium')
on conflict (codigo) do nothing;

-- ── 2. Integrações (catálogo do produto) ────────────────────────────────────
create table if not exists public.integracoes (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nome        text not null,
  descricao   text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.integracoes enable row level security;
create policy "integracoes_select" on public.integracoes for select to authenticated using (true);

insert into public.integracoes (codigo, nome, descricao) values
  ('whatsapp',            'WhatsApp Business',              'Integração para comunicação automática com clientes e equipe.'),
  ('google_drive',        'Google Drive',                   'Integração para gerenciamento de documentos.'),
  ('google_agenda',       'Google Agenda',                  'Integração para gerenciamento de compromissos.'),
  ('ia',                  'Inteligência Artificial',        'Recursos inteligentes do ObraFlow.'),
  ('open_finance',        'Open Finance',                   'Integração financeira avançada. (futuro)'),
  ('importacao_externa',  'Importação de Sistemas Externos','Migração de dados de outras plataformas. (futuro)')
on conflict (codigo) do nothing;

-- ── 3. O que cada plano libera ───────────────────────────────────────────────
create table if not exists public.plano_integracoes (
  plano_id      uuid not null references public.planos(id) on delete cascade,
  integracao_id uuid not null references public.integracoes(id) on delete cascade,
  disponivel    boolean not null default true,
  primary key (plano_id, integracao_id)
);

alter table public.plano_integracoes enable row level security;
create policy "plano_integracoes_select" on public.plano_integracoes for select to authenticated using (true);

-- Planos cumulativos: Profissional inclui o do Básico, Premium inclui o do Profissional.
insert into public.plano_integracoes (plano_id, integracao_id, disponivel)
select p.id, i.id, true
from public.planos p
cross join public.integracoes i
where
  (p.codigo = 'basico'       and i.codigo in ('google_drive'))
  or (p.codigo = 'profissional' and i.codigo in ('google_drive', 'whatsapp', 'google_agenda'))
  or (p.codigo = 'premium'      and i.codigo in ('google_drive', 'whatsapp', 'google_agenda', 'ia', 'open_finance', 'importacao_externa'))
on conflict (plano_id, integracao_id) do nothing;

-- ── 4. Plano do workspace ────────────────────────────────────────────────────
alter table public.workspaces
  add column if not exists plano_id uuid references public.planos(id);

-- ── 5. Estado de conexão por workspace ───────────────────────────────────────
create table if not exists public.workspace_integracoes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  integracao_id uuid not null references public.integracoes(id) on delete cascade,
  status        text not null default 'nao_conectado' check (status in ('nao_conectado', 'conectado')),
  conectado_em  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, integracao_id)
);

alter table public.workspace_integracoes enable row level security;

create policy "workspace_integracoes_workspace" on public.workspace_integracoes
  for all to authenticated
  using (workspace_id = public.get_my_workspace_id())
  with check (workspace_id = public.get_my_workspace_id());

create trigger workspace_integracoes_auto_workspace
  before insert on public.workspace_integracoes
  for each row execute function public.auto_set_workspace_id();

create trigger workspace_integracoes_updated_at
  before update on public.workspace_integracoes
  for each row execute procedure public.set_updated_at();
