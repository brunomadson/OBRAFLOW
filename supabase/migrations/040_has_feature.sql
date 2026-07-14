-- 040: Sprint 9 (Etapa 6) — has_feature(): recurso liberado pelo PLANO,
-- separado de has_permission() (que é sobre CARGO do usuário dentro do
-- workspace). São duas perguntas diferentes:
--   has_permission('financeiro','criar')  → "esse USUÁRIO pode criar lançamento?"
--   has_feature(workspace_id, 'whatsapp') → "esse WORKSPACE contratou WhatsApp?"
--
-- Reaproveita 100% do catálogo já existente (migration 024) —
-- plano_integracoes/integracoes já guardam exatamente "o que cada plano
-- libera", só faltava uma função que resolva isso a partir da assinatura
-- ATIVA do workspace (subscriptions, migration 039) em vez de
-- workspaces.plano_id (coluna que nunca chegou a ser preenchida por
-- nenhum fluxo real — plano do workspace agora vem de subscriptions).
--
-- p_workspace_id é obrigatoriamente o do CHAMADOR (comparado contra
-- get_my_workspace_id() dentro da função) — sem essa checagem, qualquer
-- usuário autenticado poderia informar o workspace_id de OUTRO tenant e
-- descobrir quais integrações aquele workspace contratou. Não é dado
-- financeiro, mas é vazamento cross-tenant do mesmo jeito, e não custa
-- nada fechar.

CREATE OR REPLACE FUNCTION public.has_feature(p_workspace_id UUID, p_feature_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.plano_integracoes pi ON pi.plano_id = s.plan_id
    JOIN public.integracoes i ON i.id = pi.integracao_id
    WHERE s.workspace_id = p_workspace_id
      AND p_workspace_id = public.get_my_workspace_id()
      AND s.status IN ('active', 'trialing')
      AND i.codigo = p_feature_codigo
      AND i.ativo = true
      AND pi.disponivel = true
  );
$$;
