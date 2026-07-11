-- 026: Remove as policies antigas do bucket "documentos" que liberavam acesso
-- a QUALQUER usuário autenticado, sem checar workspace.
--
-- Achado na validação da migration 025: existiam 3 policies criadas
-- manualmente pelo Dashboard quando o bucket foi configurado —
-- "documentos_select", "documentos_delete", "documentos_upload" — com
-- qual/with_check igual a só "bucket_id = 'documentos'", sem nenhuma
-- verificação de workspace. RLS combina policies PERMISSIVE com OR, então
-- essas 3 policies sozinhas já liberavam tudo, tornando as policies
-- corretas da migration 025 (documentos_storage_*) inócuas na prática.
--
-- Confirmado com teste real: um usuário autenticado do workspace A
-- conseguiu ler e apagar um arquivo do workspace B antes desta correção.

DROP POLICY IF EXISTS "documentos_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_delete" ON storage.objects;
DROP POLICY IF EXISTS "documentos_upload" ON storage.objects;
