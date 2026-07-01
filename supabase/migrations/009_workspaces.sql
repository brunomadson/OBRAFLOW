-- 009: Tabela workspaces — base do multitenancy
--
-- Representa o "tenant" do sistema. Pode ser:
--   PJ → Construtora, incorporadora ou empresa
--   PF → Engenheiro autônomo ou profissional liberal
--
-- Estratégia de rollout incremental (Sprint 2):
--   - Criamos a tabela agora (Sprint 2.1)
--   - Populamos com o tenant pioneiro (Sprint 2.2)
--   - Propagamos workspace_id nas demais tabelas (Sprint 2.3)
--   - Tornamos workspace_id obrigatório e ativamos RLS real (Sprint 3)

CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  tipo_conta  TEXT        NOT NULL DEFAULT 'PJ',
  documento   TEXT,                            -- CPF (PF) ou CNPJ (PJ)
  slug        TEXT,                            -- identificador de URL futuro
  owner_id    UUID,                            -- FK para profiles será adicionada na Sprint 2.2
                                               -- (evita dependência circular na criação)
  ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Garante que apenas valores válidos sejam aceitos
  CONSTRAINT workspaces_tipo_conta_check
    CHECK (tipo_conta IN ('PF', 'PJ')),

  -- Documento único por workspace. NULL é permitido (onboarding sem documento).
  -- PostgreSQL trata cada NULL como distinto em constraints UNIQUE — comportamento correto.
  CONSTRAINT workspaces_documento_unique
    UNIQUE (documento),

  -- Slug único para futuro roteamento por workspace
  CONSTRAINT workspaces_slug_unique
    UNIQUE (slug)
);

-- RLS habilitado. Política temporária (Sprint 1 style): qualquer autenticado acessa.
-- Sprint 3 substituirá por: auth.uid() IN (SELECT id FROM profiles WHERE workspace_id = workspaces.id)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_authenticated" ON public.workspaces
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mantém updated_at sincronizado (reutiliza função criada em 001_auth_and_users.sql)
CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
