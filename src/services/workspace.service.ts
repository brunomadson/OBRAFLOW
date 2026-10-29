"use client";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function getWorkspaceNome(workspaceId: string): Promise<string> {
  const { data, error } = await supabase.from("workspaces").select("nome").eq("id", workspaceId).single();
  if (error) throw error;
  return (data as { nome: string }).nome;
}
