"use client";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/app.types";

const supabase = createClient();

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

// Edita um perfil já existente — nunca cria um novo. Perfil só é criado
// pelo trigger handle_new_user (roda como SECURITY DEFINER, ignora RLS),
// nunca direto pelo client. Por isso é update(), não upsert(): um
// upsert() gera "INSERT ... ON CONFLICT DO UPDATE", e o Postgres exige
// satisfazer a policy de INSERT também nesse caso (mesmo quando a linha
// já existe e o caminho real é sempre UPDATE) — profiles nunca teve
// policy de INSERT pra "authenticated", então upsert() falhava sempre
// com "new row violates row-level security policy", inclusive num
// self-edit onde a policy de UPDATE já permitia perfeitamente.
export async function updateProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const { id, ...campos } = profile;
  const { data, error } = await supabase
    .from("profiles")
    .update(campos as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}
