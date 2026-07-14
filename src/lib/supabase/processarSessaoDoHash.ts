"use client";
import { createClient } from "./client";

// Processa manualmente o "#access_token=...&refresh_token=..." que a
// Supabase manda em todo link de e-mail (recuperação de senha, convite de
// membro, confirmação de cadastro) — em vez de confiar que o SDK detecta
// isso sozinho.
//
// Por quê: o @supabase/ssr (usado neste app pra guardar sessão em cookie,
// compatível com SSR) foi desenhado em torno do fluxo "?code=" — não há
// garantia documentada de que ele processe automaticamente o formato mais
// antigo "#access_token=" que esses e-mails ainda usam neste projeto.
// Testado com Hotmail e Gmail reais e o resultado foi o mesmo nos dois —
// descartando causas de provedor de e-mail — o que aponta pra esse
// processamento automático nunca ter realmente acontecido.
//
// Chamar isso ANTES de esperar por onAuthStateChange/getSession() em toda
// página que recebe um desses links.
export async function processarSessaoDoHash(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const hash = window.location.hash;
  if (!hash || hash.length < 2) return false;

  const params = new URLSearchParams(hash.slice(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return false;

  const supabase = createClient();
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  // Tira o token da URL depois de usar — não deixa ficar no histórico do navegador.
  window.history.replaceState(null, "", window.location.pathname + window.location.search);

  if (error) {
    // Propaga o motivo real (token expirado, já usado, etc.) em vez de só
    // retornar false — quem chama pode mostrar isso na tela pra debug.
    throw new Error(error.message);
  }

  return true;
}
