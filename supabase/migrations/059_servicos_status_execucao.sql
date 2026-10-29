-- 059: Sprint 13.8 — status de execução (Ativo/Paralisado/Cancelado)
--
-- Separado de "etapa" de propósito: etapa é a posição no funil linear
-- (novo_lead → ... → execucao → concluido, ver ETAPAS_SERVICO/FLUXO_SERVICO)
-- e continua dirigindo o Timeline/Pipeline como sempre dirigiu. Um serviço
-- pode estar etapa="execucao" e, junto disso, ter sido paralisado ou
-- cancelado pelo cliente — isso não é um passo a mais no funil, é um estado
-- que se sobrepõe à etapa atual. Por isso vira uma coluna própria, não um
-- valor novo em EtapaServico.

alter table public.servicos
  add column if not exists status_execucao text not null default 'ativo';

alter table public.servicos drop constraint if exists servicos_status_execucao_check;
alter table public.servicos add constraint servicos_status_execucao_check
  check (status_execucao in ('ativo', 'paralisado', 'cancelado'));
