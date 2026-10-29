-- 049: Sprint 12 (Fase 4) — Cronograma Físico-Financeiro
--
-- composicao_custos: composição do custo da obra por item de serviço
-- (Barracão, Infraestrutura, Supraestrutura...) com incidência % —
-- documentação/validação do Custo Máximo Permitido, não usado pra bater
-- com lançamento. Chamado de "PCI" na conversa com o usuário (Planilha de
-- Composição de Investimento), mas NÃO pode se chamar "pci" na coluna —
-- esse nome já existe em obras.licencas.pci (Projeto de Combate a
-- Incêndio, campo completamente diferente).
--
-- cronograma_financeiro: planejamento mês a mês (quantos meses a obra dura
-- e a % acumulada de conclusão em cada mês) — é isso que alimenta o
-- Orçado x Realizado no Financeiro por Obra, comparando o previsto de
-- cada mês (% × Valor de Venda / % × Custo Máximo) com os lançamentos
-- reais datados dentro daquele mês (calculado a partir de obras.data_inicio).
--
-- Mesmo padrão de projeto/licencas/eng_caixa/conformidade (json direto na
-- obra) — é dado exclusivo de 1 obra, sem necessidade de tabela própria.

alter table public.obras
  add column if not exists composicao_custos jsonb,
  add column if not exists cronograma_financeiro jsonb;
