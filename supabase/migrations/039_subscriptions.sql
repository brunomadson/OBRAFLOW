-- 039: Sprint 9 (Etapa 2) — Motor de assinatura, desacoplado de gateway
--
-- Camada nova (não existia nada de billing/subscription antes desta
-- migration — confirmado por auditoria em toda a base de código e
-- migrations). Reaproveita o que já existe:
--   - public.planos (migration 024) como catálogo de planos — plan_id
--     aponta pra lá, não criei uma tabela de planos paralela.
--   - public.get_my_workspace_id() / public.has_permission() (migrations
--     013/027) para RLS, mesmo padrão de toda tabela administrativa.
--   - public.set_updated_at() (já usada em workspace_integracoes etc.)
--
-- Por que não usar workspaces.plano_id (que já existe, migration 024)?
-- Aquela coluna é só uma FK simples, sem status/vigência/histórico — não
-- dá pra saber se o plano está ativo, em trial, atrasado ou cancelado, e
-- não guarda o vínculo com o gateway (obrigatório pro webhook encontrar a
-- assinatura certa quando o evento chegar). subscriptions passa a ser a
-- fonte de verdade sobre "o workspace X está pagando o plano Y, nesse
-- status, atualizado por esse gateway"; workspaces.plano_id fica
-- deprecated (não removido, sem uso — ver nota no relatório da sprint).
--
-- Sem trigger de auto_set_workspace_id: diferente das tabelas que um
-- usuário logado cria dentro do próprio workspace, uma subscription é
-- sempre criada de fora (webhook do gateway ou painel administrativo
-- interno do SaaS), então workspace_id vem explícito de quem está
-- inserindo, não da sessão de quem está logado.
--
-- RLS: só SELECT pra quem já tem has_permission('configuracoes',
-- 'visualizar') no próprio workspace (reaproveita o setor existente, é
-- exatamente o mesmo grupo — CEO/Gerente — que hoje vê o resto da área
-- administrativa; não criei um setor "assinatura" novo pra isso, seria
-- duplicar RBAC pra um caso que já cai dentro de "configurações do
-- workspace"). Não existe policy de INSERT/UPDATE/DELETE pra
-- "authenticated": toda escrita nesta tabela vem do backend (webhook de
-- pagamento ou painel admin interno), que usa a service role e por isso
-- ignora RLS — é a mesma lógica de segurança já usada pra
-- planos/integracoes/plano_integracoes (só SELECT liberado ao client).

CREATE TABLE public.subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id                  UUID NOT NULL REFERENCES public.planos(id),
  gateway_provider         TEXT NOT NULL,
  gateway_customer_id      TEXT,
  gateway_subscription_id  TEXT,
  status                   TEXT NOT NULL DEFAULT 'trialing'
                              CHECK (status IN ('active','trialing','past_due','canceled','expired')),
  trial_start              TIMESTAMPTZ,
  subscription_start       TIMESTAMPTZ,
  next_billing_date        TIMESTAMPTZ,
  canceled_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um workspace só pode ter 1 assinatura "em vigor" por vez (active/
-- trialing/past_due) — resubscribe depois de canceled/expired cria uma
-- linha nova, mantendo histórico em vez de sobrescrever.
CREATE UNIQUE INDEX subscriptions_one_current_per_workspace
  ON public.subscriptions (workspace_id)
  WHERE status IN ('active','trialing','past_due');

-- Índice pra localizar a assinatura pelo id do gateway quando o webhook
-- chega (permite múltiplos NULL — nem toda linha tem gateway_subscription_id,
-- ex. ativação manual pelo admin interno).
CREATE UNIQUE INDEX subscriptions_gateway_subscription_id_key
  ON public.subscriptions (gateway_provider, gateway_subscription_id)
  WHERE gateway_subscription_id IS NOT NULL;

CREATE INDEX subscriptions_workspace_id_idx ON public.subscriptions (workspace_id);
CREATE INDEX subscriptions_status_idx ON public.subscriptions (status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('configuracoes', 'visualizar'));

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
