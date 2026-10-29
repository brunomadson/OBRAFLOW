"use client";
import { useState } from "react";
import { updateServico } from "@/services/servicos.service";
import { agruparTarefas, corDoGrupo } from "@/lib/tarefasGrupos";
import type { Servico, TarefaServico, CatalogoServico } from "@/types/app.types";
import toast from "react-hot-toast";

// Mesma lista de servico.tarefas que a aba Tarefas usa (checklist) — aqui só
// muda a renderização: um Gantt simples (barras proporcionais Início→Fim,
// agrupadas por etapa). Uma fonte de dado, duas visualizações (ver
// Estratégia de Escalabilidade).
//
// Sprint 13.11 — quando o serviço é parte de uma proposta com mais
// disciplinas, a régua de datas (rangeMin/rangeMax) passa a cobrir TODAS as
// tarefas de TODOS os serviços da proposta, não só deste — "é como se
// tivesse o cronograma só de um", e não é: é um cronograma só, cobrindo
// tudo, com a mesma escala de tempo pra todas as disciplinas ficarem
// comparáveis lado a lado (Disciplina → Etapa → Tarefa, igual à aba
// Tarefas).

interface Disciplina {
  servicoId: string;
  nome: string;
  tarefas: TarefaServico[];
}

interface Props {
  servico: Servico;
  catalogoServico: CatalogoServico | null;
  onUpdated: (tarefas: TarefaServico[]) => void;
  outrasDisciplinas?: { servico: Servico; catalogoServico: CatalogoServico | null }[];
}

function diffDias(a: string, b: string): number {
  const d1 = new Date(a + "T00:00:00").getTime();
  const d2 = new Date(b + "T00:00:00").getTime();
  return Math.round((d2 - d1) / 86_400_000);
}

function fmtDiaCurto(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function AbaCronogramaServico({ servico, catalogoServico, onUpdated, outrasDisciplinas = [] }: Props) {
  const [saving, setSaving] = useState(false);
  const [siblingTarefas, setSiblingTarefas] = useState<Record<string, TarefaServico[]>>(
    () => Object.fromEntries(outrasDisciplinas.map((d) => [d.servico.id, d.servico.tarefas]))
  );
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const toggleExpandida = (servicoId: string) => {
    setExpandidas((prev) => {
      const copia = new Set(prev);
      if (copia.has(servicoId)) copia.delete(servicoId); else copia.add(servicoId);
      return copia;
    });
  };

  const blocos: Disciplina[] = [
    { servicoId: servico.id, nome: catalogoServico?.nome ?? "Este serviço", tarefas: servico.tarefas },
    ...outrasDisciplinas.map((d) => ({
      servicoId: d.servico.id,
      nome: d.catalogoServico?.nome ?? "Serviço",
      tarefas: siblingTarefas[d.servico.id] ?? d.servico.tarefas,
    })),
  ];
  const multiplas = blocos.length > 1;
  const todasTarefas = blocos.flatMap((b) => b.tarefas);

  const persistir = async (servicoId: string, tarefas: TarefaServico[]) => {
    setSaving(true);
    try {
      await updateServico(servicoId, { tarefas });
      if (servicoId === servico.id) onUpdated(tarefas);
      else setSiblingTarefas((prev) => ({ ...prev, [servicoId]: tarefas }));
    } catch {
      toast.error("Erro ao salvar cronograma.");
    } finally {
      setSaving(false);
    }
  };

  const handleCampo = (bloco: Disciplina, id: string, campo: "data_inicio" | "data_prevista", valor: string) => {
    persistir(bloco.servicoId, bloco.tarefas.map((t) => (t.id === id ? { ...t, [campo]: valor || null } : t)));
  };

  if (todasTarefas.length === 0) {
    return (
      <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
        <p className="text-xs text-slate-400">Sem tarefas cadastradas ainda — adicione na aba Tarefas primeiro.</p>
      </div>
    );
  }

  // Régua única pra todas as disciplinas — mesma escala de tempo, senão as
  // barras de Elétrico e Sanitário não são comparáveis entre si.
  const todasDatas = todasTarefas.flatMap((t) => [t.data_inicio, t.data_prevista].filter(Boolean) as string[]);
  const rangeMin = todasDatas.length > 0 ? todasDatas.reduce((a, b) => (a < b ? a : b)) : null;
  const rangeMax = todasDatas.length > 0 ? todasDatas.reduce((a, b) => (a > b ? a : b)) : null;
  const totalDiasRange = rangeMin && rangeMax ? Math.max(diffDias(rangeMin, rangeMax), 1) : 1;

  const posicaoBarra = (t: TarefaServico) => {
    if (!rangeMin || (!t.data_inicio && !t.data_prevista)) return null;
    const inicio = t.data_inicio ?? t.data_prevista!;
    const fim = t.data_prevista ?? t.data_inicio!;
    const offsetDias = diffDias(rangeMin, inicio);
    const larguraDias = Math.max(diffDias(inicio, fim), 1);
    const left = (offsetDias / totalDiasRange) * 100;
    const width = Math.min((larguraDias / totalDiasRange) * 100, 100 - left);
    return { left: `${left}%`, width: `${Math.max(width, 1.5)}%` };
  };

  return (
    <div className="space-y-4">
      {rangeMin && rangeMax && (
        <div className="flex justify-between text-[10px] text-slate-400 pl-[40%] border-b border-slate-100 pb-1">
          <span>{fmtDiaCurto(rangeMin)}</span>
          <span>{fmtDiaCurto(rangeMax)}</span>
        </div>
      )}

      {blocos.map((bloco) => {
        const aberto = !multiplas || expandidas.has(bloco.servicoId);
        const grupos = agruparTarefas(bloco.tarefas);
        const ordemGrupos = grupos.map((g) => g.grupo);
        return (
          <div key={bloco.servicoId} className={multiplas ? "border border-slate-100 rounded-xl overflow-hidden" : ""}>
            {multiplas && (
              <button
                type="button"
                onClick={() => toggleExpandida(bloco.servicoId)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wide">🛠 {bloco.nome}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10.5px] text-slate-400">{bloco.tarefas.length} tarefa{bloco.tarefas.length !== 1 ? "s" : ""}</span>
                  <span className={`text-slate-400 text-[10px] transition-transform ${aberto ? "rotate-180" : ""}`}>▼</span>
                </span>
              </button>
            )}
            {aberto && (
              <div className={multiplas ? "p-3 space-y-4" : "space-y-4"}>
                {bloco.tarefas.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">Sem tarefas nessa disciplina.</p>
                ) : (
                  grupos.map(({ grupo, itens }) => {
                    const cor = corDoGrupo(grupo, ordemGrupos);
                    return (
                      <div key={grupo}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{grupo}</p>
                        </div>
                        <div className="space-y-2">
                          {itens.map((t) => {
                            const pos = posicaoBarra(t);
                            const duracao = t.data_inicio && t.data_prevista ? diffDias(t.data_inicio, t.data_prevista) : null;
                            return (
                              <div key={t.id} className="grid grid-cols-[40%_1fr] gap-3 items-center">
                                <div className="min-w-0">
                                  <p className={`text-[12px] font-semibold truncate ${t.feito ? "line-through text-slate-400" : "text-slate-800"}`}>
                                    {t.texto}
                                  </p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <input
                                      type="date"
                                      value={t.data_inicio ?? ""}
                                      onChange={(e) => handleCampo(bloco, t.id, "data_inicio", e.target.value)}
                                      disabled={saving}
                                      className="input-base !text-[10px] !py-0.5 !px-1.5 w-[90px]"
                                      title="Início"
                                    />
                                    <span className="text-slate-300 text-[10px]">→</span>
                                    <input
                                      type="date"
                                      value={t.data_prevista ?? ""}
                                      onChange={(e) => handleCampo(bloco, t.id, "data_prevista", e.target.value)}
                                      disabled={saving}
                                      className="input-base !text-[10px] !py-0.5 !px-1.5 w-[90px]"
                                      title="Fim"
                                    />
                                    {duracao !== null && <span className="text-[10px] text-slate-400 flex-shrink-0 ml-0.5">{duracao}d</span>}
                                  </div>
                                </div>
                                <div className="relative h-5 bg-slate-50 rounded-md">
                                  {pos && (
                                    <div
                                      className="absolute top-0.5 bottom-0.5 rounded transition-all"
                                      style={{ ...pos, background: t.feito ? cor : `${cor}99` }}
                                      title={`${t.texto}${duracao !== null ? ` — ${duracao} dias` : ""}`}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {!rangeMin && (
        <p className="text-[11px] text-slate-400 text-center pt-2">Defina Início e Fim nas tarefas pra ver a linha do tempo.</p>
      )}
    </div>
  );
}
