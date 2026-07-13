-- 038: Corrige a regra de documentos pra continuidade Comercial → Obras
--
-- ACHADO antes de testar (analisando ModalObra.tsx e AbaDocumentos.tsx):
-- quando uma obra vem de um lead (obra.lead_id existe), a aba Documentos
-- recebe leadId E obraId ao mesmo tempo, e todo upload feito ali continua
-- indo pro lead_id, nunca pro obra_id — é assim que o app hoje garante que
-- os documentos (RG, CPF, comprovante de renda) sigam o cliente do
-- Comercial pra Obras sem duplicar.
--
-- A regra da migration 036 (lead_id → comercial.* OU obra_id → obras.*)
-- não cobria esse caso: um documento com lead_id setado de uma obra em
-- andamento exigia comercial.visualizar — e Engenheiro/Estagiário não têm
-- esse setor, ficariam bloqueados de ver justamente os documentos que o
-- ticket cita como exemplo principal ("Engenheiro precisa consultar os
-- documentos do Lead pra análise técnica e aprovação da obra").
--
-- Fix: função pode_documento(lead_id, obra_id, acao) — se o lead em
-- questão já virou obra (existe uma obra com esse lead_id), tanto quem tem
-- permissão de comercial QUANTO de obras pode acessar. Um lead que nunca
-- virou obra continua exigindo só comercial (SDR não ganha acesso a nada
-- novo). Mesma lógica replicada pro Storage, onde só temos o id (lead ou
-- obra) no caminho do arquivo, sem saber de antemão qual é qual.

CREATE OR REPLACE FUNCTION public.pode_documento(p_lead_id UUID, p_obra_id UUID, p_acao TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_obra_id IS NOT NULL THEN
        public.has_permission('obras', p_acao)
      WHEN p_lead_id IS NOT NULL THEN
        public.has_permission('comercial', p_acao)
        OR (
          public.has_permission('obras', p_acao)
          AND EXISTS (
            SELECT 1 FROM public.obras o
            WHERE o.lead_id = p_lead_id AND o.workspace_id = public.get_my_workspace_id()
          )
        )
      ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION public.pode_documento_storage(p_id TEXT, p_acao TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      EXISTS (SELECT 1 FROM public.obras o WHERE o.id::text = p_id AND o.workspace_id = public.get_my_workspace_id())
      AND public.has_permission('obras', p_acao)
    )
    OR (
      EXISTS (SELECT 1 FROM public.leads l WHERE l.id::text = p_id AND l.workspace_id = public.get_my_workspace_id())
      AND (
        public.has_permission('comercial', p_acao)
        OR (
          public.has_permission('obras', p_acao)
          AND EXISTS (
            SELECT 1 FROM public.obras o2
            WHERE o2.lead_id::text = p_id AND o2.workspace_id = public.get_my_workspace_id()
          )
        )
      )
    );
$$;

-- ── documentos: troca a checagem de domínio pela função nova ────────────────

DROP POLICY IF EXISTS "documentos_select" ON public.documentos;
CREATE POLICY "documentos_select" ON public.documentos
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'visualizar')
    AND public.pode_documento(lead_id, obra_id, 'visualizar')
  );

DROP POLICY IF EXISTS "documentos_insert" ON public.documentos;
CREATE POLICY "documentos_insert" ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'criar')
    AND public.pode_documento(lead_id, obra_id, 'criar')
  );

DROP POLICY IF EXISTS "documentos_update" ON public.documentos;
CREATE POLICY "documentos_update" ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'editar')
    AND public.pode_documento(lead_id, obra_id, 'editar')
    AND (usuario_id = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
  )
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('documentos', 'editar')
    AND public.pode_documento(lead_id, obra_id, 'editar')
    AND (usuario_id = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
  );

-- documentos_delete continua igual (só documentos.excluir, sem checar
-- domínio — só CEO tem essa permissão de qualquer forma).

-- ── storage.objects: mesma troca ──────────────────────────────────────────

DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;
CREATE POLICY "documentos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND public.has_permission('documentos', 'visualizar')
    AND public.pode_documento_storage((storage.foldername(name))[1], 'visualizar')
  );

DROP POLICY IF EXISTS "documentos_storage_insert" ON storage.objects;
CREATE POLICY "documentos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND public.has_permission('documentos', 'criar')
    AND public.pode_documento_storage((storage.foldername(name))[1], 'criar')
  );

DROP POLICY IF EXISTS "documentos_storage_update" ON storage.objects;
CREATE POLICY "documentos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND public.has_permission('documentos', 'editar')
    AND public.pode_documento_storage((storage.foldername(name))[1], 'editar')
    AND (owner = auth.uid() OR public.has_permission('configuracoes', 'visualizar'))
  );

-- documentos_storage_delete continua igual (só documentos.excluir).
