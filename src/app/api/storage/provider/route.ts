import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";
import { createAdminClient } from "@/lib/supabase/admin";

const VALIDOS = ["supabase", "google_drive", "dropbox", "onedrive"];

export async function GET() {
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin.from("workspaces").select("storage_provider").eq("id", ctx.workspaceId).single<{ storage_provider: string }>();
  return NextResponse.json({ provider: data?.storage_provider ?? "supabase" });
}

// PATCH /api/storage/provider — troca o destino padrão de upload NOVO do
// workspace. Documento já existente nunca migra sozinho (ver
// documentoHibrido.service.ts) — trocar de provider é só pra frente.
export async function PATCH(req: NextRequest) {
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await ctx.pode("integracoes", "editar"))) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = body.provider as string | undefined;
  if (!provider || !VALIDOS.includes(provider)) {
    return NextResponse.json({ error: "provider inválido" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (provider !== "supabase") {
    // Só permite trocar pra um provider que já está conectado de
    // verdade — não dá pra "escolher" Google Drive antes de ter feito o
    // OAuth (senão todo upload novo falharia até reconectar).
    const { data: integracao } = await admin.from("integracoes").select("id").eq("codigo", provider).maybeSingle<{ id: string }>();
    const { data: conexao } = integracao
      ? await admin.from("workspace_integracoes").select("status").eq("workspace_id", ctx.workspaceId).eq("integracao_id", integracao.id).maybeSingle<{ status: string }>()
      : { data: null };
    if (conexao?.status !== "conectado") {
      return NextResponse.json({ error: `Conecte "${provider}" antes de defini-lo como armazenamento padrão.` }, { status: 400 });
    }
  }

  const { error } = await admin.from("workspaces").update({ storage_provider: provider } as never).eq("id", ctx.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
