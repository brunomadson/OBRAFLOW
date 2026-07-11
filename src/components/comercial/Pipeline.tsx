"use client";
import { memo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ETAPAS_LEAD } from "@/constants/etapas";
import Badge from "@/components/ui/Badge";
import { cn, fmtBRL } from "@/lib/utils";
import type { Lead, EtapaLead } from "@/types/app.types";

function CardConteudo({ lead, etapaCor }: { lead: Lead; etapaCor: string }) {
  return (
    <div
      className="bg-white rounded-xl p-4 shadow-card border border-slate-100 border-l-[3px]"
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
}

interface CardProps {
  lead: Lead;
  etapaCor: string;
  onClick: (lead: Lead) => void;
}

const CardKanban = memo(function CardKanban({ lead, etapaCor, onClick }: CardProps) {
  // Distância mínima antes de considerar "arrastando" — evita que um clique
  // simples no card (pra abrir o modal) seja interpretado como início de drag.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onClick(lead)}
      className={cn("mb-2.5 cursor-grab active:cursor-grabbing touch-none", isDragging && "opacity-30")}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
    >
      <div className="hover:shadow-card-hover transition-shadow rounded-xl">
        <CardConteudo lead={lead} etapaCor={etapaCor} />
      </div>
    </div>
  );
});

function ColunaEtapa({ etapa, cards, total, onAddLead, onEdit, podeCriar }: {
  etapa: (typeof ETAPAS_LEAD)[number];
  cards: Lead[];
  total: number;
  onAddLead: () => void;
  onEdit: (lead: Lead) => void;
  podeCriar: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });

  return (
    <div ref={setNodeRef} className="min-w-[235px] max-w-[250px] flex-shrink-0">
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

      <div
        className={cn(
          "min-h-[80px] rounded-xl transition-colors",
          isOver && "bg-blue-50 outline-2 outline-dashed outline-blue-300"
        )}
      >
        {cards.map((lead) => (
          <CardKanban key={lead.id} lead={lead} etapaCor={etapa.cor} onClick={onEdit} />
        ))}
      </div>

      {etapa.id === "leads" && podeCriar && (
        <button
          onClick={onAddLead}
          className="w-full border-[1.5px] border-dashed border-slate-300 bg-transparent rounded-xl py-2.5 text-xs text-slate-400 cursor-pointer mt-1 font-semibold hover:border-slate-400 transition-colors"
        >
          + Novo Lead
        </button>
      )}
    </div>
  );
}

interface Props {
  leads: Lead[];
  onEdit: (lead: Lead) => void;
  onAddLead: () => void;
  onMoveEtapa: (leadId: string, novaEtapa: EtapaLead) => void | Promise<void>;
  podeCriar?: boolean;
}

export default function Pipeline({ leads, onEdit, onAddLead, onMoveEtapa, podeCriar = true }: Props) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const lead = leads.find((l) => l.id === active.id);
    const novaEtapa = over.id as EtapaLead;
    if (!lead || lead.etapa === novaEtapa) return;

    onMoveEtapa(lead.id, novaEtapa);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3 items-start">
        {ETAPAS_LEAD.map((etapa) => {
          const cards = leads.filter((l) => l.etapa === etapa.id);
          const total = cards.reduce((s, l) => s + (Number(l.valor_venda) || 0), 0);
          return (
            <ColunaEtapa
              key={etapa.id}
              etapa={etapa}
              cards={cards}
              total={total}
              onAddLead={onAddLead}
              onEdit={onEdit}
              podeCriar={podeCriar}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="w-[220px] rotate-2 shadow-card-hover">
            <CardConteudo
              lead={activeLead}
              etapaCor={ETAPAS_LEAD.find((e) => e.id === activeLead.etapa)?.cor ?? "#94A3B8"}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
