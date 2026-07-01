-- 013: Funções auxiliares para RLS com isolamento por workspace
--
-- FUNÇÃO 1: get_my_workspace_id()
--   Retorna o workspace_id do usuário autenticado atual.
--   STABLE + SECURITY DEFINER: PostgreSQL cacheia o resultado dentro da transação,
--   evitando múltiplas leituras na tabela profiles por query (performance crítica em RLS).
--   SET search_path = public: boa prática de segurança em funções SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.get_my_workspace_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.profiles
  WHERE id = auth.uid()
$$;

-- FUNÇÃO 2: auto_set_workspace_id()
--   Trigger BEFORE INSERT que auto-preenche workspace_id quando NULL.
--   Garante que mesmo código antigo (que não passa workspace_id) crie registros
--   corretamente isolados. O trigger dispara ANTES do RLS WITH CHECK,
--   portanto o valor já está correto quando a policy verifica.

CREATE OR REPLACE FUNCTION public.auto_set_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    NEW.workspace_id := public.get_my_workspace_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ── Triggers nas tabelas que já têm workspace_id (Sprint 2.3) ────────────────

CREATE OR REPLACE TRIGGER leads_auto_workspace
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

CREATE OR REPLACE TRIGGER obras_auto_workspace
  BEFORE INSERT ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

CREATE OR REPLACE TRIGGER lancamentos_auto_workspace
  BEFORE INSERT ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

CREATE OR REPLACE TRIGGER documentos_auto_workspace
  BEFORE INSERT ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();

CREATE OR REPLACE TRIGGER historico_auto_workspace
  BEFORE INSERT ON public.historico
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_workspace_id();
