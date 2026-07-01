-- 007: Tabela de histórico de ações
-- Registra todas as ações relevadas realizadas no sistema por módulo.
-- Esta tabela existia apenas no Supabase Dashboard (criada manualmente).
-- Esta migration a torna rastreável e reproduzível em qualquer ambiente.

CREATE TABLE IF NOT EXISTS public.historico (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID REFERENCES public.leads(id)    ON DELETE CASCADE,
  obra_id      UUID REFERENCES public.obras(id)    ON DELETE CASCADE,
  tipo         TEXT NOT NULL,      -- lead | comercial | obras | documento | medicao | sistema
  acao         TEXT NOT NULL,
  usuario_id   UUID REFERENCES public.profiles(id),
  usuario_nome TEXT NOT NULL DEFAULT '',
  setor        TEXT,
  etapa        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;

-- Política temporária (Sprint 1): qualquer usuário autenticado acessa.
-- Sprint 3 substituirá por isolamento via empresa_id.
CREATE POLICY "historico_authenticated" ON public.historico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices para as queries mais comuns
CREATE INDEX IF NOT EXISTS idx_historico_lead_id  ON public.historico(lead_id)  WHERE lead_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_historico_obra_id  ON public.historico(obra_id)  WHERE obra_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_historico_created  ON public.historico(created_at DESC);
