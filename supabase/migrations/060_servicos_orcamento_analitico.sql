-- 060: Sprint 13.11 — Orçamento analítico do serviço
--
-- Não tem nada a ver com o setor Obras — é uma feature própria de Serviços
-- Técnicos, só no mesmo formato (composição de custo por item + cronograma
-- físico mês a mês) que já existe lá, reaproveitando os tipos
-- ItemComposicaoCusto/EtapaCronogramaMensal (já genéricos, sem depender de
-- nada específico de Obra).
--
-- Diferenças de propósito em relação ao de Obras:
-- - Sem "custo máximo permitido" (valor_venda - lucro%) — usa direto o
--   valor_proposta do serviço como teto, porque serviço técnico não separa
--   meta de lucro % do valor vendido.
-- - Sem comparação com o realizado (Orçado x Realizado) — é só
--   planejamento (quanto vai custar cada item, como distribui no tempo).
--   O realizado de verdade já mora no Financeiro, que agora é único por
--   proposta (Sprint 13.11) — não dá pra atribuir pagamento a uma
--   disciplina específica dentro de uma proposta com vários serviços, então
--   não faz sentido fingir esse cruzamento aqui.
-- - Por serviço, não por proposta: cada disciplina tem sua própria
--   composição de custo (Elétrico e Estrutural gastam materiais/mão de obra
--   muito diferentes), mesmo quando vendidos juntos numa proposta só.

alter table public.servicos
  add column if not exists composicao_custos jsonb not null default '[]'::jsonb,
  add column if not exists cronograma_financeiro jsonb not null default '[]'::jsonb;
