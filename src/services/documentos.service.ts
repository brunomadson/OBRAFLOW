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

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadDocumento(params: {
  file: File;
  lead_id?: string;
  obra_id?: string;
  secao: string;
  tipo_doc: string;
}): Promise<Documento> {
  const { file, lead_id, obra_id, secao, tipo_doc } = params;

  // Monta o caminho: {ownerId}/{secao}/{tipo_doc}_{timestamp}.{ext}
  const ownerId = lead_id ?? obra_id ?? "sem-id";
  const timestamp = Date.now();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const nomeSeguro = tipo_doc.replace(/[^a-z0-9_-]/gi, "_");
  const storagePath = `${ownerId}/${secao}/${nomeSeguro}_${timestamp}.${ext}`;

  const storage = getStorageProvider();

  // 1. Envia para o storage
  await storage.upload({ file, path: storagePath });

  // 2. Salva registro no banco
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
    } as never)
    .select()
    .single();

  if (error) {
    // Rollback do arquivo no storage se o banco falhar
    await storage.delete(storagePath).catch(() => {});
    throw error;
  }

  return data as Documento;
}

// ── Download (URL assinada temporária) ───────────────────────────────────────

export async function getDocumentoUrl(storagePath: string): Promise<string> {
  const storage = getStorageProvider();
  return storage.getSignedUrl(storagePath, 3600); // 1 hora
}

// ── Exclusão ──────────────────────────────────────────────────────────────────

export async function deleteDocumento(doc: Documento): Promise<void> {
  const storage = getStorageProvider();

  // 1. Remove do storage
  await storage.delete(doc.storage_path);

  // 2. Marca como inativo no banco (soft delete)
  const { error } = await supabase
    .from("documentos")
    .update({ ativo: false } as never)
    .eq("id", doc.id);

  if (error) throw error;
}
