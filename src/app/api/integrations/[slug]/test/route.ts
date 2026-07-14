import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { testIntegrationConnection, IntegracaoIndisponivelError } from "@/services/integrations/core/integration-manager";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await ctx.pode("integracoes", "visualizar"))) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  try {
    const ok = await testIntegrationConnection({ workspaceId: ctx.workspaceId, userId: ctx.userId }, slug);
    return NextResponse.json({ ok });
  } catch (e) {
    const status = e instanceof IntegracaoIndisponivelError ? 403 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
