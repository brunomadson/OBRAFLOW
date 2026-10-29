"use client";
import { createClient } from "@/lib/supabase/client";
import { createLancamento } from "@/services/financeiro.service";
import { GRUPO_DE_CATEGORIA } from "@/constants/financeiro";
import type { Lancamento, Servico, Indicador } from "@/types/app.types";

const supabase = createClient();

// Financeiro de Serviços Técnicos — mesma tabela/engine de Obras
// (lancamentos), nunca a mesma consulta: aqui é sempre servico_id
// preenchido, nunca obra_id. Ver financeiro.service.ts (getLancamentos)
// pro lado de Obras, que exclui explicitamente essas linhas.

export async function getLancamentosPorServico(servicoId: string): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("servico_id", servicoId)
    .order("data", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Lancamento[];
}

// Lançamento com o join até o cliente/catálogo — só usado no painel
// agregado (dashboard do módulo), pra mostrar de quem é cada linha sem
// precisar de uma segunda consulta por serviço.
export interface LancamentoComServico extends Lancamento {
  servico?: {
    cliente?: { nome: string } | null;
    catalogoServico?: { nome: string } | null;
  } | null;
}

// Todos os lançamentos de Serviços Técnicos do workspace (qualquer serviço)
// — base do painel Financeiro no nível do módulo (aba "Financeiro" do
// Setor, não do ModalServico).
export async function getLancamentosServicosTecnicos(): Promise<LancamentoComServico[]> {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("*, servico:servicos(cliente:clientes(nome), catalogoServico:catalogo_servicos(nome))")
    .not("servico_id", "is", null)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LancamentoComServico[];
}

function gerarDatasParcelas(dataBase: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(dataBase + "T00:00:00");
    d.setMonth(d.getMonth() + i);
    return d.toISOString().slice(0, 10);
  });
}

interface NovaParcelaCliente {
  servico: Pick<Servico, "id" | "indicador_id" | "indicador_pct"> & { indicador?: Indicador | null };
  nomeCliente: string;
  valorTotal: number;
  nParcelas: number;
  dataBase: string;
  datas?: string[];
  formaPagamento: string | null;
  obs: string | null;
}

// O coração da Sprint 13.5: cria as N parcelas do pagamento do cliente
// (entrada, servico_id) e — se o serviço tem indicador com % definido —
// gera junto, na mesma tacada, as N parcelas espelhadas da comissão
// (saída, servico_id), sempre nascendo "pendente" (nunca marcadas como já
// pagas automaticamente). Comportamento confirmado com o usuário: "quando
// for pro financeiro... o cálculo seja feito automático onde [o indicador]
// recebe em 3x também... já coloca um lançamento como pagamento futuro,
// assim como vai gerar o recebimento futuro".
export async function criarParcelasCliente(input: NovaParcelaCliente): Promise<Lancamento[]> {
  const { servico, nomeCliente, valorTotal, nParcelas, dataBase, formaPagamento, obs } = input;
  const datas = input.datas ?? gerarDatasParcelas(dataBase, nParcelas);
  const categoriaCliente = "Pagamento de Cliente";

  const parcelasCliente = datas.map((d, i) => ({
    obra_id: null,
    servico_id: servico.id,
    tipo: "entrada" as const,
    categoria: categoriaCliente,
    grupo: GRUPO_DE_CATEGORIA[categoriaCliente] ?? null,
    descricao: `Pagamento de ${nomeCliente} (${i + 1}/${nParcelas})`,
    valor: Math.round((valorTotal / nParcelas) * 100) / 100,
    data: d,
    data_vencimento: d,
    data_confirmacao: null,
    forma_pagamento: formaPagamento,
    status_pagamento: "pendente" as const,
    parcela_num: i + 1,
    parcela_total: nParcelas,
    conta_bancaria_id: null,
    obs,
  }));

  const criados = await Promise.all(parcelasCliente.map((p) => createLancamento(p)));

  const temComissao = servico.indicador_id && (servico.indicador_pct ?? 0) > 0;
  if (!temComissao) return criados;

  const categoriaComissao = "Comissão de Indicação";
  const nomeIndicador = servico.indicador?.nome ?? "Indicador";
  const valorComissaoTotal = valorTotal * ((servico.indicador_pct ?? 0) / 100);

  const parcelasComissao = datas.map((d, i) => ({
    obra_id: null,
    servico_id: servico.id,
    tipo: "saida" as const,
    categoria: categoriaComissao,
    grupo: GRUPO_DE_CATEGORIA[categoriaComissao] ?? null,
    descricao: `Comissão de indicação — ${nomeIndicador} (${i + 1}/${nParcelas})`,
    valor: Math.round((valorComissaoTotal / nParcelas) * 100) / 100,
    data: d,
    data_vencimento: d,
    data_confirmacao: null,
    forma_pagamento: null,
    status_pagamento: "pendente" as const,
    parcela_num: i + 1,
    parcela_total: nParcelas,
    conta_bancaria_id: null,
    obs: `Indicação de ${servico.indicador_pct}% sobre ${nomeCliente}`,
  }));

  const comissoesCriadas = await Promise.all(parcelasComissao.map((p) => createLancamento(p)));

  return [...criados, ...comissoesCriadas];
}
