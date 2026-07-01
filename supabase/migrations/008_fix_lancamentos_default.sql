-- 008: Corrige o DEFAULT incorreto de status_pagamento em lancamentos
--
-- Problema: migration.sql adicionou status_pagamento com DEFAULT 'pago',
-- fazendo com que novos lançamentos nascessem automaticamente como pagos.
-- O correto é DEFAULT 'pendente' — o usuário marca como pago manualmente.
--
-- IMPORTANTE: Esta migration NÃO altera registros existentes.
-- Apenas corrige o comportamento para novos lançamentos.

ALTER TABLE public.lancamentos
  ALTER COLUMN status_pagamento SET DEFAULT 'pendente';

-- Adiciona CHECK constraint para garantir integridade dos valores permitidos
-- (executado com IF NOT EXISTS via DO block para evitar erro em re-execução)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lancamentos_status_pagamento_check'
      AND table_name = 'lancamentos'
  ) THEN
    ALTER TABLE public.lancamentos
      ADD CONSTRAINT lancamentos_status_pagamento_check
      CHECK (status_pagamento IN ('pendente', 'pago', 'vencido'));
  END IF;
END $$;
