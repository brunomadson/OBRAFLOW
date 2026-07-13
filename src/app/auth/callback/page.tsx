"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { processarSessaoDoHash } from "@/lib/supabase/processarSessaoDoHash";

// Recebe o retorno de e-mails de confirmação (cadastro) e convite de
// membro. Precisa ser uma página client, não uma rota de servidor: os
// links que a Supabase gera pra esses dois fluxos vêm com o token depois
// do "#" (fragment), que o navegador NUNCA envia pro servidor — só o
// próprio navegador consegue processar isso. O client do Supabase
// (detectSessionInUrl: true) faz essa leitura sozinho ao carregar a
// página; só precisamos esperar a sessão aparecer.
//
// Achado em produção: a versão antiga disto era uma rota de servidor
// (route.ts) que só sabia ler "?code=" (fluxo PKCE) — nenhum dos dois
// fluxos reais deste app usa esse formato, os dois usam "#access_token=",
// então TODO clique em link de confirmação de cadastro ou de convite
// caía direto no fallback e mandava a pessoa pro /login sem explicação.
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [pronto, setPronto] = useState(false);
  const next = searchParams.get("next") ?? "/comercial";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setPronto(true);
    });

    // Processa manualmente o token do "#" antes de esperar passivamente —
    // ver processarSessaoDoHash.ts pro motivo de não confiar só na
    // detecção automática do SDK.
    processarSessaoDoHash().then((processou) => {
      if (processou) { setPronto(true); return; }
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setPronto(true);
      });
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pronto) router.replace(next);
  }, [pronto, next, router]);

  // Sem sessão após alguns segundos → link inválido/expirado, volta pro login
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!pronto) router.replace("/login");
    }, 6000);
    return () => clearTimeout(timer);
  }, [pronto, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
