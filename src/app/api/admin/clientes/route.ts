import { NextResponse } from "next/server";
import { getSaasAdminUser } from "@/lib/supabase/requireSaasAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

interface WorkspaceRow {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}
interface SubscriptionRow {
  id: string;
  workspace_id: string;
  plan_id: string;
  gateway_provider: string;
  status: string;
  trial_start: string | null;
  subscription_start: string | null;
  next_billing_date: string | null;
  canceled_at: string | null;
}
interface PlanoRow {
  id: string;
  codigo: string;
  nome: string;
}

// GET /api/admin/clientes — lista todos os workspaces com a assinatura
// vigente (se houver) e o nome do plano. Cross-tenant de propósito — é a
// única rota do sistema que enxerga todos os workspaces de uma vez, por
// isso a checagem is_saas_admin() é obrigatória e vem antes de tudo.
export async function GET() {
  const admin = await getSaasAdminUser();
  if (!admin) return NextResponse.json({ error: "não autorizado" }, { status: 403 });

  const db = createAdminClient();

  const [{ data: workspaces, error: wErr }, { data: subscriptions, error: sErr }, { data: planos, error: pErr }] =
    await Promise.all([
      db.from("workspaces").select("id, nome, ativo, created_at").order("created_at", { ascending: false }).returns<WorkspaceRow[]>(),
      db.from("subscriptions").select("id, workspace_id, plan_id, gateway_provider, status, trial_start, subscription_start, next_billing_date, canceled_at").in("status", ["active", "trialing", "past_due"]).returns<SubscriptionRow[]>(),
      db.from("planos").select("id, codigo, nome").returns<PlanoRow[]>(),
    ]);

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const subPorWorkspace = new Map((subscriptions ?? []).map((s) => [s.workspace_id, s]));
  const planoPorId = new Map((planos ?? []).map((p) => [p.id, p]));

  const clientes = (workspaces ?? []).map((w) => {
    const sub = subPorWorkspace.get(w.id) ?? null;
    const plano = sub ? planoPorId.get(sub.plan_id) ?? null : null;
    return {
      workspace: w,
      subscription: sub,
      plano,
    };
  });

  return NextResponse.json({ clientes, planos: planos ?? [] });
}
