-- 050: Alertas Financeiros (Fases 1+2) — configs novas
--
-- recebimento_pendente_alerta_dias / _critico_dias: dias desde a Caixa
-- liberar uma medição sem o cliente ter repassado (total ou parcial) pra
-- disparar alerta/crítico.
--
-- obra_sem_movimentacao_dias: dias sem nenhum lançamento ou medição
-- atualizada numa obra em execução.
--
-- caixa_minimo: piso de saldo da empresa (soma de todas as obras) —
-- opcional (null = alerta desativado, cada empresa decide se quer usar).

alter table public.config
  add column if not exists recebimento_pendente_alerta_dias numeric not null default 3,
  add column if not exists recebimento_pendente_critico_dias numeric not null default 7,
  add column if not exists obra_sem_movimentacao_dias numeric not null default 15,
  add column if not exists caixa_minimo numeric(12,2);
