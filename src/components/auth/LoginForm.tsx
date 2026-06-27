"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast from "react-hot-toast";

export default function LoginForm() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [mode, setMode]         = useState<"login" | "reset">("login");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Credenciais inválidas. Verifique e tente novamente.");
    } else {
      toast.success("Bem-vindo!");
      router.push("/comercial");
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Informe seu e-mail"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Erro ao enviar. Verifique o e-mail.");
    } else {
      toast.success("Link de recuperação enviado! Verifique seu e-mail.");
      setMode("login");
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
      <h1 className="text-white text-xl font-extrabold mb-1">
        {mode === "login" ? "Entrar na plataforma" : "Recuperar senha"}
      </h1>
      <p className="text-slate-500 text-sm mb-7">
        {mode === "login"
          ? "Acesse com seu e-mail e senha cadastrados."
          : "Enviaremos um link para redefinir sua senha."}
      </p>

      <form onSubmit={mode === "login" ? handleLogin : handleReset} className="space-y-4">
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

        {mode === "login" && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm cursor-pointer border-none bg-transparent"
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          className="w-full py-3 text-sm rounded-xl"
        >
          {mode === "login" ? "Entrar" : "Enviar link de recuperação"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "reset" : "login")}
        className="mt-5 text-xs text-slate-500 hover:text-slate-300 cursor-pointer border-none bg-transparent block text-center w-full transition-colors"
      >
        {mode === "login" ? "Esqueci minha senha" : "← Voltar para o login"}
      </button>
    </div>
  );
}
