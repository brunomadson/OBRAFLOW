"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function CadastroPage() {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome]           = useState("");
  const [email, setEmail]         = useState("");
  const [senha, setSenha]         = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe seu nome"); return; }
    if (!email.trim()) { toast.error("Informe seu e-mail"); return; }
    if (senha.length < 8) { toast.error("Senha deve ter no mínimo 8 caracteres"); return; }
    if (senha !== confirmar) { toast.error("Senhas não conferem"); return; }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: { nome: nome.trim() },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });
    setSubmitting(false);

    if (error) {
      if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already exists")) {
        toast.error("Este e-mail já está cadastrado. Faça login.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    if (data.session) {
      toast.success("Conta criada! Bem-vindo ao ObraFlow.");
      router.push("/onboarding");
    } else {
      setAguardandoEmail(true);
    }
  };

  if (aguardandoEmail) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 justify-center mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xl">
              🏗
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">ObraFlow</span>
          </div>

          <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 text-center">
            <h1 className="text-white text-xl font-extrabold mb-1">
              Confirme seu e-mail
            </h1>
            <p className="text-slate-500 text-sm">
              Enviamos um link de confirmação para <span className="text-slate-300">{email}</span>.
              Clique no link para ativar sua conta e continuar.
            </p>
          </div>
        </div>
      </main>
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
            Criar sua conta
          </h1>
          <p className="text-slate-500 text-sm mb-7">
            Comece a gerenciar suas obras em minutos.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                autoComplete="name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                autoComplete="email"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-sm rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
            >
              {submitting ? "Criando conta..." : "Criar conta"}
            </button>
          </form>

          <Link
            href="/login"
            className="mt-5 text-xs text-slate-500 hover:text-slate-300 block text-center transition-colors"
          >
            Já tem conta? Entrar
          </Link>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          ObraFlow © {new Date().getFullYear()} · Gestão de Obras Financiadas
        </p>
      </div>
    </main>
  );
}
