"use client";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";

// Destino do bloqueio real (server-side, ver middleware.ts + migration 042)
// pra workspace com assinatura cancelada/expirada ou suspenso pelo painel
// admin (workspaces.ativo=false). Rota pública (não exige assinatura pra
// carregar, senão ninguém veria essa mensagem).
export default function AssinaturaPendentePage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-4xl">🏗</div>
      <h1 className="text-white text-xl font-extrabold">Acesso suspenso</h1>
      <p className="text-slate-400 text-sm max-w-sm">
        A assinatura desta conta não está ativa no momento. Fale com o
        administrador do workspace ou com o suporte do ObraFlow pra
        regularizar o acesso.
      </p>
      <Button variant="secondary" size="sm" onClick={signOut}>Sair</Button>
    </div>
  );
}
