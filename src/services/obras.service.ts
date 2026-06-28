"use client";
import { createClient } from "@/lib/supabase/client";
import type { Obra, Medicao } from "@/types/app.types";

const supabase = createClient();

export async function getObras(): Promise<Obra[]> {
  const { data, error } = await supabase
    .from("obras")
    .select("*, log:obra_log(*), medicoes(*), correspondente:correspondentes(*)")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Obra[];
}

export async function getObra(id: string): Promise<Obra | null> {
  const { data, error } = await supabase
    .from("obras")
    .select("*, log:obra_log(*), medicoes(*), correspondente:correspondentes(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as Obra;
}

export async function createObra(payload: Omit<Obra, "id" | "created_at" | "updated_at" | "log" | "medicoes" | "correspondente">): Promise<Obra> {
  const { data, error } = await supabase
    .from("obras")
    .insert(payload as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Obra;
}

export async function updateObra(id: string, payload: Partial<Obra>): Promise<Obra> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at, updated_at, log, medicoes, correspondente, ...rest } = payload as Obra;
  const { data, error } = await supabase
    .from("obras")
    .update(rest as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Obra;
}

export async function registrarLogObra(obraId: string, etapa: string): Promise<void> {
  const { error } = await supabase
    .from("obra_log")
    .insert({ obra_id: obraId, etapa });
  if (error) throw error;
}

// ─── Medições ─────────────────────────────────────────────────────────────────
export async function upsertMedicao(medicao: Partial<Medicao> & { obra_id: string }): Promise<Medicao> {
  // Nunca enviar campos gerenciados pelo DB
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, updated_at, ...fields } = medicao as Medicao;

  if (id) {
    const { data, error } = await supabase
      .from("medicoes")
      .update(fields as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Medicao;
  } else {
    const { data, error } = await supabase
      .from("medicoes")
      .insert(fields as never)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Medicao;
  }
}

export async function deleteMedicao(id: string): Promise<void> {
  const { error } = await supabase.from("medicoes").delete().eq("id", id);
  if (error) throw error;
}
