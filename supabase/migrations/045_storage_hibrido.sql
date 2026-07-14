-- 045: Sprint 11.2 — arquitetura de storage híbrido (Supabase + provedor externo)
--
-- Cada workspace escolhe onde armazena documento novo (workspaces.
-- storage_provider, padrão 'supabase' — ninguém é obrigado a conectar
-- nada). Documento já existente nunca muda de lugar sozinho (trocar de
-- provider não migra o passado). Reaproveita workspace_integracoes
-- (Sprint 11.1) pra credencial/conexão — não criou google_drive_connections.
-- Reaproveita documentos (Sprint 7.2) sem adicionar campo nenhum
-- específico de Google — quem sabe "onde está o arquivo de verdade" é a
-- tabela nova document_storage_sync, e SÓ EXISTE LINHA quando o documento
-- não é o caminho padrão Supabase:
--   sem linha em document_storage_sync → está em documentos.storage_path (Supabase)
--   linha com sync_status='sincronizado' → está no provider externo (external_file_id preenchido)
--   linha com sync_status='pendente_migracao' → ainda está em documentos.storage_path
--     (Supabase, temporário) porque o provider estava fora do ar no
--     momento do upload; será promovido pro provider automaticamente na
--     próxima vez que a conexão for confirmada saudável.

-- ── 1. Provider padrão do workspace ─────────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'supabase'
    CHECK (storage_provider IN ('supabase', 'google_drive', 'dropbox', 'onedrive'));

-- Limite só é relevante pra quem usa 'supabase' (armazenamento externo é do
-- próprio cliente, não custa nada pro ObraFlow) — cálculo de uso real
-- (SUM(documentos.tamanho_bytes), coluna que já existe desde a migration
-- 006) e o aviso de 80% ficam pra quando a tela consumir isso; aqui só
-- preparo o dado, conforme pedido no ticket ("preparar estrutura").
ALTER TABLE public.planos
  ADD COLUMN storage_limit_mb INTEGER;

-- ── 2. Onde cada documento está de verdade (genérico, não amarrado ao Google) ─
CREATE TABLE public.document_storage_sync (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  documento_id          UUID NOT NULL UNIQUE REFERENCES public.documentos(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  external_file_id      TEXT,
  external_folder_id    TEXT,
  external_url          TEXT,
  nome_original         TEXT,
  nome_padronizado      TEXT,
  sync_status           TEXT NOT NULL DEFAULT 'pendente_migracao'
                           CHECK (sync_status IN ('sincronizado', 'pendente_migracao', 'erro')),
  ultima_sincronizacao  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX document_storage_sync_workspace_id_idx ON public.document_storage_sync (workspace_id);
CREATE INDEX document_storage_sync_pendentes_idx ON public.document_storage_sync (workspace_id, provider)
  WHERE sync_status = 'pendente_migracao';

ALTER TABLE public.document_storage_sync ENABLE ROW LEVEL SECURITY;

-- O EXISTS contra documentos aplica a RLS de documentos por baixo (RLS é
-- recursiva) — herda de graça a regra de continuidade lead→obra da
-- migration 038, sem precisar duplicar pode_documento() aqui.
CREATE POLICY "document_storage_sync_select" ON public.document_storage_sync
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND EXISTS (SELECT 1 FROM public.documentos d WHERE d.id = document_storage_sync.documento_id)
  );

-- Sem policy de INSERT/UPDATE/DELETE pra authenticated — só o backend
-- (service_role) grava aqui, mesmo padrão de subscriptions/workspace_integracoes.

CREATE TRIGGER document_storage_sync_updated_at
  BEFORE UPDATE ON public.document_storage_sync
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── 3. Pastas criadas no provider externo (estrutural + por entidade) ───────
-- "chave" é um identificador estável que o código controla (não um enum
-- fixo no banco) — evita precisar de migration nova toda vez que se
-- adiciona uma subpasta. Exemplos de chave:
--   'root'                              → pasta OBRAFLOW
--   'comercial_root' / 'obras_root'      → 1.0_COMERCIAL / 2.0_OBRAS
--   'comercial_ativos' / 'comercial_aprovados' / 'comercial_reprovados'
--   'lead:<lead_id>'                     → pasta "Nome Cliente - Cidade"
--   'lead:<lead_id>:pessoal'             → 01_DOCS_PESSOAIS dentro dela
--   'obra:<obra_id>:medicoes_pls_01'     → PLS 01 dentro de 05_MEDIÇÕES
CREATE TABLE public.entity_storage_folders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,
  chave                TEXT NOT NULL,
  external_folder_id   TEXT NOT NULL,
  nome_pasta            TEXT NOT NULL,
  entidade_tipo         TEXT,
  entidade_id           UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, chave)
);

CREATE INDEX entity_storage_folders_entidade_idx ON public.entity_storage_folders (entidade_tipo, entidade_id);

ALTER TABLE public.entity_storage_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_storage_folders_select" ON public.entity_storage_folders
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_my_workspace_id() AND public.has_permission('documentos', 'visualizar'));

-- Sem policy de escrita pra authenticated — só backend.
