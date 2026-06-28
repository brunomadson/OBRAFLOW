-- 006: Obras table completions + documentos table + lead_log fix
-- Rodar no Supabase Dashboard > SQL Editor

-- 1. Corrige lead_log: adiciona coluna dados_extras que estava faltando
ALTER TABLE lead_log
  ADD COLUMN IF NOT EXISTS dados_extras JSONB;

-- 2. Adiciona todas as colunas faltantes na tabela obras
--    (alinha o banco com a interface TypeScript Obra)
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS nome                     TEXT,
  ADD COLUMN IF NOT EXISTS email                    TEXT,
  ADD COLUMN IF NOT EXISTS nascimento               TEXT,
  ADD COLUMN IF NOT EXISTS tipo_renda               TEXT,
  ADD COLUMN IF NOT EXISTS dependente               BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fgts_3anos               BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS com_muro                 TEXT,
  ADD COLUMN IF NOT EXISTS tamanho_imovel           TEXT,
  ADD COLUMN IF NOT EXISTS valor_lote               NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_financiamento      NUMERIC,
  ADD COLUMN IF NOT EXISTS com_conjuge              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS origem                   TEXT,
  ADD COLUMN IF NOT EXISTS corretor                 TEXT,
  ADD COLUMN IF NOT EXISTS corretor_id              UUID,
  ADD COLUMN IF NOT EXISTS indicado_por             TEXT,
  ADD COLUMN IF NOT EXISTS origem_recurso           TEXT,
  ADD COLUMN IF NOT EXISTS data_contato             TEXT,
  ADD COLUMN IF NOT EXISTS data_reuniao             TEXT,
  ADD COLUMN IF NOT EXISTS endereco                 TEXT,
  ADD COLUMN IF NOT EXISTS valor_obra               NUMERIC,
  ADD COLUMN IF NOT EXISTS responsavel_comercial_id UUID,
  ADD COLUMN IF NOT EXISTS anotacoes_comercial      TEXT,
  ADD COLUMN IF NOT EXISTS data_assinatura          TEXT,
  ADD COLUMN IF NOT EXISTS previsao_termino         TEXT,
  ADD COLUMN IF NOT EXISTS progresso                INTEGER DEFAULT 0;

-- 3. Tabela de documentos (upload de arquivos)
CREATE TABLE IF NOT EXISTS documentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  obra_id       UUID REFERENCES obras(id) ON DELETE CASCADE,
  secao         TEXT NOT NULL,
  tipo_doc      TEXT NOT NULL,
  nome_arquivo  TEXT NOT NULL,
  tamanho_bytes BIGINT,
  mime_type     TEXT,
  storage_path  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id    UUID REFERENCES profiles(id),
  ativo         BOOLEAN DEFAULT TRUE
);

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_auth" ON documentos;
CREATE POLICY "documentos_auth" ON documentos
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_documentos_lead ON documentos(lead_id) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_documentos_obra ON documentos(obra_id) WHERE ativo = TRUE;

-- IMPORTANTE: Após rodar este SQL, criar o bucket "documentos" no Supabase:
--   Dashboard > Storage > New bucket > Nome: "documentos" > Private > Save
