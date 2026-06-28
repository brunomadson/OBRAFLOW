"use client";
import { createClient } from "@/lib/supabase/client";
import type { Historico } from "@/types/app.types";

const supabase = createClient();

export async function getHistorico(params: {
  lead_id?: string;
  obra_id?: string;
}): Promise<Historico[]> {
  const { lead_id, obra_id } = params;

  let query = supabase
    .from("historico")
    .select("*")
    .order("created_at", { ascending: false });

  if (lead_id && obra_id) {
    query = query.or(`lead_id.eq.${lead_id},obra_id.eq.${obra_id}`);
  } else if (lead_id) {
    query = query.eq("lead_id", lead_id);
  } else if (obra_id) {
    query = query.eq("obra_id", obra_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Historico[];
}

export async function registrarHistorico(
  entry: Omit<Historico, "id" | "created_at">
): Promise<void> {
  const { error } = await supabase
    .from("historico")
    .insert(entry as never);
  if (error) console.error("Erro ao registrar histórico:", error);
}
