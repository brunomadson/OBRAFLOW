-- 022: Corrige colunas de config para bater com o que o app realmente usa
--
-- A tabela config tinha colunas de uma versão anterior do produto
-- (prazo_analise_credito, prazo_doc_parada, prazo_habite_se, etc.) que
-- não correspondem a nenhum campo usado hoje pela UI (GRUPOS_CONFIG em
-- src/constants/config.ts) nem pelos alertas (useNotificacoes.ts). Toda
-- tentativa de salvar configurações falhava com "column does not exist"
-- e, mesmo que salvasse, nada leria essas colunas de volta.

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS analise_credito_horas        integer NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS analise_credito_alerta_horas integer NOT NULL DEFAULT 36,
  ADD COLUMN IF NOT EXISTS documentacao_alerta_dias     integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS documentacao_critico_dias    integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS projeto_arquitetonico_dias   integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS projeto_arquitetonico_alerta integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS projeto_complementar_dias    integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS projeto_complementar_alerta  integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS solicitacao_eng_alerta_dias  integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS vistoria_eng_caixa_dias      integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS laudo_eng_caixa_dias         integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS laudo_apos_solicitada_dias   integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS conformidade_dias            integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS conformidade_alerta_dias     integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS contrato_apos_conforme_dias  integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pls_intervalo_dias           integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS pls_alerta_dias              integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS pagamento_apos_laudo_dias    integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pagamento_apos_laudo_alerta  integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS pagamento_dias_uteis         integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pagamento_alerta_dias_uteis  integer NOT NULL DEFAULT 4;

-- Colunas do schema antigo, nunca usadas pelo app atual.
ALTER TABLE public.config
  DROP COLUMN IF EXISTS prazo_analise_credito,
  DROP COLUMN IF EXISTS prazo_doc_parada,
  DROP COLUMN IF EXISTS prazo_projeto_atrasado,
  DROP COLUMN IF EXISTS prazo_pls_sem_retorno,
  DROP COLUMN IF EXISTS prazo_pls_intervalo,
  DROP COLUMN IF EXISTS prazo_laudo_atraso,
  DROP COLUMN IF EXISTS prazo_previsao_termino,
  DROP COLUMN IF EXISTS prazo_pagamento_vencido,
  DROP COLUMN IF EXISTS prazo_contrato_parado,
  DROP COLUMN IF EXISTS prazo_visita_tecnica,
  DROP COLUMN IF EXISTS prazo_reuniao_sem_retorno,
  DROP COLUMN IF EXISTS prazo_docs_incompletos,
  DROP COLUMN IF EXISTS prazo_sem_atividade_lead,
  DROP COLUMN IF EXISTS prazo_sem_atividade_obra,
  DROP COLUMN IF EXISTS prazo_medicao_pendente,
  DROP COLUMN IF EXISTS prazo_etapa_longa,
  DROP COLUMN IF EXISTS prazo_doc_obra_parada,
  DROP COLUMN IF EXISTS prazo_vistoria_atraso,
  DROP COLUMN IF EXISTS prazo_habite_se,
  DROP COLUMN IF EXISTS prazo_registro_atraso,
  DROP COLUMN IF EXISTS prazo_pos_entrega;
