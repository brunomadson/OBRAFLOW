import { NextRequest, NextResponse } from "next/server";
import { getSaasAdminUser } from "@/lib/supabase/requireSaasAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

interface PlanoRow {
  id: string;
}
interface SubscriptionRow {
  id: string;
  status: string;
}

interface Body {
  ativo?: boolean; // suspender/reativar (kill-switch independente da cobrança)
  plano_codigo?: string; // trocar o plano da assinatura vigente
  ativar_manual?: boolean; // criar/ativar assinatura sem gateway (cortesia, teste, negociação manual)
}

// PATCH /api/admin/clientes/:workspaceId — as 3 ações do ticket
// ("alterar plano", "ativar assinatura manualmente", "suspender cliente")
// num único endpoint, cada campo do body é independente (pode mandar 1 ou
// mais de uma vez).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const admin = await getSaasAdminUser();
  if (!admin) return NextResponse.json({ error: "não autorizado" }, { status: 403 });

  const { workspaceId } = await params;
  const body: Body = await req.json();
  const db = createAdminClient();

  if (typeof body.ativo === "boolean") {
    const { error } = await db.from("workspaces").update({ ativo: body.ativo } as never).eq("id", workspaceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.plano_codigo) {
    const { data: plano, error: planoErr } = await db
      .from("planos")
      .select("id")
      .eq("codigo", body.plano_codigo)
      .maybeSingle<PlanoRow>();
    if (planoErr) return NextResponse.json({ error: planoErr.message }, { status: 500 });
    if (!plano) return NextResponse.json({ error: `plano "${body.plano_codigo}" não existe` }, { status: 400 });

    const { data: atual } = await db
      .from("subscriptions")
      .select("id, status")
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle<SubscriptionRow>();

    if (atual) {
      const { error } = await db.from("subscriptions").update({ plan_id: plano.id } as never).eq("id", atual.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Sem assinatura vigente ainda — trocar plano vira "criar assinatura manual" nesse plano.
      const { error } = await db.from("subscriptions").insert({
        workspace_id: workspaceId,
        plan_id: plano.id,
        gateway_provider: "manual",
        status: "active",
        subscription_start: new Date().toISOString(),
      } as never);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.ativar_manual) {
    const { data: atual } = await db
      .from("subscriptions")
      .select("id, status")
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "trialing", "past_due", "canceled", "expired"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRow>();

    if (atual) {
      const { error } = await db
        .from("subscriptions")
        .update({ status: "active", canceled_at: null } as never)
        .eq("id", atual.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json(
        { error: "workspace sem nenhuma assinatura ainda — mande plano_codigo junto pra criar uma" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
