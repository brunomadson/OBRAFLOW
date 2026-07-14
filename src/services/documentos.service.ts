"use client";
import { createClient } from "@/lib/supabase/client";
import { getStorageProvider } from "@/services/storage";
import type { Documento } from "@/types/app.types";

const supabase = createClient();

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function getDocumentos(params: {
  lead_id?: string;
  obra_id?: string;
}): Promise<Documento[]> {
  const { lead_id, obra_id } = params;

  let query = supabase
    .from("documentos")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  if (lead_id && obra_id) {
    query = query.or(`lead_id.eq.${lead_id},obra_id.eq.${obra_id}`);
  } else if (lead_id) {
    query = query.eq("lead_id", lead_id);
  } else if (obra_id) {
    query = query.eq("obra_id", obra_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Documento[];
}

async function workspaceUsaStorageExterno(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("workspace_id, workspaces(storage_provider)")
    .eq("id", user.id)
    .maybeSingle<{ workspace_id: string | null; workspaces: { storage_provider: string } | null }>();
  return (data?.workspaces?.storage_provider ?? "supabase") !== "supabase";
}

// ── Upload ────────────────────────────────────────────────────────────────────
//
// Sprint 11.2 — storage híbrido: se o workspace usa Supabase (padrão,
// imensa maioria dos casos hoje), segue o caminho direto de sempre, sem
// nenhuma mudança de comportamento. Só quando o workspace conectou um
// provider externo é que passamos pela rota /api/storage/documentos, que
// decide onde salvar de verdade (e cai pro Supabase como reserva se o
// provider externo falhar — ver documentoHibrido.service.ts).

export async function uploadDocumento(params: {
  file: File;
  lead_id?: string;
  obra_id?: string;
  secao: string;
  tipo_doc: string;
}): Promise<Documento> {
  const { file, lead_id, obra_id, secao, tipo_doc } = params;

  if (await workspaceUsaStorageExterno()) {
    const form = new FormData();
    form.append("file", file);
    if (lead_id) form.append("lead_id", lead_id);
    if (obra_id) form.append("obra_id", obra_id);
    form.append("secao", secao);
    form.append("tipo_doc", tipo_doc);

    const res = await fetch("/api/storage/documentos", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao enviar documento.");
    return data.documento as Documento;
  }

  // Caminho padrão Supabase (inalterado).
  const ownerId = lead_id ?? obra_id ?? "sem-id";
  const timestamp = Date.now();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const nomeSeguro = tipo_doc.replace(/[^a-z0-9_-]/gi, "_");
  const storagePath = `${ownerId}/${secao}/${nomeSeguro}_${timestamp}.${ext}`;

  const storage = getStorageProvider();
  await storage.upload({ file, path: storagePath });

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("documentos")
    .insert({
      lead_id: lead_id ?? null,
      obra_id: obra_id ?? null,
      secao,
      tipo_doc,
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      mime_type: file.type || null,
      storage_path: storagePath,
      usuario_id: user?.id ?? null,
    } as never)
    .select()
    .single();

  if (error) {
    await storage.delete(storagePath).catch(() => {});
    throw error;
  }

  return data as Documento;
}

// ── Download (URL assinada temporária) ───────────────────────────────────────
//
// Sempre passa pela rota — ela mesma decide se o documento está no
// externo ou no Supabase (por documento, não por workspace: um workspace
// que trocou de provider pode ter documentos antigos em cada lugar).

export async function getDocumentoUrl(documentoId: string): Promise<string> {
  return `/api/storage/documentos/${documentoId}`;
}

// ── Exclusão ──────────────────────────────────────────────────────────────────

export async function deleteDocumento(doc: Documento): Promise<void> {
  const res = await fetch(`/api/storage/documentos/${doc.id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao excluir documento.");

  // A rota já sabe se o arquivo físico estava no Drive (nada a fazer
  // aqui) ou ainda no bucket do Supabase (inclusive documento
  // 'pendente_migracao', que fisicamente nunca saiu de lá).
  if (data.removerDoSupabase !== false) {
    const storage = getStorageProvider();
    await storage.delete(doc.storage_path).catch(() => {});
  }

  const { error } = await supabase.from("documentos").update({ ativo: false } as never).eq("id", doc.id);
  if (error) throw error;
}
