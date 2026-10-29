"use client";
import { createClient } from "@/lib/supabase/client";
import type { Lancamento } from "@/types/app.types";

const supabase = createClient();

// Financeiro de Obras (Dashboard/DRE/Fluxo de Caixa/Por Obra) — exclui
// lançamentos de Serviços Técnicos explicitamente. Reaproveitar a mesma
// tabela/engine não pode significar somar os dois financeiros juntos
// (regra confirmada pelo usuário) — ver lancamentosServico.service.ts pro
// equivalente do lado de Serviços Técnicos.
export async function getLancamentos(): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .is("servico_id", null)
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
