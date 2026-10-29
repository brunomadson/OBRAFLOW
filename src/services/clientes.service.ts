"use client";
import { createClient } from "@/lib/supabase/client";
import type { Cliente } from "@/types/app.types";

const supabase = createClient();

export async function getClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export async function getCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Cliente | null;
}

// Só dígitos — pra comparar CPF/CNPJ sem depender de formatação (com ou
// sem pontuação) na hora de buscar.
function apenasDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

// Busca pelo CPF/CNPJ pra autopreencher o formulário de Lead/Obra/Serviço.
// Não busca por prefixo — CPF é um identificador exato, prefixo geraria
// falso positivo (963.xxx.xxx-xx ≠ 963.xxx.xxx-yy).
export async function buscarClientePorCpfCnpj(cpfCnpj: string): Promise<Cliente | null> {
  const digitos = apenasDigitos(cpfCnpj);
  if (digitos.length < 11) return null;

  const { data, error } = await supabase.from("clientes").select("*");
  if (error) throw error;
  const clientes = (data ?? []) as Cliente[];
  const encontrado = clientes.find((c) => c.cpf_cnpj && apenasDigitos(c.cpf_cnpj) === digitos);
  return encontrado ?? null;
}

export async function createCliente(input: Omit<Cliente, "id" | "created_at">): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .insert(input as never)
    .select()
    .single();
  if (error) throw error;
  return data as Cliente;
}

export async function updateCliente(id: string, input: Partial<Cliente>): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update(input as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Cliente;
}
