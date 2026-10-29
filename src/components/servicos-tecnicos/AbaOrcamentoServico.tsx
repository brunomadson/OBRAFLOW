"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { updateServico } from "@/services/servicos.service";
import { custoMaximoServico, somaIncidencia, valorDoItem } from "@/lib/orcamentoServico";
import { fmtBRL } from "@/lib/utils";
import type { Servico, ItemComposicaoCusto, EtapaCronogramaMensal } from "@/types/app.types";
import toast from "react-hot-toast";

// Orçamento analítico do serviço (Sprint 13.11) — mesmo formato do que
// Obras usa (composição de custo por item + cronograma mês a mês), mas
// autocontido aqui: sem nenhuma referência ao setor Obras. Diferenças de
// propósito, não só de dado:
// - Por serviço, não por proposta — cada disciplina (Elétrico, Estrutural...)
//   tem sua própria composição de custo, mesmo vendida junto numa proposta.
// - Teto = valor da proposta deste serviço, não valor_venda - lucro%.
// - Só planejamento — sem comparar com o realizado. Isso é papel do
//   Financeiro (unificado por proposta desde a Sprint 13.11); não dá pra
//   atribuir um pagamento consolidado a uma disciplina específica, então
//   não faz sentido fingir esse cruzamento aqui.

function novoItem(): ItemComposicaoCusto {
  return { item: "", incidenciaPct: 0 };
}

interface Props {
  servico: Servico;
}

export default function AbaOrcamentoServico({ servico }: Props) {
  const [itens, setItens] = useState<ItemComposicaoCusto[]>(
    servico.composicao_custos.length > 0 ? servico.composicao_custos : [novoItem()]
  );
  const [meses, setMeses] = useState<EtapaCronogramaMensal[]>(servico.cronograma_financeiro);
  const [saving, setSaving] = useState(false);

  const custoMaximo = custoMaximoServico(servico.valor_proposta);
  const somaPct = somaIncidencia(itens);

  const setItemCampo = (i: number, campo: keyof ItemComposicaoCusto, v: string | number) =>
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it)));
  const addItem = () => setItens((prev) => [...prev, novoItem()]);
  const removerItem = (i: number) => setItens((prev) => prev.filter((_, idx) => idx !== i));

  const setNumMeses = (n: number) => {
    const novo = Math.max(0, Math.min(60, n || 0));
    setMeses((prev) => {
      if (novo === prev.length) return prev;
      if (novo > prev.length) {
        const extras = Array.from({ length: novo - prev.length }, (_, i) => ({ mes: prev.length + i + 1, pctAcumulado: 0 }));
        return [...prev, ...extras];
      }
      return prev.slice(0, novo);
    });
  };
  const setMesPct = (i: number, v: number) => setMeses((prev) => prev.map((m, idx) => (idx === i ? { ...m, pctAcumulado: v } : m)));

  const handleSalvar = async () => {
    setSaving(true);
    try {
      const composicao_custos = itens.filter((i) => i.item.trim());
      await updateServico(servico.id, { composicao_custos, cronograma_financeiro: meses });
      toast.success("Orçamento salvo!");
    } catch {
      toast.error("Erro ao salvar orçamento.");
    } finally {
      setSaving(false);
    }
  };

  if (custoMaximo === 0) {
    return (
      <p className="text-[11px] text-slate-400 text-center py-8">
        Defina o valor da proposta na aba Editar pra planejar o orçamento analítico.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Composição de Custo</p>
          <p className={`text-[11px] font-bold ${Math.round(somaPct) === 100 ? "text-emerald-600" : "text-amber-500"}`}>
            {somaPct.toFixed(1)}% de 100%
          </p>
        </div>
        <p className="text-[10px] text-slate-400 mb-2.5">Base — Valor da Proposta: {fmtBRL(custoMaximo)}</p>

        <div className="space-y-1.5">
          {itens.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={it.item}
                onChange={(e) => setItemCampo(i, "item", e.target.value)}
                placeholder="Ex: Mão de obra técnica"
                className="input-base flex-1 !py-1.5"
              />
              <input
                type="number" min={0} max={100} step={0.5}
                value={it.incidenciaPct || ""}
                onChange={(e) => setItemCampo(i, "incidenciaPct", Number(e.target.value))}
                placeholder="%"
                className="input-base !py-1.5 !w-16 text-right flex-shrink-0"
              />
              <span className="w-24 flex-shrink-0 text-right text-[12px] font-semibold text-slate-600">
                {fmtBRL(valorDoItem(it, custoMaximo))}
              </span>
              <button type="button" onClick={() => removerItem(i)} className="text-slate-300 hover:text-red-400 text-xs px-1 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-semibold">
          + Item de Custo
        </button>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cronograma Físico-Financeiro</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Duração (meses)</span>
            <input
              type="number" min={0} max={60}
              value={meses.length}
              onChange={(e) => setNumMeses(Number(e.target.value))}
              className="input-base !py-1 !w-16 text-center"
            />
          </div>
        </div>

        {meses.length === 0 ? (
          <p className="text-[11px] text-slate-400">Defina a duração em meses pra planejar o % acumulado mês a mês.</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase">
                <th className="text-left font-bold pb-1">Mês</th>
                <th className="text-right font-bold pb-1">% Acumulado</th>
                <th className="text-right font-bold pb-1">Previsto no mês</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m, i) => {
                const anterior = i > 0 ? (meses[i - 1].pctAcumulado || 0) : 0;
                const previsto = ((m.pctAcumulado || 0) - anterior) / 100 * custoMaximo;
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">Mês {m.mes}</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number" min={0} max={100} step={1}
                        value={m.pctAcumulado || ""}
                        onChange={(e) => setMesPct(i, Number(e.target.value))}
                        className="input-base !py-1 !w-16 text-right inline-block"
                      />
                    </td>
                    <td className="py-1.5 text-right font-semibold text-slate-700">{fmtBRL(previsto)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Button variant="primary" size="sm" onClick={handleSalvar} loading={saving} className="w-full">
        Salvar Orçamento
      </Button>
    </div>
  );
}
