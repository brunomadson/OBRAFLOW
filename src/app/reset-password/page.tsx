"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router   = useRouter();
  const [senha, setSenha]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

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
