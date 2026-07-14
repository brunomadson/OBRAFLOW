-- 041: Sprint 9 (Etapa 7) — administração interna do SaaS
--
-- "Cliente SaaS ≠ Usuário interno" (ticket). Um CEO de workspace só
-- enxerga o próprio workspace (RLS de sempre). Quem administra TODOS os
-- clientes (listar, trocar plano, ativar manualmente, suspender) precisa
-- de um conceito novo, fora do RBAC por workspace — daí esta tabela.
--
-- Decisão de segurança: NENHUMA policy de RLS libera leitura/escrita
-- cross-tenant pra "authenticated" (nem em saas_admins, nem — em nenhuma
-- migration desta sprint — em subscriptions/workspaces). Depois do
-- incidente real do historico_all (RLS manual com USING(true) that
-- silenciosamente anulou isolamento inteiro de uma tabela), a rota mais
-- segura pra "ver todos os workspaces" é NÃO ter policy nenhuma de RLS
-- pra isso — as rotas /api/admin/* usam a service role (que ignora RLS
-- por definição, sempre existiu, não é uma superfície nova) e cada rota
-- confere is_saas_admin() no início, antes de tocar em qualquer dado.
--
-- Sem policy nenhuma para "authenticated" nesta tabela = RLS nega tudo por
-- padrão (comportamento padrão do Postgres com RLS habilitada e nenhuma
-- policy correspondente). is_saas_admin() é SECURITY DEFINER, então
-- consegue ler saas_admins mesmo sem policy — mesmo padrão já usado em
-- has_permission()/get_my_workspace_id().

CREATE TABLE public.saas_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_admins ENABLE ROW LEVEL SECURITY;
-- Propositalmente sem nenhuma CREATE POLICY aqui.

CREATE OR REPLACE FUNCTION public.is_saas_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = auth.uid());
$$;

-- Bootstrap do primeiro admin interno. Ajuste o e-mail abaixo antes de
-- rodar se não for este — sem isso, ninguém consegue entrar em /admin
-- (não há como se auto-promover, é proposital). Idempotente/seguro rodar
-- mesmo se o usuário ainda não existir (não faz nada nesse caso).
INSERT INTO public.saas_admins (user_id, nome)
SELECT id, 'Owner ObraFlow'
FROM auth.users
WHERE email = 'concretize.eng.contato@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
