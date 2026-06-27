import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xl">
            🏗
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">ObraFlow</span>
        </div>
        <LoginForm />
        <p className="text-center text-slate-600 text-xs mt-8">
          ObraFlow © {new Date().getFullYear()} · Gestão de Obras Financiadas
        </p>
      </div>
    </main>
  );
}
