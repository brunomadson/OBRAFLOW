-- 035: Corrige vulnerabilidade real no histórico + aplica regra de negócio nova
--
-- ACHADO NA AUDITORIA (Sprint 7.2, Etapa 1): a tabela historico tinha DUAS
-- policies coexistindo — "historico_workspace" (correta) e "historico_all"
-- (USING(true) WITH CHECK(true), sem checar workspace nenhum). Essa segunda
-- nunca veio de nenhuma migration rastreada — foi criada manualmente no
-- Dashboard em algum momento, mesmo padrão do vazamento real de Storage do
-- Sprint 0. Como RLS combina policies PERMISSIVE com OR, "historico_all"
-- sozinha anulava o isolamento inteiro da tabela: qualquer usuário
-- autenticado de qualquer workspace conseguia ler, editar e apagar o
-- histórico de qualquer empresa.
--
-- Regra de negócio nova (Etapa 2 do ticket):
--   visualizar → só o histórico dos módulos que o usuário tem acesso
--     (lead_id → comercial.visualizar; obra_id → obras.visualizar;
--      nenhum dos dois, ou tipo='sistema' → configuracoes.visualizar,
--      já que esses registros são sobre gestão de cargo/permissão)
--   editar     → ninguém, nunca (nem CEO) — sem policy de UPDATE = negado
--   excluir    → só quem tem configuracoes.excluir, que hoje é só o CEO
--     (Gerente tem configuracoes.editar=true mas excluir=false desde o
--      Sprint 7.1 — não precisa de setor novo, o dado que já existe já
--      identifica exatamente "só CEO")
--   inserir    → mantém igual a hoje: qualquer membro do workspace com
--     acesso de leitura ao módulo (a maioria dos registros são
--     efeito colateral automático de ações já permitidas em outro lugar,
--     ex. editar um lead já dispara registrarHistorico())

DROP POLICY IF EXISTS "historico_all" ON public.historico;
DROP POLICY IF EXISTS "historico_workspace" ON public.historico;
DROP POLICY IF EXISTS "historico_select" ON public.historico;
DROP POLICY IF EXISTS "historico_insert" ON public.historico;
DROP POLICY IF EXISTS "historico_delete" ON public.historico;

CREATE POLICY "historico_select" ON public.historico
  FOR SELECT TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'visualizar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'visualizar'))
      OR (lead_id IS NULL AND obra_id IS NULL AND public.has_permission('configuracoes', 'visualizar'))
    )
  );

CREATE POLICY "historico_insert" ON public.historico
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = public.get_my_workspace_id()
    AND (
      (lead_id IS NOT NULL AND public.has_permission('comercial', 'visualizar'))
      OR (obra_id IS NOT NULL AND public.has_permission('obras', 'visualizar'))
      OR (lead_id IS NULL AND obra_id IS NULL AND public.has_permission('configuracoes', 'visualizar'))
    )
  );

-- Sem policy de UPDATE: ninguém edita histórico, nem CEO. Postgres nega por
-- padrão quando não existe policy pro comando.

CREATE POLICY "historico_delete" ON public.historico
  FOR DELETE TO authenticated
  USING (
    workspace_id = public.get_my_workspace_id()
    AND public.has_permission('configuracoes', 'excluir')
  );
