import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { getValidAccessToken } from "@/services/integrations/google-drive/google-drive.service";
import { ensureClientFolder, moverLeadAprovado, moverLeadReprovado, moverLeadParaObras } from "@/services/storage/folderStructure";
import type { IntegrationContext } from "@/services/integrations/core/integration-types";

type Evento = "documentacao" | "aprovada" | "reprovada" | "enviado_obras";

// Chamada fire-and-forget a partir de useLeads.ts (avancarEtapa,
// enviarParaObras) — mesmo espírito de registrarHistorico(...).catch(()=>{})
// já usado nesses pontos: nunca deve travar a ação principal do usuário
// (mudar etapa, mandar pra obras) por causa de uma pasta de Drive que
// falhou. Se o workspace não usa Google Drive, é um no-op rápido.
export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const evento = body.evento as Evento | undefined;
  if (!evento) return NextResponse.json({ error: "evento ausente" }, { status: 400 });

  const admin = createAdminClient();
  const { data: workspace } = await admin.from("workspaces").select("storage_provider").eq("id", ctx.workspaceId).single<{ storage_provider: string }>();
  if (workspace?.storage_provider !== "google_drive") {
    return NextResponse.json({ ok: true, skip: "workspace não usa Google Drive" });
  }

  const supabase = await createSessionClient();
  const { data: lead } = await supabase.from("leads").select("nome, cidade").eq("id", leadId).maybeSingle<{ nome: string; cidade: string | null }>();
  if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });

  const integrationCtx: IntegrationContext = { workspaceId: ctx.workspaceId, userId: ctx.userId };

  try {
    const { accessToken } = await getValidAccessToken(integrationCtx);

    switch (evento) {
      case "documentacao":
        await ensureClientFolder(integrationCtx, accessToken, leadId, lead.nome, lead.cidade);
        break;
      case "aprovada":
        await moverLeadAprovado(integrationCtx, accessToken, leadId);
        break;
      case "reprovada":
        await moverLeadReprovado(integrationCtx, accessToken, leadId);
        break;
      case "enviado_obras":
        await moverLeadParaObras(integrationCtx, accessToken, leadId);
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Não é erro fatal pro usuário — a ação principal (mudar etapa, ir
    // pra obras) já aconteceu antes desta chamada. Só loga.
    console.error(`[/api/storage/leads/${leadId}/folder-event] evento=${evento} falhou:`, e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
