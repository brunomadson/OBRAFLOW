"use client";
import { createClient } from "@/lib/supabase/client";
import type { Cidade } from "@/types/app.types";

const supabase = createClient();

export async function getCidades(): Promise<Cidade[]> {
  const { data, error } = await supabase
    .from("cidades")
    .select("id, nome, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Cidade[];
}

export async function createCidade(nome: string): Promise<Cidade> {
  const { data, error } = await supabase
    .from("cidades")
    .insert({ nome: nome.trim(), ativo: true } as never)
    .select("id, nome, ativo")
    .single();
  if (error) throw error;
  return data as Cidade;
}

export async function deleteCidade(id: string): Promise<void> {
  const { error } = await supabase
    .from("cidades")
    .update({ ativo: false } as never)
    .eq("id", id);
  if (error) throw error;
}
