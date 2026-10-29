"use client";
import { createClient } from "@/lib/supabase/client";
import type { Servico, EtapaServico } from "@/types/app.types";

const supabase = createClient();

const SELECT_COMPLETO =
  "*, log:servico_log(*), cliente:clientes(*), catalogoServico:catalogo_servicos(*), indicador:indicadores(*), responsavel:profiles!servicos_responsavel_id_fkey(id,nome,cargo)";

export async function getServicos(): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select(SELECT_COMPLETO)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Servico[];
}

export async function getServico(id: string): Promise<Servico | null> {
  const { data, error } = await supabase
    .from("servicos")
    .select(SELECT_COMPLETO)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as Servico;
}

// Histórico do Cliente (Sprint 13.1/13.3) — todos os serviços já vinculados
// a esse cliente_id, pra somar na aba Histórico de Movimentações.
export async function getServicosPorCliente(clienteId: string): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select("id, etapa, created_at, catalogoServico:catalogo_servicos(nome)")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Servico[];
}

// Sprint 13.9 — os demais serviços criados juntos na mesma proposta (ver
// ModalServico.handleSave), pra mostrar "faz parte de uma proposta com
// outros N" na aba Geral e pra resolver o Financeiro compartilhado (ver
// principalDoGrupo em src/lib/propostas.ts — por isso o select completo,
// não só os campos de exibição: o representante financeiro precisa de
// cliente/indicador/valor de verdade, não só do nome). proposta_id é null
// pra criação avulsa/single, por isso o chamador só busca quando existir.
export async function getServicosPorProposta(propostaId: string): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select(SELECT_COMPLETO)
    .eq("proposta_id", propostaId);
  if (error) throw error;
  return (data ?? []) as unknown as Servico[];
}

export async function createServico(
  payload: Omit<Servico, "id" | "created_at" | "updated_at" | "log" | "cliente" | "catalogoServico" | "indicador" | "responsavel">
): Promise<Servico> {
  const { data, error } = await supabase
    .from("servicos")
    .insert(payload as never)
    .select(SELECT_COMPLETO)
    .single();
  if (error) throw error;
  return data as unknown as Servico;
}

export async function updateServico(id: string, payload: Partial<Servico>): Promise<Servico> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at, updated_at, log, cliente, catalogoServico, indicador, responsavel, ...rest } = payload as Servico;
  const { data, error } = await supabase
    .from("servicos")
    .update(rest as never)
    .eq("id", id)
    .select(SELECT_COMPLETO)
    .single();
  if (error) throw error;
  return data as unknown as Servico;
}

export async function registrarLogServico(
  servicoId: string,
  etapa: EtapaServico,
  dadosExtras: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("servico_log").insert({
    servico_id: servicoId,
    etapa,
    dados_extras: dadosExtras,
  } as never);
  if (error) throw error;
}
