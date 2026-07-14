-- 042: Sprint 9 (Etapa 9) — status de acesso do workspace, pro middleware
-- decidir bloquear ou não. Contrato pedido no ticket:
--   ACTIVE/TRIALING → acesso liberado
--   PAST_DUE        → alerta de pagamento (não bloqueia)
--   CANCELED/EXPIRED → bloqueio
--
-- Cuidado crítico aqui: TODO workspace criado ANTES desta sprint (inclusive
-- o workspace real de produção que está em uso agora) não tem nenhuma
-- linha em subscriptions — se a regra fosse "bloqueia quando não há
-- assinatura", isso trancaria todo cliente existente pra fora do próprio
-- sistema no exato momento em que esta migration rodasse. Por isso "sem
-- nenhuma assinatura" = 'ok' (mesmo tratamento de sempre), nunca 'blocked'.
-- Bloqueio só acontece com um status EXPLÍCITO canceled/expired.
--
-- Pega a assinatura mais RECENTE (created_at desc), não "existe alguma
-- cancelada" — um workspace pode ter uma linha canceled antiga e uma
-- active nova (resubscribe), e must valer a mais nova.
--
-- workspaces.ativo (coluna que já existia, nunca foi de fato aplicada em
-- nenhum guard até agora — achado na auditoria desta sprint) vira o
-- kill-switch manual do painel admin (Etapa 7): suspender = ativo=false,
-- checado aqui antes até da assinatura.
--
-- SECURITY DEFINER + só usa get_my_workspace_id() (sem parâmetro), então
-- qualquer usuário autenticado pode chamar via supabase.rpc(), mesmo quem
-- não tem has_permission('configuracoes','visualizar') — todo mundo no
-- workspace precisa saber se a conta está bloqueada, não só CEO/Gerente.

CREATE OR REPLACE FUNCTION public.get_workspace_access_status()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID := public.get_my_workspace_id();
  v_ativo BOOLEAN;
  v_status TEXT;
BEGIN
  IF v_workspace_id IS NULL THEN
    RETURN 'ok'; -- ainda sem workspace (onboarding) — não é assunto desta função
  END IF;

  SELECT ativo INTO v_ativo FROM public.workspaces WHERE id = v_workspace_id;
  IF v_ativo IS FALSE THEN
    RETURN 'blocked';
  END IF;

  SELECT status INTO v_status
  FROM public.subscriptions
  WHERE workspace_id = v_workspace_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN 'ok';
  ELSIF v_status IN ('canceled', 'expired') THEN
    RETURN 'blocked';
  ELSIF v_status = 'past_due' THEN
    RETURN 'past_due';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;
