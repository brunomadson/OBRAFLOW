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

-- 5. Adicionar novas colunas à tabela medicoes
ALTER TABLE medicoes
  ADD COLUMN IF NOT EXISTS nome             TEXT,
  ADD COLUMN IF NOT EXISTS pct_solicitada   NUMERIC,
  ADD COLUMN IF NOT EXISTS pct_liberada     NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_liberado   NUMERIC,
  ADD COLUMN IF NOT EXISTS data_envio_caixa DATE,
  ADD COLUMN IF NOT EXISTS data_laudo       DATE,
  ADD COLUMN IF NOT EXISTS data_liberacao   DATE;

-- Migrar dados antigos para os novos campos (se as colunas antigas existirem)
-- numero_medicao → nome
UPDATE medicoes
SET nome = 'Medição ' || numero_medicao::text
WHERE (nome IS NULL OR nome = '')
  AND numero_medicao IS NOT NULL;

-- valor → valor_liberado (campo antigo de valor)
UPDATE medicoes
SET valor_liberado = valor
WHERE valor_liberado IS NULL AND valor IS NOT NULL;

-- data_envio → data_envio_caixa
UPDATE medicoes
SET data_envio_caixa = data_envio
WHERE data_envio_caixa IS NULL AND data_envio IS NOT NULL;

-- Fallback: nome padrão para registros que ainda não têm nome
UPDATE medicoes
SET nome = 'Medição'
WHERE nome IS NULL OR nome = '';

-- Migrar status antigos → novos valores
UPDATE medicoes SET status = 'a_solicitar' WHERE status = 'pendente';
UPDATE medicoes SET status = 'solicitada'  WHERE status IN ('enviada', 'realizada');
UPDATE medicoes SET status = 'paga'        WHERE status IN ('pago', 'pagamento');

-- Atualizar/criar constraint de status (agora que os dados já foram migrados)
ALTER TABLE medicoes DROP CONSTRAINT IF EXISTS medicoes_status_check;
ALTER TABLE medicoes
  ADD CONSTRAINT medicoes_status_check
  CHECK (status IN ('a_solicitar','solicitada','laudo_emitido','paga'));

-- 6. Novos campos em lancamentos (Financeiro)
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS categoria         TEXT,
  ADD COLUMN IF NOT EXISTS grupo             TEXT,
  ADD COLUMN IF NOT EXISTS data_vencimento   DATE,
  ADD COLUMN IF NOT EXISTS data_confirmacao  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forma_pagamento   TEXT,
  ADD COLUMN IF NOT EXISTS status_pagamento  TEXT DEFAULT 'pago',
  ADD COLUMN IF NOT EXISTS parcela_num       INTEGER,
  ADD COLUMN IF NOT EXISTS parcela_total     INTEGER;
