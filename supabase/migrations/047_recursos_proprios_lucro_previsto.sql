-- 047: Sprint 12 (Fase 1) — Financeiro por Obra
--
-- "Recursos Próprios" nasce no Comercial (Lead) e migra pra Obra igual já
-- acontece com valor_financiamento hoje. "Lucro Previsto (%)" só existe a
-- partir do setor Obras — não faz sentido planejar margem ainda no Lead.

alter table public.leads
  add column if not exists recursos_proprios numeric(12,2);

alter table public.obras
  add column if not exists recursos_proprios numeric(12,2),
  add column if not exists lucro_previsto_pct numeric(5,2);
