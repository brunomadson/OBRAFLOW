"use client";
import { ETAPAS_LEAD } from "@/constants/etapas";
import Badge from "@/components/ui/Badge";
import { fmtBRL } from "@/lib/utils";
import type { Lead } from "@/types/app.types";

interface Props {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
}

export default function TabelaPropostas({ leads, onEdit }: Props) {
  const ativos = leads.filter((l) => !["reprovada", "leads"].includes(l.etapa));

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {["Cliente", "Cidade", "Etapa", "Renda", "Vl. Caixa", "Vl. Venda", "Subsídio", "Responsável", "Mov.", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3.5 py-2.5 text-left text-[11px] font-bold text-slate-500 tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {ativos.map((lead, i) => {
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
