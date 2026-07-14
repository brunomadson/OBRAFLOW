import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { disconnectIntegration, IntegracaoIndisponivelError } from "@/services/integrations/core/integration-manager";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await ctx.pode("integracoes", "editar"))) {
    return NextResponse.json({ error: "sem permissão pra desconectar integrações" }, { status: 403 });
  }

  try {
    await disconnectIntegration({ workspaceId: ctx.workspaceId, userId: ctx.userId }, slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof IntegracaoIndisponivelError ? 403 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
