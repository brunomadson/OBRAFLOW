-- 001: Auth setup and profiles table

create table if not exists public.profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text,
  cargo     text,
  setor     text,
  ativo     boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Authenticated users can read all profiles
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

-- Users can update their own profile; admins can update any
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Trigger: create profile row on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, new.raw_user_meta_data->>'nome');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
