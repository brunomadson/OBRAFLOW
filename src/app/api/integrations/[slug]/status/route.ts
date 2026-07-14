import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { getIntegrationStatus } from "@/services/integrations/core/integration-manager";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await ctx.pode("integracoes", "visualizar"))) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const status = await getIntegrationStatus({ workspaceId: ctx.workspaceId, userId: ctx.userId }, slug);
  return NextResponse.json({ status });
}
