import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { getValidAccessToken } from "@/services/integrations/google-drive/google-drive.service";
import { moverObraEtapa, categoriaObraPorEtapa } from "@/services/storage/folderStructure";
import type { IntegrationContext } from "@/services/integrations/core/integration-types";

// Fire-and-forget a partir de useObras.ts (avancarEtapa) — mesmo padrão
// de /api/storage/leads/[leadId]/folder-event (Sprint 11.2). Move a pasta
// entre 2.1_PROCESSOS/2.2_OBRAS_EM_ANDAMENTO/2.3_CASAS_ENTREGUES só quando
// a mudança de etapa realmente cruza a fronteira de categoria.
export async function POST(req: NextRequest, { params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const etapaAnterior = body.etapaAnterior as string | undefined;
  const novaEtapa = body.novaEtapa as string | undefined;
  if (!etapaAnterior || !novaEtapa) return NextResponse.json({ error: "etapaAnterior/novaEtapa ausentes" }, { status: 400 });

  const admin = createAdminClient();
  const { data: workspace } = await admin.from("workspaces").select("storage_provider").eq("id", ctx.workspaceId).single<{ storage_provider: string }>();
  if (workspace?.storage_provider !== "google_drive") {
    return NextResponse.json({ ok: true, skip: "workspace não usa Google Drive" });
  }

  // Checagem barata ANTES de buscar token — a imensa maioria das
  // mudanças de etapa (ex. licencas → contrato) fica na mesma categoria e
  // não precisa tocar em credencial nenhuma. Só busca token quando existe
  // pasta de verdade pra mover.
  if (categoriaObraPorEtapa(etapaAnterior) === categoriaObraPorEtapa(novaEtapa)) {
    return NextResponse.json({ ok: true, skip: "mesma categoria de pasta" });
  }

  const supabase = await createSessionClient();
  const { data: obra } = await supabase.from("obras").select("lead_id").eq("id", obraId).maybeSingle<{ lead_id: string | null }>();
  if (!obra) return NextResponse.json({ error: "obra não encontrada" }, { status: 404 });

  const integrationCtx: IntegrationContext = { workspaceId: ctx.workspaceId, userId: ctx.userId };

  try {
    const { accessToken } = await getValidAccessToken(integrationCtx);
    await moverObraEtapa(integrationCtx, accessToken, { leadId: obra.lead_id, obraId }, etapaAnterior, novaEtapa);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[/api/storage/obras/${obraId}/folder-event] falhou:`, e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
