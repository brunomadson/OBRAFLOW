"use client";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/types/app.types";

const supabase = createClient();

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, log:lead_log(*), responsavel:profiles!leads_responsavel_id_fkey(id,nome,cargo), correspondente:correspondentes(*)")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Lead[];
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, log:lead_log(*), responsavel:profiles!leads_responsavel_id_fkey(id,nome,cargo), correspondente:correspondentes(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as Lead;
}

export async function createLead(payload: Omit<Lead, "id" | "created_at" | "updated_at" | "log" | "responsavel" | "correspondente">): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .insert(payload as never)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Lead;
}

export async function updateLead(id: string, payload: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Lead;
}

export async function registrarLogLead(
  leadId: string,
  etapa: string,
  dadosExtras: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("lead_log").insert({
    lead_id: leadId,
    etapa,
    dados_extras: dadosExtras,
  });
  if (error) throw error;
}
