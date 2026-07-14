import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadDocumentoHibrido, promoverPendentes } from "@/services/storage/documentoHibrido.service";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";

// POST /api/storage/documentos — upload de documento, decide sozinho se
// vai pro Supabase (padrão) ou pro provider externo do workspace. O
// client (documentos.service.ts) sempre chama esta rota igual, não
// precisa saber onde o arquivo termina — "usuário nunca percebe
// diferença" (ticket, Sprint 11.2).
export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await ctx.pode("documentos", "criar"))) {
    return NextResponse.json({ error: "sem permissão pra enviar documento" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const leadId = form.get("lead_id")?.toString() || null;
  const obraId = form.get("obra_id")?.toString() || null;
  const secao = form.get("secao")?.toString();
  const tipoDoc = form.get("tipo_doc")?.toString();

  if (!(file instanceof File) || !secao || !tipoDoc || (!leadId && !obraId)) {
    return NextResponse.json({ error: "parâmetros ausentes (file, secao, tipo_doc, lead_id ou obra_id)" }, { status: 400 });
  }

  const supabase = await createSessionClient();

  // Nome do cliente + cidade vêm do lead/obra — o client não manda (evita
  // qualquer chance de nome de pasta divergir do cadastro real).
  let nomeCliente = "Cliente";
  let cidade: string | null = null;
  if (leadId) {
    const { data: lead } = await supabase.from("leads").select("nome, cidade").eq("id", leadId).maybeSingle<{ nome: string; cidade: string | null }>();
    if (lead) { nomeCliente = lead.nome; cidade = lead.cidade; }
  } else if (obraId) {
    const { data: obra } = await supabase.from("obras").select("cliente, nome, cidade").eq("id", obraId).maybeSingle<{ cliente: string | null; nome: string | null; cidade: string | null }>();
    if (obra) { nomeCliente = obra.cliente ?? obra.nome ?? "Cliente"; cidade = obra.cidade; }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let resultado;
  try {
    resultado = await uploadDocumentoHibrido({
      workspaceId: ctx.workspaceId, userId: ctx.userId,
      leadId, obraId, secao, tipoDoc, nomeCliente, cidade,
      nomeOriginal: file.name, mimeType: file.type || "application/octet-stream", bytes,
    });
  } catch (e) {
    console.error("[/api/storage/documentos] falha no upload híbrido:", e);
    return NextResponse.json({ error: "falha ao enviar o arquivo" }, { status: 500 });
  }

  const { data: documento, error: docErr } = await supabase
    .from("documentos")
    .insert({
      lead_id: leadId, obra_id: obraId, secao, tipo_doc: tipoDoc,
      nome_arquivo: resultado.syncRow?.nome_padronizado ?? file.name,
      tamanho_bytes: file.size, mime_type: file.type || null,
      storage_path: resultado.storagePath, usuario_id: ctx.userId,
    } as never)
    .select()
    .single();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  if (resultado.syncRow) {
    const admin = createAdminClient();
    await admin.from("document_storage_sync").insert({
      workspace_id: ctx.workspaceId,
      documento_id: (documento as { id: string }).id,
      ...resultado.syncRow,
      ultima_sincronizacao: resultado.syncRow.sync_status === "sincronizado" ? new Date().toISOString() : null,
    } as never);
  }

  // Se acabamos de confirmar que a conexão está saudável (upload externo
  // deu certo), aproveita o momento pra promover qualquer coisa que
  // tenha ficado pendente de uma falha anterior — sem precisar de job
  // agendado nenhum pra isso funcionar (regra combinada na conversa).
  if (resultado.syncRow?.sync_status === "sincronizado") {
    promoverPendentes({ workspaceId: ctx.workspaceId, userId: ctx.userId }).catch((e) =>
      console.error("[/api/storage/documentos] falha ao promover pendentes:", e)
    );
  }

  return NextResponse.json({ documento });
}
