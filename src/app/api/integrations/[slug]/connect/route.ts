import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { connectIntegration, IntegracaoIndisponivelError } from "@/services/integrations/core/integration-manager";

// GET (não POST): pra Google Drive/Calendar isto precisa navegar o
// navegador de verdade pro consentimento do Google — um <a href> normal,
// não um fetch. Rotas sem OAuth (nenhuma ainda) também funcionam aqui,
// só não retornam redirectUrl.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await ctx.pode("integracoes", "criar"))) {
    return NextResponse.json({ error: "sem permissão pra conectar integrações" }, { status: 403 });
  }

  try {
    const resultado = await connectIntegration({ workspaceId: ctx.workspaceId, userId: ctx.userId }, slug);
    if (resultado.redirectUrl) return NextResponse.redirect(resultado.redirectUrl);
    return NextResponse.json({ status: resultado.status });
  } catch (e) {
    const status = e instanceof IntegracaoIndisponivelError ? 403 : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
