-- 056: Sprint 13.6 — Alertas de Serviços Técnicos (config)
--
-- servico_sem_movimentacao_dias: dias sem o serviço avançar de etapa nem
-- concluir nenhuma tarefa — mesmo conceito de obra_sem_movimentacao_dias
-- (migration 050), só que pro pipeline de Serviços Técnicos. As outras 2
-- regras novas (tarefa vencida, comissão pendente) não precisam de coluna
-- nova: usam a própria data_prevista da tarefa e os prazos de pagamento
-- (pagamento_dias_uteis/pagamento_alerta_dias_uteis) que já existem.

alter table public.config
  add column if not exists servico_sem_movimentacao_dias numeric not null default 15;
