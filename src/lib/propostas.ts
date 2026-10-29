import type { Servico } from "@/types/app.types";

// Serviços da mesma proposta (Sprint 13.9/13.11) andam juntos no Pipeline
// Comercial e compartilham um Financeiro só (ver ModalServico/AbaFinanceiroServico)
// — precisam de UM representante estável pra essas duas coisas apontarem
// pro mesmo lugar não importa por qual serviço do grupo o usuário entrou.
// Convenção: o mais antigo (primeiro criado) do grupo.
export function principalDoGrupo(servicos: Servico[]): Servico {
  return servicos.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
}

export interface GrupoServico { chave: string; principal: Servico; itens: Servico[] }

// Agrupa uma lista de serviços por proposta_id (fallback pro próprio id —
// serviço avulso vira grupo de 1, comportamento de sempre). Usado tanto no
// Pipeline Comercial (1 card por proposta) quanto na lista por status de
// Gestão de Projetos — o Kanban de Fases por tipo NÃO usa isso: fica
// intencionalmente por serviço, já que cada disciplina tem sua própria fase.
export function agruparPorProposta(servicos: Servico[]): GrupoServico[] {
  const porChave = new Map<string, Servico[]>();
  const ordem: string[] = [];
  for (const s of servicos) {
    const chave = s.proposta_id ?? s.id;
    if (!porChave.has(chave)) { porChave.set(chave, []); ordem.push(chave); }
    porChave.get(chave)!.push(s);
  }
  return ordem.map((chave) => {
    const itens = porChave.get(chave)!;
    return { chave, principal: principalDoGrupo(itens), itens };
  });
}
