-- ============================================================
-- MIGRATION COMPLETA — ObraFlow
-- Rodar no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Novos campos em leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS nascimento          TEXT,
  ADD COLUMN IF NOT EXISTS indicado_por        TEXT,
  ADD COLUMN IF NOT EXISTS corretor            TEXT,
  ADD COLUMN IF NOT EXISTS corretor_id         UUID,
  ADD COLUMN IF NOT EXISTS tamanho_imovel      TEXT,
  ADD COLUMN IF NOT EXISTS com_muro            TEXT,
  ADD COLUMN IF NOT EXISTS valor_lote          NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_financiamento NUMERIC,
  ADD COLUMN IF NOT EXISTS origem_recurso      TEXT,
  ADD COLUMN IF NOT EXISTS enviado_para_obras  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_envio_obras    TIMESTAMPTZ;

-- 2. Novos campos em correspondentes
ALTER TABLE correspondentes
  ADD COLUMN IF NOT EXISTS agencia TEXT,
  ADD COLUMN IF NOT EXISTS email   TEXT,
  ADD COLUMN IF NOT EXISTS cidade  TEXT;

-- 3. Tabela de cidades gerenciáveis
CREATE TABLE IF NOT EXISTS cidades (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  ativo      BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cidades_auth" ON cidades;
CREATE POLICY "cidades_auth" ON cidades
  FOR ALL USING (auth.role() = 'authenticated');

-- Seed cidades iniciais
INSERT INTO cidades (nome) VALUES
  ('Pedreiras'),
  ('São Domingos do Maranhão'),
  ('Trizidela do Vale'),
  ('Lima Campos'),
  ('Peritoro'),
  ('Tuntum'),
  ('Presidente Dutra'),
  ('Capinzal do Norte')
ON CONFLICT (nome) DO NOTHING;

-- 4. Tabela de corretores pré-cadastrados
CREATE TABLE IF NOT EXISTS corretores (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  telefone   TEXT,
  email      TEXT,
  ativo      BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE corretores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corretores_auth" ON corretores;
CREATE POLICY "corretores_auth" ON corretores
  FOR ALL USING (auth.role() = 'authenticated');
