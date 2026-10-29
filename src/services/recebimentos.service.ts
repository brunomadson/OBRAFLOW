"use client";
import { createClient } from "@/lib/supabase/client";
import { createLancamento, deleteLancamento } from "@/services/financeiro.service";
import { GRUPO_DE_CATEGORIA } from "@/constants/financeiro";
import type { Recebimento, OrigemRecebimento, Lancamento } from "@/types/app.types";

const supabase = createClient();

// Categoria do lançamento gerado — mesma taxonomia já usada no DRE
// (constants/financeiro.ts), pra não criar categoria paralela.
const CATEGORIA_POR_ORIGEM: Record<OrigemRecebimento, string> = {
  medicao: "Medição Caixa",
  recursos_proprios: "Adiantamento cliente",
};

export async function getRecebimentos(obraId?: string): Promise<Recebimento[]> {
  let query = supabase.from("recebimentos").select("*").order("data", { ascending: false });
  if (obraId) query = query.eq("obra_id", obraId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Recebimento[];
}

export interface NovoRecebimento {
  obra_id: string;
  origem_tipo: OrigemRecebimento;
  medicao_id: string | null;
  valor: number;
  data: string;
  descricao: string;
  forma_pagamento: string | null;
  obs: string | null;
  conta_bancaria_id?: string | null;
}

// O Financeiro só deve refletir dinheiro que realmente entrou — por isso
// todo recebimento já nasce com o lançamento em "pago", na data do repasse,
// nunca representando o valor liberado (só o que veio pra construtora).
// Devolve os dois criados pra quem chamou poder atualizar a lista de
// lançamentos localmente, sem precisar recarregar tudo do zero.
export async function createRecebimento(input: NovoRecebimento): Promise<{ recebimento: Recebimento; lancamento: Lancamento }> {
  const categoria = CATEGORIA_POR_ORIGEM[input.origem_tipo];

  const lancamento = await createLancamento({
    obra_id: input.obra_id,
    servico_id: null,
    tipo: "entrada",
    categoria,
    grupo: GRUPO_DE_CATEGORIA[categoria] ?? null,
    descricao: input.descricao,
    valor: input.valor,
    data: input.data,
    data_vencimento: null,
    data_confirmacao: input.data,
    forma_pagamento: input.forma_pagamento,
    status_pagamento: "pago",
    parcela_num: null,
    parcela_total: null,
    conta_bancaria_id: input.conta_bancaria_id ?? null,
    obs: input.obs,
  });

  const { data, error } = await supabase
    .from("recebimentos")
    .insert({
      obra_id: input.obra_id,
      origem_tipo: input.origem_tipo,
      medicao_id: input.medicao_id,
      lancamento_id: lancamento.id,
      valor: input.valor,
      data: input.data,
      forma_pagamento: input.forma_pagamento,
      obs: input.obs,
    } as never)
    .select()
    .single();

  if (error) {
    // Não deixa lançamento órfão se o recebimento falhar de gravar.
    await deleteLancamento(lancamento.id).catch(() => {});
    throw error;
  }
  return { recebimento: data as Recebimento, lancamento };
}

export async function deleteRecebimento(recebimento: Recebimento): Promise<void> {
  const { error } = await supabase.from("recebimentos").delete().eq("id", recebimento.id);
  if (error) throw error;
  if (recebimento.lancamento_id) {
    await deleteLancamento(recebimento.lancamento_id).catch(() => {});
  }
}
