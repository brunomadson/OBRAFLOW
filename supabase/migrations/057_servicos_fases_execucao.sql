-- 057: Sprint 13.7 — Tarefas agrupadas, templates por serviço e fases de execução
--
-- catalogo_servicos.fases_execucao: colunas do quadro Kanban da aba "Gestão
-- de Projetos", configuráveis por tipo de serviço (ex: um "Projeto
-- Arquitetônico" pode ter Levantamento → Estudo Preliminar → Anteprojeto →
-- Projeto 3D → Aprovação do Cliente; uma "Reforma" tem outro fluxo
-- inteiramente diferente). "Catálogo, não código" — continua sendo uma
-- linha de configuração, nunca uma tabela nova por tipo de serviço.
--
-- servicos.fase_execucao_id: em qual coluna desse quadro o serviço está —
-- só populado quando o serviço chega em "Execução" e o tipo dele tem fases
-- configuradas. Não é FK (o id vive dentro do jsonb do catálogo, não numa
-- tabela própria), então é só texto — igual etapa/status em leads/obras.
--
-- tarefas_padrao já existia (Sprint 13.4) como lista simples; a partir de
-- agora o formato lógico é agrupado por etapa ({grupo, tarefas: string[]}[])
-- — sem mudança de schema (continua jsonb), só de formato dos dados
-- (normalizado na leitura pelo client pra não quebrar linhas antigas).

alter table public.catalogo_servicos
  add column if not exists fases_execucao jsonb not null default '[]'::jsonb;

alter table public.servicos
  add column if not exists fase_execucao_id text;
