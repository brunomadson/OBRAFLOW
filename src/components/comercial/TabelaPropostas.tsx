"use client";
import { useMemo, useState } from "react";
import { ETAPAS_LEAD } from "@/constants/etapas";
import Badge from "@/components/ui/Badge";
import { cn, compareValues, fmtBRL, nextSort, type SortState } from "@/lib/utils";
import type { Lead } from "@/types/app.types";

interface Props {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
}

type SortKey = "nome" | "cidade" | "etapa" | "renda_bruta" | "valor_caixa" | "valor_venda" | "valor_subsidio" | "responsavel" | "updated_at";

const ETAPA_ORDEM: Record<string, number> = Object.fromEntries(ETAPAS_LEAD.map((e, i) => [e.id, i]));

function sortValue(lead: Lead, key: SortKey): string | number | null {
  switch (key) {
    case "nome":            return lead.nome;
    case "cidade":          return lead.cidade;
    case "etapa":           return ETAPA_ORDEM[lead.etapa] ?? -1;
    case "renda_bruta":     return lead.renda_bruta;
    case "valor_caixa":     return lead.valor_caixa;
    case "valor_venda":     return lead.valor_venda;
    case "valor_subsidio":  return lead.valor_subsidio;
    case "responsavel":     return lead.responsavel?.nome ?? null;
    case "updated_at":      return lead.updated_at ? new Date(lead.updated_at).getTime() : null;
  }
}

const COLUNAS: { key: SortKey; label: string }[] = [
  { key: "nome",           label: "Cliente" },
  { key: "cidade",         label: "Cidade" },
  { key: "etapa",          label: "Etapa" },
  { key: "renda_bruta",    label: "Renda" },
  { key: "valor_caixa",    label: "Vl. Caixa" },
  { key: "valor_venda",    label: "Vl. Venda" },
  { key: "valor_subsidio", label: "Subsídio" },
  { key: "responsavel",    label: "Responsável" },
  { key: "updated_at",     label: "Mov." },
];

export default function TabelaPropostas({ leads, onEdit }: Props) {
  const ativos = leads.filter((l) => !["reprovada", "leads"].includes(l.etapa));
  const [sort, setSort] = useState<SortState<SortKey> | null>(null);

  const linhas = useMemo(() => {
    if (!sort) return ativos;
    const mult = sort.dir === "asc" ? 1 : -1;
    return [...ativos].sort((a, b) => mult * compareValues(sortValue(a, sort.key), sortValue(b, sort.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos, sort]);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {COLUNAS.map((c) => (
                <th key={c.key} className="px-3.5 py-2.5 text-left whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSort((s) => nextSort(s, c.key))}
                    className={cn(
                      "flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer",
                      "text-[11px] font-bold tracking-wide transition-colors",
                      sort?.key === c.key ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {c.label}
                    <span className="text-[9px]">{sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</span>
                  </button>
                </th>
              ))}
              <th className="px-3.5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((lead, i) => {
              const etapa = ETAPAS_LEAD.find((e) => e.id === lead.etapa);
              return (
                <tr
                  key={lead.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}
                >
                  <td className="px-3.5 py-2.5">
                    <p className="font-semibold text-slate-900">{lead.nome}</p>
                    <p className="text-[11px] text-slate-400">{lead.telefone}</p>
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-500">{lead.cidade}</td>
                  <td className="px-3.5 py-2.5">
                    {etapa && <Badge color={etapa.cor}>{etapa.label}</Badge>}
                  </td>
                  <td className="px-3.5 py-2.5">{fmtBRL(lead.renda_bruta)}</td>
                  <td className="px-3.5 py-2.5 font-semibold">{fmtBRL(lead.valor_caixa)}</td>
                  <td className="px-3.5 py-2.5 font-bold text-emerald-500">{fmtBRL(lead.valor_venda)}</td>
                  <td className="px-3.5 py-2.5 text-blue-500">{fmtBRL(lead.valor_subsidio)}</td>
                  <td className="px-3.5 py-2.5 text-slate-500">{lead.responsavel?.nome}</td>
                  <td className="px-3.5 py-2.5 text-slate-400 text-[12px]">
                    {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <button
                      onClick={() => onEdit(lead)}
                      className="bg-blue-50 hover:bg-blue-100 border-none rounded-md px-2.5 py-1 text-[11px] font-semibold text-blue-500 cursor-pointer transition-colors"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ativos.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-[13px]">
            Nenhuma proposta em andamento.
          </div>
        )}
      </div>
    </div>
  );
}
