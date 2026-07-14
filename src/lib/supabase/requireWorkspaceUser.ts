import { createClient } from "./server";

// Server-only. Usado pelas rotas /api/integrations/* pra saber quem é o
// usuário, de qual workspace, e conferir has_permission() real (não só
// esconder botão na tela — ticket Sprint 11.1, Etapa 4/8) antes de tocar
// em qualquer credencial.
export interface WorkspaceUserContext {
  userId: string;
  workspaceId: string;
  pode(setor: string, acao: "visualizar" | "criar" | "editar" | "excluir"): Promise<boolean>;
}

export async function getWorkspaceUserContext(): Promise<WorkspaceUserContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle<{ workspace_id: string | null }>();
  if (!profile?.workspace_id) return null;

  // Rotas /api/integrations ficam fora do middleware (igual /api/webhooks —
  // precisam responder JSON, não redirect de página), então o bloqueio de
  // workspace suspenso/cancelado (Sprint 9) não passa por lá pra estas
  // rotas. Reforça aqui: mesma RPC do middleware, mesma regra.
  const { data: acessoStatus } = await supabase.rpc("get_workspace_access_status");
  if (acessoStatus === "blocked") return null;

  return {
    userId: user.id,
    workspaceId: profile.workspace_id,
    async pode(setor, acao) {
      const { data, error } = await supabase.rpc("has_permission", { p_setor: setor, p_acao: acao } as never);
      if (error) { console.error("[requireWorkspaceUser] has_permission falhou:", error.message); return false; }
      return data === true;
    },
  };
}
