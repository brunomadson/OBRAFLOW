"use client";
import { createClient } from "@/lib/supabase/client";
import type { Indicador } from "@/types/app.types";

const supabase = createClient();

export async function getIndicadores(): Promise<Indicador[]> {
  const { data, error } = await supabase
    .from("indicadores")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Indicador[];
}

export async function createIndicador(input: Omit<Indicador, "id">): Promise<Indicador> {
  const { data, error } = await supabase
    .from("indicadores")
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as Indicador;
}

export async function deleteIndicador(id: string): Promise<void> {
  const { error } = await supabase.from("indicadores").update({ ativo: false } as never).eq("id", id);
  if (error) throw error;
}
