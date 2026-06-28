"use client";
import { memo } from "react";
import { ETAPAS_LEAD } from "@/constants/etapas";
import Badge from "@/components/ui/Badge";
import { fmtBRL } from "@/lib/utils";
import type { Lead } from "@/types/app.types";

interface CardProps {
  lead: Lead;
  etapaCor: string;
  onClick: (lead: Lead) => void;
}

const CardKanban = memo(function CardKanban({ lead, etapaCor, onClick }: CardProps) {
  return (
    <div
      onClick={() => onClick(lead)}
      className="bg-white rounded-xl p-4 mb-2.5 shadow-card border border-slate-100 cursor-pointer border-l-[3px] hover:shadow-card-hover transition-shadow"
      style={{ borderLeftColor: etapaCor }}
    >
      <div className="flex justify-between items-start mb-1.5">
        <p className="text-[13px] font-bold text-slate-900 leading-tight">{lead.nome}</p>
        <span className="text-[10px] font-semibold bg-slate-50 text-slate-500 rounded-md px-1.5 py-0.5 ml-2 whitespace-nowrap">
          {lead.origem}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">📍 {lead.cidade}</p>
      {(lead.valor_venda ?? 0) > 0 && (
        <p className="text-[13px] font-bold text-emerald-500 mb-1.5">{fmtBRL(lead.valor_venda)}</p>
      )}
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          {lead.com_conjuge && (
            <span className="text-[9px] font-bold bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">Cônjuge</span>
          )}
          {lead.dependente && (
            <span className="text-[9px] font-bold bg-yellow-50 text-yellow-700 rounded px-1.5 py-0.5">Dependente</span>
          )}
          {lead.fgts_3anos && (
            <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">FGTS+3</span>
          )}
        </div>
        <p className="text-[10px] font-semibold text-slate-400">{lead.responsavel?.nome ?? ""}</p>
      </div>
    </div>
  );
});

interface Props {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onAddLead: () => void;
}

export default function Pipeline({ leads, onEdit, onAddLead }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 items-start">
      {ETAPAS_LEAD.map((etapa) => {
        const cards = leads.filter((l) => l.etapa === etapa.id);
        const total = cards.reduce((s, l) => s + (Number(l.valor_venda) || 0), 0);
        return (
          <div key={etapa.id} className="min-w-[235px] max-w-[250px] flex-shrink-0">
            <div
              className="flex justify-between items-center mb-2.5 px-2.5 py-2 bg-slate-50 rounded-xl border-t-[3px]"
              style={{ borderTopColor: etapa.cor }}
            >
              <div>
                <p className="text-xs font-bold text-slate-900">{etapa.label}</p>
                {total > 0 && <p className="text-[10px] text-slate-500 mt-0.5">{fmtBRL(total)}</p>}
              </div>
              <Badge color={etapa.cor}>{cards.length}</Badge>
            </div>

            <div className="min-h-[60px]">
              {cards.map((lead) => (
                <CardKanban key={lead.id} lead={lead} etapaCor={etapa.cor} onClick={onEdit} />
              ))}
            </div>

            {etapa.id === "leads" && (
              <button
                onClick={onAddLead}
                className="w-full border-[1.5px] border-dashed border-slate-300 bg-transparent rounded-xl py-2.5 text-xs text-slate-400 cursor-pointer mt-1 font-semibold hover:border-slate-400 transition-colors"
              >
                + Novo Lead
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
