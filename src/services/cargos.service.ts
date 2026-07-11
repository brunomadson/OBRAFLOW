"use client";
import { createClient } from "@/lib/supabase/client";
import type { Cargo, CargoComPermissoes, PermissaoCargo, SetorPermissao } from "@/types/app.types";

const supabase = createClient();

export async function getCargos(): Promise<Cargo[]> {
  const { data, error } = await supabase.from("cargos").select("*").order("sistema", { ascending: false }).order("nome");
  if (error) throw error;
  return (data ?? []) as Cargo[];
}

export async function getCargosComPermissoes(): Promise<CargoComPermissoes[]> {
  const [cargos, permissoes] = await Promise.all([
    getCargos(),
    supabase.from("permissoes_cargo").select("*").then(({ data, error }) => {
      if (error) throw error;
      return (data ?? []) as PermissaoCargo[];
    }),
  ]);

  return cargos.map((cargo) => ({
    ...cargo,
    permissoes: permissoes.filter((p) => p.cargo_id === cargo.id),
  }));
}

export async function criarCargo(nome: string, workspaceId: string): Promise<Cargo> {
  const { data, error } = await supabase
    .from("cargos")
    .insert({ nome, workspace_id: workspaceId, sistema: false } as never)
    .select()
    .single();
  if (error) throw error;

  const setores: SetorPermissao[] = ["comercial", "obras", "financeiro", "notificacoes", "configuracoes"];
  const { error: pErr } = await supabase.from("permissoes_cargo").insert(
    setores.map((setor) => ({
      cargo_id: (data as Cargo).id,
      setor,
      pode_visualizar: false,
      pode_criar: false,
      pode_editar: false,
      pode_excluir: false,
    })) as never
  );
  if (pErr) throw pErr;

  return data as Cargo;
}

export async function excluirCargo(cargoId: string): Promise<void> {
  const { error } = await supabase.from("cargos").delete().eq("id", cargoId);
  if (error) throw error;
}

export async function atualizarPermissao(
  permissaoId: string,
  campo: "pode_visualizar" | "pode_criar" | "pode_editar" | "pode_excluir",
  valor: boolean
): Promise<void> {
  const { error } = await supabase
    .from("permissoes_cargo")
    .update({ [campo]: valor } as never)
    .eq("id", permissaoId);
  if (error) throw error;
}
