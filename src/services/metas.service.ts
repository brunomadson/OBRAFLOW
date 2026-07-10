"use client";
import { createClient } from "@/lib/supabase/client";
import type { IndicadorMeta, MetaDashboard } from "@/types/app.types";

const supabase = createClient();

export function periodoAtual(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export async function getMetas(periodo: string): Promise<MetaDashboard[]> {
  const { data, error } = await supabase.from("metas_dashboard").select("*").eq("periodo", periodo);
  if (error) throw error;
  return (data ?? []) as MetaDashboard[];
}

export async function upsertMeta(indicador: IndicadorMeta, periodo: string, valor_meta: number): Promise<MetaDashboard> {
  const { data, error } = await supabase
    .from("metas_dashboard")
    .upsert({ indicador, periodo, valor_meta } as never, { onConflict: "workspace_id,indicador,periodo" })
    .select()
    .single();
  if (error) throw error;
  return data as MetaDashboard;
}
