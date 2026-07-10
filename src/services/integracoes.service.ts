"use client";
import { createClient } from "@/lib/supabase/client";
import type { Integracao, IntegracaoComStatus, StatusIntegracao } from "@/types/app.types";

const supabase = createClient();

interface PlanoIntegracaoRow { integracao_id: string; disponivel: boolean }
interface WorkspaceIntegracaoRow { integracao_id: string; status: StatusIntegracao }

export async function getIntegracoes(): Promise<IntegracaoComStatus[]> {
  const [{ data: integracoes, error: e1 }, { data: workspace, error: e2 }] = await Promise.all([
    supabase.from("integracoes").select("*").eq("ativo", true).order("nome").returns<Integracao[]>(),
    supabase.from("workspaces").select("id, plano_id").maybeSingle<{ id: string; plano_id: string | null }>(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!integracoes) return [];

  const planoId = workspace?.plano_id ?? null;

  const [{ data: liberadas }, { data: conexoes }] = await Promise.all([
    planoId
      ? supabase.from("plano_integracoes").select("integracao_id, disponivel").eq("plano_id", planoId).returns<PlanoIntegracaoRow[]>()
      : Promise.resolve({ data: [] as PlanoIntegracaoRow[] }),
    supabase.from("workspace_integracoes").select("integracao_id, status").returns<WorkspaceIntegracaoRow[]>(),
  ]);

  const liberadasSet = new Set((liberadas ?? []).filter((l) => l.disponivel).map((l) => l.integracao_id));
  const statusMap = new Map((conexoes ?? []).map((c) => [c.integracao_id, c.status]));

  return integracoes.map((i) => ({
    ...i,
    disponivelNoPlano: liberadasSet.has(i.id),
    status: statusMap.get(i.id) ?? "nao_conectado",
  }));
}

export async function conectarIntegracao(integracaoId: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_integracoes")
    .upsert(
      { integracao_id: integracaoId, status: "conectado", conectado_em: new Date().toISOString() } as never,
      { onConflict: "workspace_id,integracao_id" }
    );
  if (error) throw error;
}

export async function desconectarIntegracao(integracaoId: string): Promise<void> {
  const { error } = await supabase
    .from("workspace_integracoes")
    .upsert(
      { integracao_id: integracaoId, status: "nao_conectado", conectado_em: null } as never,
      { onConflict: "workspace_id,integracao_id" }
    );
  if (error) throw error;
}
