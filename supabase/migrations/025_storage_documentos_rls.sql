-- 025: RLS de storage.objects para o bucket "documentos"
--
-- O bucket foi criado manualmente (Dashboard > Storage > New bucket) sem
-- nenhuma policy versionada em migration — não havia como confirmar isolamento
-- por workspace no código-fonte.
--
-- O caminho de cada arquivo é "{lead_id ou obra_id}/{secao}/{arquivo}" (ver
-- src/services/documentos.service.ts) — não contém workspace_id diretamente,
-- então a policy verifica se esse primeiro segmento do caminho pertence a um
-- lead OU obra do workspace do usuário autenticado. Mesmo padrão de subquery
-- já usado em lead_log/obra_log/medicoes (migration 015).

DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_storage_delete" ON storage.objects;

CREATE POLICY "documentos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
      )
    )
  );

CREATE POLICY "documentos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
      )
    )
  );

CREATE POLICY "documentos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
      )
    )
  );

CREATE POLICY "documentos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.leads WHERE workspace_id = public.get_my_workspace_id()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.obras WHERE workspace_id = public.get_my_workspace_id()
      )
    )
  );
