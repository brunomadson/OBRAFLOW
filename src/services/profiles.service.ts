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

export async function upsertProfile(profile: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile as never)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}
