"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { processarSessaoDoHash } from "@/lib/supabase/processarSessaoDoHash";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router   = useRouter();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setPronto(true);
    });

    // Processa manualmente o token do "#" do e-mail de recuperação — ver
    // processarSessaoDoHash.ts pro motivo de não confiar só na detecção
    // automática do SDK.
    processarSessaoDoHash().then((processou) => {
      if (processou) { setPronto(true); return; }
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setPronto(true);
      });
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sem sessão após alguns segundos → link inválido/expirado
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!pronto) {
        toast.error("Link inválido ou expirado. Solicite a recuperação de senha novamente.");
        router.replace("/login");
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [pronto, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8)       { toast.error("Mínimo 8 caracteres."); return; }
    if (senha !== confirm)      { toast.error("Senhas não conferem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha redefinida! Faça o login.");
    router.push("/login");
  };

  if (!pronto) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏗</div>
          <h1 className="text-2xl font-extrabold text-slate-900">ObraFlow</h1>
          <p className="text-slate-500 mt-1 text-sm">Redefinir senha</p>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">Nova Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="input-base"
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>
            <div>
              <label className="field-label">Confirmar Senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-base"
                placeholder="Repita a senha"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? "Salvando..." : "Redefinir Senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
