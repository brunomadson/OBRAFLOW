"use client";
import { createClient } from "@/lib/supabase/client";
import type { Obra, Medicao } from "@/types/app.types";

const supabase = createClient();

// Nome de exibição da obra — "cliente" é a coluna real e sempre preenchida;
// "nome" existe só por legado e várias obras (ex: as importadas) ficam com
// ele nulo. Ver histórico: obra.nome sumindo em listas/selects do Financeiro.
function nomeObra(o: Pick<Obra, "cliente" | "nome">): string {
  return (o.cliente ?? o.nome ?? "").trim();
}

// Ordem padrão do sistema inteiro: nome da obra A→Z, ignorando acento e
// caixa (ex: "Ana, Álvaro, Bruno..."). Centralizado aqui — todo componente
// que usa getObras()/useObras() herda essa ordenação automaticamente, sem
// precisar ordenar de novo na tela. Exportada pra useObras() reaplicar
// depois de updates otimistas locais (nova obra criada, nome editado etc.).
export function ordenarPorNome(obras: Obra[]): Obra[] {
  return [...obras].sort((a, b) => nomeObra(a).localeCompare(nomeObra(b), "pt-BR", { sensitivity: "base" }));
}

export async function getObras(): Promise<Obra[]> {
  const { data, error } = await supabase
    .from("obras")
    .select("*, log:obra_log(*), medicoes(*), correspondente:correspondentes(*)");

  if (error) throw error;
  return ordenarPorNome((data ?? []) as unknown as Obra[]);
}

export async function getObra(id: string): Promise<Obra | null> {
  const { data, error } = await supabase
    .from("obras")
    .select("*, log:obra_log(*), medicoes(*), correspondente:correspondentes(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as Obra;
}

export async function createObra(payload: Omit<Obra, "id" | "created_at" | "updated_at" | "log" | "medicoes" | "correspondente">): Promise<Obra> {
  const { data, error } = await supabase
    .from("obras")
    .insert(payload as never)
    .select("*, correspondente:correspondentes(*)")
    .single();

  if (error) throw error;
  return data as unknown as Obra;
}

export async function updateObra(id: string, payload: Partial<Obra>): Promise<Obra> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at, updated_at, log, medicoes, correspondente, ...rest } = payload as Obra;
  const { data, error } = await supabase
    .from("obras")
    .update(rest as never)
    .eq("id", id)
    .select("*, correspondente:correspondentes(*)")
    .single();

  if (error) throw error;
  return data as unknown as Obra;
}

export async function registrarLogObra(obraId: string, etapa: string): Promise<void> {
  const { error } = await supabase
    .from("obra_log")
    .insert({ obra_id: obraId, etapa } as never);
  if (error) throw error;
}

// ─── Medições ─────────────────────────────────────────────────────────────────
export async function upsertMedicao(medicao: Partial<Medicao> & { obra_id: string }): Promise<Medicao> {
  // Nunca enviar campos gerenciados pelo DB
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, updated_at, ...fields } = medicao as Medicao;

  if (id) {
    const { data, error } = await supabase
      .from("medicoes")
      .update(fields as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Medicao;
  } else {
    const { data, error } = await supabase
      .from("medicoes")
      .insert(fields as never)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Medicao;
  }
}

export async function deleteMedicao(id: string): Promise<void> {
  const { error } = await supabase.from("medicoes").delete().eq("id", id);
  if (error) throw error;
}
