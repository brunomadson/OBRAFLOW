import { NextRequest, NextResponse } from "next/server";
import { verifyState, exchangeCodeForTokens } from "@/services/integrations/core/google-oauth";
import { saveConnection } from "@/services/integrations/core/integration-provider";

// Recebe o retorno do consentimento do Google (Drive e Calendar caem aqui
// — hoje as 2 únicas integrações OAuth, mesmo mecanismo de troca de
// code). Não exige sessão própria: quem garante que isto é legítimo é o
// "state" assinado (HMAC), gerado em /connect/route.ts pro mesmo
// workspaceId/userId — não o cookie de quem está clicando agora (o
// navegador que volta do Google é o mesmo, mas não custa não depender só
// disso).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const erroGoogle = req.nextUrl.searchParams.get("error");

  const destino = req.nextUrl.clone();
  destino.pathname = "/configuracoes";
  destino.search = "";

  if (erroGoogle) {
    destino.searchParams.set("integracao_erro", erroGoogle);
    return NextResponse.redirect(destino);
  }
  if (!code || !state) {
    destino.searchParams.set("integracao_erro", "parametros_ausentes");
    return NextResponse.redirect(destino);
  }

  try {
    const payload = verifyState(state);
    if (payload.slug !== slug) throw new Error("state não corresponde à integração da URL.");

    const tokens = await exchangeCodeForTokens(code);
    await saveConnection(
      { workspaceId: payload.workspaceId, userId: payload.userId },
      slug,
      { ...tokens, obtained_at: Date.now() }
    );

    destino.searchParams.set("integracao_conectada", slug);
    return NextResponse.redirect(destino);
  } catch (e) {
    console.error(`[/api/integrations/${slug}/callback] falha:`, e);
    destino.searchParams.set("integracao_erro", "falha_ao_conectar");
    return NextResponse.redirect(destino);
  }
}
