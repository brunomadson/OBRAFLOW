"use client";
import { createClient } from "@/lib/supabase/client";
import type { Correspondente } from "@/types/app.types";

const supabase = createClient();

export async function getCorrespondentes(): Promise<Correspondente[]> {
  const { data, error } = await supabase
    .from("correspondentes")
    .select("id, nome, agencia, contato, email, cidade, banco, ativo, obs")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Correspondente[];
}

export async function createCorrespondente(
  c: Pick<Correspondente, "nome" | "agencia" | "contato" | "email" | "cidade">
): Promise<Correspondente> {
  const { data, error } = await supabase
    .from("correspondentes")
    .insert({ ...c, ativo: true } as never)
    .select("id, nome, agencia, contato, email, cidade, banco, ativo, obs")
    .single();
  if (error) throw error;
  return data as Correspondente;
}

export async function deleteCorrespondente(id: string): Promise<void> {
  const { error } = await supabase
    .from("correspondentes")
    .update({ ativo: false } as never)
    .eq("id", id);
  if (error) throw error;
}
