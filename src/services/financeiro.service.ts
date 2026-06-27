"use client";
import { createClient } from "@/lib/supabase/client";
import type { Lancamento } from "@/types/app.types";

const supabase = createClient();

export async function getLancamentos(): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lancamento[];
}

export async function createLancamento(
  payload: Omit<Lancamento, "id" | "created_at">
): Promise<Lancamento> {
  const { data, error } = await supabase
    .from("lancamentos")
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as Lancamento;
}

export async function deleteLancamento(id: string): Promise<void> {
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
}
