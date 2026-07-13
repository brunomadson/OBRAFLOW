-- 037: Sprint 7.2 (Etapa 8) — RBAC no Storage, espelhando a regra da migration 036
--
-- Mesma regra de negócio de documentos, aplicada em storage.objects:
--   download (SELECT) → documentos.visualizar + domínio (lead→comercial,
--     obra→obras) visualizar
--   upload   (INSERT) → documentos.criar + domínio criar
--   update             → documentos.editar + domínio editar + (dono do
--     arquivo OU gestor) — storage.objects tem uma coluna "owner" própria
--     (preenchida automaticamente pelo Supabase no upload), usada aqui do
--     mesmo jeito que documentos.usuario_id. Não usado pela UI hoje
--     (storage.provider.ts só faz upload/download/delete), mas protegido
--     por completude, mesmo padrão da 036.
--   delete             → documentos.excluir (só CEO)
--
-- O caminho de cada arquivo é "{lead_id ou obra_id}/{secao}/{arquivo}" (ver
-- src/services/documentos.service.ts) — (storage.foldername(name))[1] é
-- esse primeiro segmento, mesmo padrão já usado nas migrations 025/026.

DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;
CREATE POLICY "documentos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND public.has_permission('documentos', 'visualizar')
    AND (
      (
        public.has_permission('comercial', 'visualizar')
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
        )
      )
      OR (
        public.has_permission('obras', 'visualizar')
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "documentos_storage_insert" ON storage.objects;
CREATE POLICY "documentos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND public.has_permission('documentos', 'criar')
    AND (
      (
        public.has_permission('comercial', 'criar')
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
        )
      )
      OR (
        public.has_permission('obras', 'criar')
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "documentos_storage_update" ON storage.objects;
CREATE POLICY "documentos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND public.has_permission('documentos', 'editar')
    AND (owner = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
    AND (
      (
        public.has_permission('comercial', 'editar')
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
        )
      )
      OR (
        public.has_permission('obras', 'editar')
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "documentos_storage_delete" ON storage.objects;
CREATE POLICY "documentos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND public.has_permission('documentos', 'excluir')
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
      )
    )
  );
