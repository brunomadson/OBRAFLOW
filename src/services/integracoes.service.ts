"use client";
import { createClient } from "@/lib/supabase/client";
import { INTEGRACOES_COM_PROVIDER } from "@/constants/integracoes";
import type { Integracao, IntegracaoComStatus, StatusIntegracao } from "@/types/app.types";

const supabase = createClient();

interface PlanoIntegracaoRow { integracao_id: string; disponivel: boolean }
interface WorkspaceIntegracaoRow { integracao_id: string; status: StatusIntegracao; last_sync: string | null }

export async function getIntegracoes(): Promise<IntegracaoComStatus[]> {
  const [{ data: integracoes, error: e1 }, { data: assinatura, error: e2 }] = await Promise.all([
    supabase.from("integracoes").select("id, codigo, nome, descricao, ativo, provider, categoria, tipo_acesso").eq("ativo", true).order("nome").returns<Integracao[]>(),
    // Plano vigente vem da assinatura ativa/trial (Sprint 9), não mais de
    // workspaces.plano_id — aquela coluna nunca foi preenchida por nenhum
    // fluxo real (ver migration 040).
    supabase
      .from("subscriptions")
      .select("plan_id")
      .in("status", ["active", "trialing"])
      .maybeSingle<{ plan_id: string }>(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!integracoes) return [];

  const planoId = assinatura?.plan_id ?? null;

  const [{ data: liberadas }, { data: conexoes }] = await Promise.all([
    planoId
      ? supabase.from("plano_integracoes").select("integracao_id, disponivel").eq("plano_id", planoId).returns<PlanoIntegracaoRow[]>()
      : Promise.resolve({ data: [] as PlanoIntegracaoRow[] }),
    // credentials_encrypted nunca entra aqui — nem por engano, já que nem
    // pedimos "*" (e o Postgres recusaria devolver a coluna pro client
    // autenticado mesmo se pedíssemos, ver migration 043).
    supabase.from("workspace_integracoes").select("integracao_id, status, last_sync").returns<WorkspaceIntegracaoRow[]>(),
  ]);

  const liberadasSet = new Set((liberadas ?? []).filter((l) => l.disponivel).map((l) => l.integracao_id));
  const statusMap = new Map((conexoes ?? []).map((c) => [c.integracao_id, c]));

  return integracoes.map((i) => ({
    ...i,
    // 'essential' sempre disponível, mesmo que faltasse a linha em
    // plano_integracoes — mesma regra de has_feature() (migration 043).
    disponivelNoPlano: i.tipo_acesso === "essential" || liberadasSet.has(i.id),
    status: statusMap.get(i.id)?.status ?? "nao_conectado",
    lastSync: statusMap.get(i.id)?.last_sync ?? null,
    temProvider: INTEGRACOES_COM_PROVIDER.includes(i.codigo),
  }));
}

interface ConnectResponse { status: StatusIntegracao; redirectUrl?: string; error?: string }

// Retorna a URL pra onde o navegador deve navegar (fluxo OAuth) — quem
// chama isso é o próprio <a href>/window.location no componente, não um
// fetch (ver Etapa 2: a interface não conhece detalhes da API externa,
// só sabe que existe uma URL de conexão).
export function urlConectarIntegracao(codigo: string): string {
  return `/api/integrations/${codigo}/connect`;
}

export async function desconectarIntegracao(codigo: string): Promise<void> {
  const res = await fetch(`/api/integrations/${codigo}/disconnect`, { method: "POST" });
  const data: ConnectResponse = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao desconectar.");
}

export async function testarConexaoIntegracao(codigo: string): Promise<boolean> {
  const res = await fetch(`/api/integrations/${codigo}/test`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao testar conexão.");
  return data.ok === true;
}
