"use client";
import { createClient } from "@/lib/supabase/client";
import type { CategoriaServico } from "@/types/app.types";

const supabase = createClient();

export async function getCategoriasServico(): Promise<CategoriaServico[]> {
  const { data, error } = await supabase
    .from("categorias_servico")
    .select("*")
    .order("ordem")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as CategoriaServico[];
}

export async function createCategoriaServico(
  input: Omit<CategoriaServico, "id">
): Promise<CategoriaServico> {
  const { data, error } = await supabase
    .from("categorias_servico")
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as CategoriaServico;
}

export async function updateCategoriaServico(id: string, input: Partial<CategoriaServico>): Promise<CategoriaServico> {
  const { data, error } = await supabase
    .from("categorias_servico")
    .update(input as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CategoriaServico;
}
