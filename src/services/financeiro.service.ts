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

export async function updateLancamento(
  id: string,
  payload: Partial<Lancamento>
): Promise<Lancamento> {
  const { data, error } = await supabase
    .from("lancamentos")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Lancamento;
}

export async function pagarLancamento(id: string): Promise<Lancamento> {
  const { data, error } = await supabase
    .from("lancamentos")
    .update({
      status_pagamento: "pago",
      data_confirmacao: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Lancamento;
}

export async function deleteLancamento(id: string): Promise<void> {
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
}
