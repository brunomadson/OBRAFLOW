"use client";
import { memo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ETAPAS_SERVICO } from "@/constants/etapas";
import Badge from "@/components/ui/Badge";
import { cn, fmtBRL } from "@/lib/utils";
import { agruparPorProposta, type GrupoServico } from "@/lib/propostas";
import type { Servico, EtapaServico } from "@/types/app.types";

// Serviços da mesma proposta (Sprint 13.9/13.11 — "não pode ser criado
// separado", o cliente fechou tudo de uma vez) viram 1 card só no funil
// comercial, não N cards independentes. proposta_id null = grupo de 1,
// exatamente o comportamento de sempre. Só a partir de Execução é que cada
// serviço passa a aparecer separado (em Gestão de Projetos) — lá faz
// sentido, cada um tem checklist/fases próprios.

function CardConteudo({ grupo, etapaCor }: { grupo: GrupoServico; etapaCor: string }) {
  const { principal, itens } = grupo;
  const valorTotal = itens.reduce((sum, s) => sum + (Number(s.valor_proposta) || 0), 0);

  return (
    <div
      className="bg-white rounded-xl p-4 shadow-card border border-slate-100 border-l-[3px]"
      style={{ borderLeftColor: etapaCor }}
    >
      <div className="flex justify-between items-start mb-1.5 gap-2">
        <p className="text-[13px] font-bold text-slate-900 leading-tight">{principal.cliente?.nome ?? "Sem cliente"}</p>
        {itens.length > 1 && <Badge color={etapaCor}>{itens.length} serviços</Badge>}
      </div>
      <p className="text-[11px] text-slate-400 mb-2 leading-snug">
        🛠 {itens.length > 1
          ? itens.map((s) => s.catalogoServico?.nome ?? "Serviço").join(" + ")
          : principal.catalogoServico?.nome ?? "Serviço não definido"}
      </p>
      {valorTotal > 0 && (
        <p className="text-[13px] font-bold text-emerald-500 mb-1.5">{fmtBRL(valorTotal)}</p>
      )}
      <div className="flex justify-between items-center">
        {principal.indicador && (
          <span className="text-[9px] font-bold bg-purple-50 text-purple-700 rounded px-1.5 py-0.5">
            Indicação: {principal.indicador.nome}
          </span>
        )}
        <p className="text-[10px] font-semibold text-slate-400 ml-auto">{principal.responsavel?.nome ?? ""}</p>
      </div>
    </div>
  );
}

interface CardProps {
  grupo: GrupoServico;
  etapaCor: string;
  onClick: (servico: Servico) => void;
}

const CardKanban = memo(function CardKanban({ grupo, etapaCor, onClick }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: grupo.chave,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onClick(grupo.principal)}
      className={cn("mb-2.5 cursor-grab active:cursor-grabbing touch-none", isDragging && "opacity-30")}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
    >
      <div className="hover:shadow-card-hover transition-shadow rounded-xl">
        <CardConteudo grupo={grupo} etapaCor={etapaCor} />
      </div>
    </div>
  );
});

function ColunaEtapa({ etapa, cards, total, onAddServico, onEdit, podeCriar }: {
  etapa: (typeof ETAPAS_SERVICO)[number];
  cards: GrupoServico[];
  total: number;
  onAddServico: () => void;
  onEdit: (servico: Servico) => void;
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
        {cards.map((grupo) => (
          <CardKanban key={grupo.chave} grupo={grupo} etapaCor={etapa.cor} onClick={onEdit} />
        ))}
      </div>

      {etapa.id === "novo_lead" && podeCriar && (
        <button
          onClick={onAddServico}
          className="w-full border-[1.5px] border-dashed border-slate-300 bg-transparent rounded-xl py-2.5 text-xs text-slate-400 cursor-pointer mt-1 font-semibold hover:border-slate-400 transition-colors"
        >
          + Novo Serviço
        </button>
      )}
    </div>
  );
}

interface Props {
  servicos: Servico[];
  onEdit: (servico: Servico) => void;
  onAddServico: () => void;
  onMoveEtapa: (servicoId: string, novaEtapa: EtapaServico) => void | Promise<void>;
  podeCriar?: boolean;
}

export default function PipelineServicos({ servicos, onEdit, onAddServico, onMoveEtapa, podeCriar = true }: Props) {
  const [grupoAtivo, setGrupoAtivo] = useState<GrupoServico | null>(null);
  const grupos = agruparPorProposta(servicos);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const grupo = grupos.find((g) => g.chave === event.active.id);
    setGrupoAtivo(grupo ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setGrupoAtivo(null);
    const { active, over } = event;
    if (!over) return;

    const grupo = grupos.find((g) => g.chave === active.id);
    const novaEtapa = over.id as EtapaServico;
    if (!grupo || grupo.principal.etapa === novaEtapa) return;

    // A cascata pros outros itens da mesma proposta acontece dentro de
    // useServicos.avancarEtapa — basta chamar com o id de um item do grupo.
    onMoveEtapa(grupo.principal.id, novaEtapa);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3 items-start">
        {ETAPAS_SERVICO.map((etapa) => {
          const cards = grupos.filter((g) => g.principal.etapa === etapa.id);
          const total = cards.reduce(
            (sum, g) => sum + g.itens.reduce((s, it) => s + (Number(it.valor_proposta) || 0), 0),
            0
          );
          return (
            <ColunaEtapa
              key={etapa.id}
              etapa={etapa}
              cards={cards}
              total={total}
              onAddServico={onAddServico}
              onEdit={onEdit}
              podeCriar={podeCriar}
            />
          );
        })}
      </div>

      <DragOverlay>
        {grupoAtivo ? (
          <div className="w-[220px] rotate-2 shadow-card-hover">
            <CardConteudo
              grupo={grupoAtivo}
              etapaCor={ETAPAS_SERVICO.find((e) => e.id === grupoAtivo.principal.etapa)?.cor ?? "#94A3B8"}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
