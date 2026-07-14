import { NextRequest, NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { baixarDocumentoHibrido, excluirDocumentoHibrido } from "@/services/storage/documentoHibrido.service";
import { getWorkspaceUserContext } from "@/lib/supabase/requireWorkspaceUser";

// GET → baixa os bytes (do Drive se estiver lá, senão delega pro Supabase
// Storage normal). DELETE → apaga do provider externo (se aplicável) e
// deixa o soft-delete de `documentos.ativo` por conta de quem chama, como
// já era antes (não mudei esse contrato).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!(await ctx.pode("documentos", "visualizar"))) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  // Documento precisa ser visível pra este usuário pela RLS normal de
  // `documentos` antes de tentarmos buscar o arquivo — usa o client de
  // sessão (não admin) só pra essa checagem de existência/visibilidade.
  const supabase = await createSessionClient();
  const { data: doc } = await supabase
    .from("documentos")
    .select("id, storage_path, mime_type, nome_arquivo")
    .eq("id", id)
    .maybeSingle<{ id: string; storage_path: string; mime_type: string | null; nome_arquivo: string }>();
  if (!doc) return NextResponse.json({ error: "documento não encontrado" }, { status: 404 });

  const externo = await baixarDocumentoHibrido(ctx.workspaceId, ctx.userId, id);
  if (externo) {
    return new NextResponse(externo.bytes, {
      headers: {
        "Content-Type": externo.mimeType ?? doc.mime_type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${externo.nome}"`,
      },
    });
  }

  const { data: signed, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 3600);
  if (error || !signed) return NextResponse.json({ error: "arquivo não encontrado no storage" }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getWorkspaceUserContext();
  if (!ctx) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  try {
    const { removerDoSupabase } = await excluirDocumentoHibrido(ctx.workspaceId, ctx.userId, id);
    return NextResponse.json({ ok: true, removerDoSupabase });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
