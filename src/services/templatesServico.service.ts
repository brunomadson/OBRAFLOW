"use client";
import { createClient } from "@/lib/supabase/client";
import type { TemplateServico } from "@/types/app.types";

const supabase = createClient();

export async function getTemplatesServico(): Promise<TemplateServico[]> {
  const { data, error } = await supabase
    .from("templates_servico")
    .select("*")
    .order("nome");
  if (error) throw error;
  return ((data ?? []) as TemplateServico[]).map((t) => ({
    ...t,
    tarefas_padrao: Array.isArray(t.tarefas_padrao) ? t.tarefas_padrao : [],
    fases_execucao: Array.isArray(t.fases_execucao) ? t.fases_execucao : [],
  }));
}

export async function createTemplateServico(
  input: Omit<TemplateServico, "id" | "created_at">
): Promise<TemplateServico> {
  const { data, error } = await supabase
    .from("templates_servico")
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as TemplateServico;
}

export async function updateTemplateServico(id: string, input: Partial<TemplateServico>): Promise<TemplateServico> {
  const { data, error } = await supabase
    .from("templates_servico")
    .update(input as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TemplateServico;
}

// Bloqueia (FK sem cascade) enquanto algum item do catálogo ainda aponta
// template_padrao_id pra ele — o chamador trata esse erro com uma mensagem
// amigável (desvincular primeiro, ou editar o conteúdo em vez de apagar).
export async function deleteTemplateServico(id: string): Promise<void> {
  const { error } = await supabase.from("templates_servico").delete().eq("id", id);
  if (error) throw error;
}
