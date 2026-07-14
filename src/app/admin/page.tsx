"use client";
import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";

interface Workspace {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}
interface Subscription {
  id: string;
  status: string;
  gateway_provider: string;
  next_billing_date: string | null;
}
interface Plano {
  id: string;
  codigo: string;
  nome: string;
}
interface Cliente {
  workspace: Workspace;
  subscription: Subscription | null;
  plano: Plano | null;
}

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  active: { texto: "Ativo", classe: "bg-emerald-100 text-emerald-700" },
  trialing: { texto: "Trial", classe: "bg-blue-100 text-blue-700" },
  past_due: { texto: "Atrasado", classe: "bg-amber-100 text-amber-700" },
  canceled: { texto: "Cancelado", classe: "bg-slate-200 text-slate-600" },
  expired: { texto: "Expirado", classe: "bg-slate-200 text-slate-600" },
};

// Painel interno do SaaS — não é uma tela de workspace, é cross-tenant de
// propósito. Protegida de verdade pela API (is_saas_admin(), ver
// requireSaasAdmin.ts); aqui só tratamos o 403 com uma mensagem neutra.
export default function AdminPage() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [negado, setNegado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/admin/clientes");
    if (res.status === 403) {
      setNegado(true);
      setCarregando(false);
      return;
    }
    if (!res.ok) {
      toast.error("Erro ao carregar clientes.");
      setCarregando(false);
      return;
    }
    const data = await res.json();
    setClientes(data.clientes);
    setPlanos(data.planos);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const atualizar = async (workspaceId: string, body: Record<string, unknown>) => {
    setSalvandoId(workspaceId);
    try {
      const res = await fetch(`/api/admin/clientes/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao salvar."); return; }
      toast.success("Atualizado!");
      await carregar();
    } finally {
      setSalvandoId(null);
    }
  };

  if (negado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Página não encontrada.</p>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl font-extrabold text-slate-900 mb-1">Administração ObraFlow</h1>
        <p className="text-sm text-slate-500 mb-6">Clientes, planos e assinaturas — visão interna, fora do workspace.</p>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="p-3 font-semibold">Workspace</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Plano</th>
                <th className="p-3 font-semibold">Gateway</th>
                <th className="p-3 font-semibold">Próxima cobrança</th>
                <th className="p-3 font-semibold">Conta</th>
                <th className="p-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(clientes ?? []).map(({ workspace, subscription, plano }) => {
                const statusInfo = subscription ? STATUS_LABEL[subscription.status] : null;
                const salvando = salvandoId === workspace.id;
                return (
                  <tr key={workspace.id} className="border-b border-slate-50 last:border-0">
                    <td className="p-3 font-medium text-slate-800">{workspace.nome}</td>
                    <td className="p-3">
                      {statusInfo ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusInfo.classe}`}>
                          {statusInfo.texto}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Sem assinatura</span>
                      )}
                    </td>
                    <td className="p-3">
                      <select
                        className="input-base !py-1 !text-xs"
                        value={plano?.codigo ?? ""}
                        disabled={salvando}
                        onChange={(e) => atualizar(workspace.id, { plano_codigo: e.target.value })}
                      >
                        <option value="" disabled>Selecionar...</option>
                        {planos.map((p) => <option key={p.id} value={p.codigo}>{p.nome}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-xs text-slate-500">{subscription?.gateway_provider ?? "—"}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {subscription?.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold ${workspace.ativo ? "text-emerald-600" : "text-red-600"}`}>
                        {workspace.ativo ? "Ativa" : "Suspensa"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {!subscription && (
                          <Button size="sm" variant="success" loading={salvando}
                            onClick={() => atualizar(workspace.id, { ativar_manual: true, plano_codigo: planos[0]?.codigo })}>
                            Ativar
                          </Button>
                        )}
                        {subscription && subscription.status !== "active" && (
                          <Button size="sm" variant="success" loading={salvando}
                            onClick={() => atualizar(workspace.id, { ativar_manual: true })}>
                            Reativar
                          </Button>
                        )}
                        <Button size="sm" variant={workspace.ativo ? "danger" : "secondary"} loading={salvando}
                          onClick={() => atualizar(workspace.id, { ativo: !workspace.ativo })}>
                          {workspace.ativo ? "Suspender" : "Reativar conta"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
