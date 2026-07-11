-- 031: Corrige guard_cargo_sistema() pra não bloquear cascata de workspace
--
-- A trigger criada na 027 pra impedir exclusão dos 6 cargos padrão também
-- estava bloqueando o DELETE CASCADE legítimo que acontece quando o
-- workspace inteiro é apagado (cargos.workspace_id REFERENCES workspaces
-- ON DELETE CASCADE) — achado testando o rbac-test.mjs, que limpa os
-- workspaces descartáveis que ele mesmo cria no final da execução.
--
-- Fix: só bloqueia a exclusão direta de um cargo sistema quando o workspace
-- pai ainda existe. Se o workspace já foi apagado (cascata em andamento),
-- deixa passar — não tem sentido proteger um cargo cujo workspace já não
-- existe mais.

CREATE OR REPLACE FUNCTION public.guard_cargo_sistema()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sistema AND EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
      RAISE EXCEPTION 'Cargo padrão do sistema não pode ser excluído';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.sistema AND (NEW.nome IS DISTINCT FROM OLD.nome OR NEW.sistema IS DISTINCT FROM OLD.sistema) THEN
    RAISE EXCEPTION 'Cargo padrão do sistema não pode ser renomeado';
  END IF;
  RETURN NEW;
END;
$$;
