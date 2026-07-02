"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createWorkspaceAndLink } from "@/services/workspaces.service";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [tipo, setTipo]           = useState<"PJ" | "PF">("PJ");
  const [nome, setNome]           = useState("");
  const [documento, setDocumento] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (profile?.workspace_id) { router.push("/comercial"); }
  }, [user, profile, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe o nome"); return; }

    setSubmitting(true);
    try {
      await createWorkspaceAndLink({
        nome: nome.trim(),
        tipo_conta: tipo,
        documento: documento.trim() || null,
      });
      await refreshProfile();
      toast.success("Workspace criado! Bem-vindo ao ObraFlow.");
      router.push("/comercial");
    } catch {
      toast.error("Erro ao criar workspace. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xl">
            🏗
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">ObraFlow</span>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
          <h1 className="text-white text-xl font-extrabold mb-1">
            Configure seu workspace
          </h1>
          <p className="text-slate-500 text-sm mb-7">
            Vamos criar o espaço da sua empresa ou atuação profissional.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Tipo PF / PJ */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Tipo de conta
              </label>
              <div className="flex gap-2">
                {(["PJ", "PF"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer",
                      tipo === t
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    )}
                  >
                    {t === "PJ" ? "Empresa (PJ)" : "Autônomo (PF)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {tipo === "PJ" ? "Nome da empresa" : "Seu nome"}
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={tipo === "PJ" ? "Ex: Construtora Exemplo Ltda" : "Ex: João Silva"}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Documento */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                {tipo === "PJ" ? "CNPJ" : "CPF"}
                <span className="text-slate-600 font-normal ml-1">(opcional)</span>
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder={tipo === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-sm rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
            >
              {submitting ? "Criando..." : "Criar workspace e entrar"}
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
