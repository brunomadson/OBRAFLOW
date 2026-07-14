-- 043: Sprint 11.1 (Etapas 1, 3, 4) — arquitetura de integrações pra SaaS
--
-- Estende as tabelas já existentes (integracoes/workspace_integracoes,
-- migration 024) em vez de criar integration_providers/workspace_integrations
-- paralelas — o ticket sugeriu esses nomes em inglês como exemplo, mas o
-- formato já existente cobre a mesma coisa (catálogo + estado por
-- workspace); duplicar seria exatamente o "sistema paralelo" que este
-- projeto tem evitado em toda sprint anterior (RBAC, billing). Nenhum dado
-- existente é removido — só ALTER TABLE (adiciona colunas) e um INSERT de
-- log novo.
--
-- ── 1. integracoes: catálogo mais rico ──────────────────────────────────────
-- provider   = vendor técnico (google, meta, openai...) — agrupa integrações
--              do mesmo fornecedor pra reuso de config OAuth/API key.
-- categoria  = agrupamento de UI (produtividade, comunicacao, ia, financeiro).
-- tipo_acesso = 'essential' (sempre disponível, em qualquer plano, presente
--              ou futuro — não depende de nenhuma linha em plano_integracoes)
--              ou 'premium' (segue a regra de sempre: plano_integracoes).
--              codigo já funciona como slug (valores como 'google_drive'),
--              não precisei adicionar uma coluna slug redundante.

ALTER TABLE public.integracoes
  ADD COLUMN provider TEXT,
  ADD COLUMN categoria TEXT,
  ADD COLUMN tipo_acesso TEXT NOT NULL DEFAULT 'premium' CHECK (tipo_acesso IN ('essential', 'premium'));

UPDATE public.integracoes SET provider = 'google', categoria = 'produtividade', tipo_acesso = 'essential' WHERE codigo IN ('google_drive', 'google_agenda');
UPDATE public.integracoes SET provider = 'meta', categoria = 'comunicacao' WHERE codigo = 'whatsapp';
UPDATE public.integracoes SET categoria = 'ia' WHERE codigo = 'ia';
UPDATE public.integracoes SET categoria = 'financeiro' WHERE codigo = 'open_finance';
UPDATE public.integracoes SET categoria = 'dados' WHERE codigo = 'importacao_externa';

-- Google Drive/Calendar ficam disponíveis em TODOS os planos (ticket) — o
-- básico hoje só tinha google_drive liberado (migration 024), faltava
-- google_agenda. Ainda mantemos a linha em plano_integracoes por
-- consistência de dado (relatório/auditoria), mas a checagem de
-- disponibilidade real pra 'essential' passa a ignorar isso (ver
-- has_feature() atualizada abaixo) — assim uma integração essential nunca
-- fica indisponível por esquecerem de marcar disponivel=true num plano novo.
INSERT INTO public.plano_integracoes (plano_id, integracao_id, disponivel)
SELECT p.id, i.id, true
FROM public.planos p CROSS JOIN public.integracoes i
WHERE i.codigo IN ('google_drive', 'google_agenda')
ON CONFLICT (plano_id, integracao_id) DO UPDATE SET disponivel = true;

-- ── 2. workspace_integracoes: conexão de verdade ────────────────────────────
-- connected_by          = quem clicou em "conectar" (auditoria).
-- credentials_encrypted = blob opaco (AES-256-GCM, cifrado em código, nunca
--                          no banco em texto claro) — token OAuth, refresh
--                          token etc. Ver 'Bloqueio de coluna' abaixo.
-- settings               = config específica da integração (JSON livre por
--                          provider — ex. pasta padrão do Drive).
-- last_sync              = última sincronização bem-sucedida.
-- status ganha 'erro' — conexão existe mas a última tentativa falhou
-- (token expirado, revogado no lado do provedor etc.), diferente de nunca
-- ter conectado.

ALTER TABLE public.workspace_integracoes
  ADD COLUMN connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN credentials_encrypted TEXT,
  ADD COLUMN settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN last_sync TIMESTAMPTZ;

ALTER TABLE public.workspace_integracoes DROP CONSTRAINT IF EXISTS workspace_integracoes_status_check;
ALTER TABLE public.workspace_integracoes ADD CONSTRAINT workspace_integracoes_status_check
  CHECK (status IN ('nao_conectado', 'conectado', 'erro'));

-- Bloqueio de coluna: mesmo que algum código do client (por engano) tente
-- `.select('*')` nesta tabela pelo navegador, o Postgres recusa devolver
-- credentials_encrypted pros papéis authenticated/anon — defesa em
-- profundidade, não depende só de "ninguém esquecer" de excluir a coluna
-- na query. Só service_role (que ignora GRANT/REVOKE) consegue ler.
REVOKE SELECT (credentials_encrypted) ON public.workspace_integracoes FROM authenticated, anon;

-- Escrita deixa de ser permitida pro client autenticado (a partir de
-- agora, "conectar" de verdade é OAuth — só as rotas /api/integrations/*,
-- rodando com service_role, gravam aqui). Antes desta sprint, INSERT/
-- UPDATE direto do client era como o "conectar" (falso, sem credencial
-- real) funcionava — deixar essa porta aberta agora permitiria um usuário
-- forjar status='conectado' sem nunca ter passado pelo OAuth de verdade,
-- e escrever lixo em credentials_encrypted (não conseguiria LER de volta,
-- mas conseguiria escrever). Mesmo padrão de segurança já usado em
-- subscriptions (Sprint 9): só SELECT pro client, resto é só backend.
DROP POLICY IF EXISTS "workspace_integracoes_insert" ON public.workspace_integracoes;
DROP POLICY IF EXISTS "workspace_integracoes_update" ON public.workspace_integracoes;
DROP POLICY IF EXISTS "workspace_integracoes_delete" ON public.workspace_integracoes;

-- ── 3. Logs de conexão/sincronização ────────────────────────────────────────
-- workspace_id duplicado aqui de propósito (em vez de só JOIN via
-- workspace_integracao_id) — deixa a policy de RLS direta, sem subquery,
-- mesmo padrão já usado em documentos/lead_log/obra_log.

CREATE TABLE public.workspace_integration_logs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workspace_integracao_id  UUID NOT NULL REFERENCES public.workspace_integracoes(id) ON DELETE CASCADE,
  evento                   TEXT NOT NULL CHECK (evento IN ('conectado', 'desconectado', 'erro', 'sync_iniciado', 'sync_concluido', 'sync_falhou')),
  detalhe                  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workspace_integration_logs_workspace_id_idx ON public.workspace_integration_logs (workspace_id);
CREATE INDEX workspace_integration_logs_workspace_integracao_id_idx ON public.workspace_integration_logs (workspace_integracao_id);

ALTER TABLE public.workspace_integration_logs ENABLE ROW LEVEL SECURITY;

-- Mesma regra de acesso de workspace_integracoes (setor 'integracoes', já
-- existente desde a migration 033). Sem policy de INSERT/UPDATE/DELETE pra
-- authenticated — quem escreve é sempre o backend (rotas /api/integrations/*),
-- é log de auditoria, não deve dar pra um usuário comum apagar o próprio rastro.
CREATE POLICY "workspace_integration_logs_select" ON public.workspace_integration_logs
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('integracoes', 'visualizar'));

-- ── 4. has_feature() — 'essential' ignora plano_integracoes ─────────────────
-- CREATE OR REPLACE, não uma função nova — evolução da mesma função da
-- Sprint 9 (migration 040), só adiciona o atalho de 'essential' antes da
-- regra por plano. Precisa ser recriada aqui (não editar 040 direto — já
-- está em produção) porque migrations já aplicadas nunca são alteradas
-- retroativamente neste projeto.
CREATE OR REPLACE FUNCTION public.has_feature(p_workspace_id UUID, p_feature_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_workspace_id = public.get_my_workspace_id()
    AND (
      -- essential: sempre true pra quem já pode acessar o workspace (o
      -- bloqueio de conta cancelada/suspensa já acontece antes disso, no
      -- middleware — get_workspace_access_status()).
      EXISTS (
        SELECT 1 FROM public.integracoes i
        WHERE i.codigo = p_feature_codigo AND i.ativo = true AND i.tipo_acesso = 'essential'
      )
      OR
      -- premium: precisa de assinatura ativa/trial + plano liberar.
      EXISTS (
        SELECT 1
        FROM public.subscriptions s
        JOIN public.plano_integracoes pi ON pi.plano_id = s.plan_id
        JOIN public.integracoes i ON i.id = pi.integracao_id
        WHERE s.workspace_id = p_workspace_id
          AND s.status IN ('active', 'trialing')
          AND i.codigo = p_feature_codigo
          AND i.ativo = true
          AND pi.disponivel = true
      )
    );
$$;
