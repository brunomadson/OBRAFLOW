"use client";
import { createClient } from "@/lib/supabase/client";
import type { ContaBancaria } from "@/types/app.types";

const supabase = createClient();

export async function getContasBancarias(): Promise<ContaBancaria[]> {
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("id, nome, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as ContaBancaria[];
}

export async function createContaBancaria(nome: string): Promise<ContaBancaria> {
  const { data, error } = await supabase
    .from("contas_bancarias")
    .insert({ nome, ativo: true } as never)
    .select("id, nome, ativo")
    .single();
  if (error) throw error;
  return data as ContaBancaria;
}

export async function deleteContaBancaria(id: string): Promise<void> {
  const { error } = await supabase
    .from("contas_bancarias")
    .update({ ativo: false } as never)
    .eq("id", id);
  if (error) throw error;
}
