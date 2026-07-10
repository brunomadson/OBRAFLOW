"use client";
import { createClient } from "@/lib/supabase/client";
import { CONFIG_PADRAO } from "@/constants/config";
import type { ConfigPrazos } from "@/types/app.types";

const supabase = createClient();

// A tabela config tem no máximo 1 linha por workspace (RLS isola por
// workspace_id). Se ainda não existe linha, cai nos padrões do código.
export async function getConfig(): Promise<ConfigPrazos> {
  const { data, error } = await supabase.from("config").select("*").limit(1).maybeSingle<ConfigPrazos>();
  if (error || !data) return CONFIG_PADRAO;
  return { ...CONFIG_PADRAO, ...data };
}

export async function saveConfig(config: ConfigPrazos): Promise<void> {
  const { data: existing } = await supabase.from("config").select("id").limit(1).maybeSingle<{ id: string }>();

  const { error } = existing
    ? await supabase.from("config").update(config as never).eq("id", existing.id)
    : await supabase.from("config").insert(config as never);

  if (error) throw error;
}
