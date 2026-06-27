-- Seed: initial config row and sample correspondentes

insert into public.config (
  prazo_analise_credito, prazo_doc_parada, prazo_projeto_atrasado,
  prazo_pls_sem_retorno, prazo_pls_intervalo, prazo_laudo_atraso,
  prazo_previsao_termino, prazo_pagamento_vencido, prazo_contrato_parado,
  prazo_visita_tecnica, prazo_reuniao_sem_retorno, prazo_docs_incompletos,
  prazo_sem_atividade_lead, prazo_sem_atividade_obra, prazo_medicao_pendente,
  prazo_etapa_longa, prazo_doc_obra_parada, prazo_vistoria_atraso,
  prazo_habite_se, prazo_registro_atraso, prazo_pos_entrega
) values (
  30, 15, 30, 10, 45, 20, 7, 0, 20, 15, 7, 10, 20, 15, 10, 60, 10, 7, 30, 20, 90
) on conflict do nothing;

insert into public.correspondentes (nome, contato, banco) values
  ('João Correspondente', '(82) 99999-0001', 'Caixa Econômica Federal'),
  ('Maria Bancária',      '(82) 99999-0002', 'Caixa Econômica Federal')
on conflict do nothing;
