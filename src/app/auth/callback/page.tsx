"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { processarSessaoDoHash } from "@/lib/supabase/processarSessaoDoHash";

// Nunca cachear — cada visita traz um token de e-mail diferente, uma
// versão antiga desta página (HTML ou JS) em cache tornaria qualquer
// correção futura invisível pra quem já visitou antes.
export const dynamic = "force-dynamic";

// Recebe o retorno de e-mails de confirmação (cadastro) e convite de
// membro. Precisa ser uma página client, não uma rota de servidor: os
// links que a Supabase gera pra esses dois fluxos vêm com o token depois
// do "#" (fragment), que o navegador NUNCA envia pro servidor — só o
// próprio navegador consegue processar isso.
//
// Achado em produção (1ª correção): a versão antiga disto era uma rota de
// servidor (route.ts) que só sabia ler "?code=" (fluxo PKCE) — nenhum dos
// dois fluxos reais deste app usa esse formato.
//
// Achado em produção (2ª correção): mesmo virando página client, não dava
// pra confiar que o SDK processa o "#access_token=" sozinho — processamos
// manualmente agora (ver processarSessaoDoHash.ts).
// DIAGNÓSTICO TEMPORÁRIO (remover depois de achar a causa raiz):
// captura o hash bruto da URL ANTES de qualquer processamento apagá-lo,
// pra mostrar na tela se ele realmente chegou até aqui ou não.
function capturarHashBruto() {
  if (typeof window === "undefined") return "(sem window)";
  const h = window.location.hash;
  if (!h) return "(vazio)";
  return `presente, ${h.length} chars, começa com "${h.slice(0, 20)}..."`;
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hashBruto] = useState(capturarHashBruto);
  const [status, setStatus] = useState("iniciando...");
  const next = searchParams.get("next") ?? "/comercial";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setPronto(true);
    });

    setStatus("chamando processarSessaoDoHash...");
    processarSessaoDoHash()
      .then((processou) => {
        setStatus(`processarSessaoDoHash retornou: ${processou}`);
        if (processou) { setPronto(true); return; }
        return supabase.auth.getSession().then(({ data }) => {
          setStatus(`getSession() fallback: sessão ${data.session ? "encontrada" : "ausente"}`);
          if (data.session) setPronto(true);
        });
      })
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)));

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pronto) router.replace(next);
  }, [pronto, next, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 px-4">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      {erro && (
        <p className="text-red-400 text-xs text-center max-w-sm">Erro ao processar o link: {erro}</p>
      )}
      <div className="text-slate-500 text-[10px] text-center max-w-sm mt-4 space-y-1 font-mono">
        <p>hash na URL: {hashBruto}</p>
        <p>status: {status}</p>
        <p>pronto: {String(pronto)}</p>
      </div>
      {!pronto && (
        <button
          onClick={() => router.replace("/login")}
          className="mt-4 text-xs text-slate-400 underline"
        >
          Ir para login manualmente
        </button>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
