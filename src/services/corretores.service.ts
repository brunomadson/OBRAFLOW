"use client";
import { createClient } from "@/lib/supabase/client";
import type { Corretor } from "@/types/app.types";

const supabase = createClient();

export async function getCorretores(): Promise<Corretor[]> {
  const { data, error } = await supabase
    .from("corretores")
    .select("id, nome, telefone, email, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Corretor[];
}

export async function createCorretor(c: Omit<Corretor, "id" | "ativo">): Promise<Corretor> {
  const { data, error } = await supabase
    .from("corretores")
    .insert({ ...c, ativo: true } as never)
    .select("id, nome, telefone, email, ativo")
    .single();
  if (error) throw error;
  return data as Corretor;
}
