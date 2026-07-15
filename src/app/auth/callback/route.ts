import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Recebe o retorno de todo link de e-mail (confirmação de cadastro,
// convite de membro, recuperação de senha) — formato "token_hash", não
// "#access_token=".
//
// Histórico da investigação (não apagar, é a 6ª tentativa de corrigir
// isto e a causa raiz real só foi confirmada agora):
//   1ª: rota de servidor só lia "?code=" (fluxo PKCE) — nenhum fluxo real
//       deste app usava esse formato.
//   2ª/3ª: virou página client processando "#access_token=" manualmente
//       — funcionava em teste direto via curl, mas o token nunca chegava
//       no client de verdade em produção.
//   4ª: diagnóstico em tela (sem redirect automático) confirmou: quando o
//       link é aberto de dentro do navegador embutido de um app (Gmail,
//       no caso testado — evidência real, print do usuário) o "#" da URL
//       chega VAZIO no JS da página. O token existe e é válido (Supabase
//       processa certo o /verify, servidor confirma o e-mail), mas o
//       navegador embutido descarta o fragment ao seguir o redirect —
//       comportamento conhecido desse tipo de navegador, não é bug nosso
//       nem da Supabase.
//   5ª (esta): elimina o "#" da equação inteiramente. Os e-mails agora
//       apontam pra cá com "?token_hash=...&type=...&redirect_to=..."
//       (querystring de verdade, chega ao servidor sempre, em qualquer
//       navegador) — precisa editar o template de e-mail no Dashboard da
//       Supabase pra usar {{ .TokenHash }} em vez de
//       {{ .ConfirmationURL }} (ver EMAIL_TEMPLATES.md).
//
// "redirect_to" é a página FINAL de destino, direto (ex.
// ".../aceitar-convite") — não é mais uma URL aninhada apontando de volta
// pra cá (evita depender de como a Supabase escapa uma URL dentro de
// outra no template; um valor simples, sem query string própria, é mais
// robusto). Vem de emailRedirectTo/redirectTo já passado no código que
// dispara o e-mail (ModalMembro.tsx, /cadastro, LoginForm.tsx).
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const redirectTo = req.nextUrl.searchParams.get("redirect_to");

  const destino = req.nextUrl.clone();
  destino.search = "";

  if (!tokenHash || !type) {
    console.error("[/auth/callback] token_hash ou type ausente na URL.");
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    console.error("[/auth/callback] verifyOtp falhou:", error.message);
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  // Sessão já foi persistida em cookie pelo createClient() (server.ts) —
  // a página de destino (aceitar-convite, reset-password, onboarding)
  // não precisa processar token nenhum, só confiar que já está logado.
  if (redirectTo) {
    try {
      const url = new URL(redirectTo);
      return NextResponse.redirect(url);
    } catch {
      // redirect_to não era uma URL válida — cai no fallback abaixo
    }
  }
  destino.pathname = "/comercial";
  return NextResponse.redirect(destino);
}
