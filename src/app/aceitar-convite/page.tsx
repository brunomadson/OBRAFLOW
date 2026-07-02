"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function AceitarConvitePage() {
  const supabase = createClient();
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase processa os tokens do magic link na URL automaticamente.
    // Ouvimos o evento SIGNED_IN para saber quando a sessão está pronta.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setPronto(true);
      }
    });

    // Também verifica sessão existente (caso o usuário já estivesse logado)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sem sessão após 5 segundos → redireciona para login
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!pronto) router.replace("/login");
    }, 5000);
    return () => clearTimeout(timer);
  }, [pronto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    if (senha !== confirmar) { toast.error("Senhas não conferem"); return; }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSaving(false);

    if (error) { toast.error(error.message); return; }

    // Redireciona para o setor do usuário
    const { data: { user } } = await supabase.auth.getUser();
    let destino = "/comercial";
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("setores")
        .eq("id", user.id)
        .single();
      const primeiroSetor = (profile?.setores as string[] | null)?.[0];
      if (primeiroSetor && primeiroSetor !== "configuracoes") {
        destino = `/${primeiroSetor}`;
      }
    }

    toast.success("Senha criada! Bem-vindo ao ObraFlow.");
    router.push(destino);
  };

  if (!pronto) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xl">
            🏗
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">ObraFlow</span>
        </div>

        <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
          <h1 className="text-white text-xl font-extrabold mb-1">
            Você foi convidado!
          </h1>
          <p className="text-slate-500 text-sm mb-7">
            Defina uma senha para acessar o sistema.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Nova Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Confirmar Senha
              </label>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 text-sm rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
            >
              {saving ? "Salvando..." : "Criar senha e entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          ObraFlow © {new Date().getFullYear()} · Gestão de Obras Financiadas
        </p>
      </div>
    </main>
  );
}
