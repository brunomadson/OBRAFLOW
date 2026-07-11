"use client";
import { createClient } from "@/lib/supabase/client";

export async function createWorkspaceAndLink(data: {
  nome: string;
  tipo_conta: "PF" | "PJ";
  documento: string | null;
}): Promise<void> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // UUID gerado no cliente para evitar problema de RLS no SELECT de retorno:
  // após INSERT em workspaces, o SELECT usa get_my_workspace_id() que ainda
  // retorna NULL (profile.workspace_id ainda não foi atualizado). Gerando o ID
  // aqui, não precisamos ler de volta o workspace após inserir.
  const workspaceId = crypto.randomUUID();

  const { error: wErr } = await supabase
    .from("workspaces")
    .insert({
      id: workspaceId,
      nome: data.nome,
      tipo_conta: data.tipo_conta,
      documento: data.documento || null,
      owner_id: user.id,
      ativo: true,
    } as never);

  if (wErr) throw wErr;

  // O INSERT acima dispara o trigger workspaces_seed_cargos, que já criou os
  // 6 cargos padrão (inclusive "CEO / Dono") pra este workspace. cargo/setores
  // do profile são recalculados automaticamente pelo trigger de sync a partir
  // do cargo_id — não precisa (nem deve) escrever esses dois campos direto.
  const { data: cargoCeo, error: cErr } = await supabase
    .from("cargos")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("nome", "CEO / Dono")
    .maybeSingle<{ id: string }>();

  if (cErr) throw cErr;
  if (!cargoCeo) throw new Error("Cargo CEO / Dono não foi criado para o novo workspace");

  const { error: pErr } = await supabase
    .from("profiles")
    .update({
      workspace_id: workspaceId,
      cargo_id: cargoCeo.id,
    } as never)
    .eq("id", user.id);

  if (pErr) throw pErr;
}
