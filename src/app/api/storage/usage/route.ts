import { NextResponse } from "next/server";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/storage/usage — quanto do bucket do Supabase este workspace já
// usou, e o limite do plano (se algum foi definido).
//
// Conta bytes de documento que estão FISICAMENTE no Supabase agora — não
// importa se é o caminho padrão (sem linha em document_storage_sync) ou
// um "pendente_migracao" (reserva temporária, Sprint 11.2) — os dois
// ocupam espaço de verdade no bucket. Documento 'sincronizado' (já no
// Drive) não conta, o arquivo físico não está mais aqui.
export async function GET() {
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: docs }, { data: syncRows }, { data: sub }] = await Promise.all([
    admin.from("documentos").select("id, tamanho_bytes").eq("workspace_id", ctx.workspaceId).eq("ativo", true).returns<Array<{ id: string; tamanho_bytes: number | null }>>(),
    admin.from("document_storage_sync").select("documento_id, sync_status").eq("workspace_id", ctx.workspaceId).returns<Array<{ documento_id: string; sync_status: string }>>(),
    admin.from("subscriptions").select("plan_id").eq("workspace_id", ctx.workspaceId).in("status", ["active", "trialing"]).maybeSingle<{ plan_id: string }>(),
  ]);

  const sincronizadosNoExterno = new Set((syncRows ?? []).filter((s) => s.sync_status === "sincronizado").map((s) => s.documento_id));
  const usedBytes = (docs ?? [])
    .filter((d) => !sincronizadosNoExterno.has(d.id))
    .reduce((soma, d) => soma + (d.tamanho_bytes ?? 0), 0);

  let limitMb: number | null = null;
  if (sub?.plan_id) {
    const { data: plano } = await admin.from("planos").select("storage_limit_mb").eq("id", sub.plan_id).maybeSingle<{ storage_limit_mb: number | null }>();
    limitMb = plano?.storage_limit_mb ?? null;
  }

  const usedMb = usedBytes / (1024 * 1024);
  const percentUsed = limitMb ? Math.min(100, Math.round((usedMb / limitMb) * 1000) / 10) : null;

  return NextResponse.json({ usedBytes, usedMb: Math.round(usedMb * 10) / 10, limitMb, percentUsed });
}
