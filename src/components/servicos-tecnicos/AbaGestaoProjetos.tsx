"use client";
import { useState, useEffect, useMemo, memo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import ModalServico from "./ModalServico";
import { useServicos } from "@/hooks/useServicos";
import { getCatalogoServicos } from "@/services/catalogoServicos.service";
import { agruparPorProposta, type GrupoServico } from "@/lib/propostas";
import { fmtBRL } from "@/lib/utils";
import type { Servico, CatalogoServico } from "@/types/app.types";

// Acompanhamento dos serviços que já passaram do Comercial (Contrato) — é
// aqui que o time de execução vive o dia a dia. "Todos" é a lista simples,
// cruzando tipos de serviço diferentes; escolher um tipo específico que já
// tem "Fases de Execução" configuradas no Catálogo abre um quadro Kanban
// (colunas dele, não um funil fixo — cada tipo de serviço tem o seu).

const FILTROS = [
  { id: "execucao",   label: "Execução" },
  { id: "concluido",  label: "Concluído" },
  { id: "cancelado",  label: "Cancelados" },
  { id: "paralisado", label: "Paralisado" },
  { id: "todos",      label: "Todos" },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

function progressoTarefas(servico: Servico) {
  const tarefas = servico.tarefas ?? [];
  const feitas = tarefas.filter((t) => t.feito).length;
  return { feitas, total: tarefas.length, pct: tarefas.length > 0 ? Math.round((feitas / tarefas.length) * 100) : 0 };
}

function passaFiltro(s: Servico, filtro: Filtro): boolean {
  if (filtro === "todos") return true;
  if (filtro === "execucao") return s.etapa === "execucao" && s.status_execucao === "ativo";
  if (filtro === "concluido") return s.etapa === "concluido";
  return s.status_execucao === filtro;
}

function aplicarFiltro(lista: Servico[], filtro: Filtro): Servico[] {
  return lista.filter((s) => passaFiltro(s, filtro));
}

function statusVisual(servico: Servico): { cor: string; label: string } {
  if (servico.etapa === "concluido") return { cor: "#10B981", label: "Concluído" };
  if (servico.status_execucao === "cancelado") return { cor: "#EF4444", label: "Cancelado" };
  if (servico.status_execucao === "paralisado") return { cor: "#F59E0B", label: "Paralisado" };
  return { cor: "#F97316", label: "Execução" };
}

/* ─── Card (lista por status) ─────────────────────────────────────────────── */
// Serviços da mesma proposta (Sprint 13.11 — "criar nas tarefas a
// integração") viram 1 card só aqui também, igual ao Pipeline Comercial —
// tarefas somadas de todas as disciplinas, valor somado. Clicar abre o
// serviço principal, cujo ModalServico já mostra o checklist das outras
// disciplinas juntas (ver AbaTarefasServico.outrasDisciplinas).
function CardServico({ grupo, onClick }: { grupo: GrupoServico; onClick: (s: Servico) => void }) {
  const { principal, itens } = grupo;
  const feitas = itens.reduce((s, it) => s + progressoTarefas(it).feitas, 0);
  const total = itens.reduce((s, it) => s + progressoTarefas(it).total, 0);
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;
  const valorTotal = itens.reduce((s, it) => s + (it.valor_proposta ?? 0), 0);
  const { cor, label } = statusVisual(principal);

  return (
    <div
      onClick={() => onClick(principal)}
      className="card p-4 cursor-pointer border-l-[3px] hover:shadow-card-hover transition-shadow space-y-2.5"
      style={{ borderLeftColor: cor }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">{principal.cliente?.nome ?? "Cliente"}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
            🛠 {itens.length > 1 ? itens.map((it) => it.catalogoServico?.nome ?? "Serviço").join(" + ") : (principal.catalogoServico?.nome ?? "Serviço")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge color={cor}>{label}</Badge>
          {itens.length > 1 && <span className="text-[9px] font-bold text-slate-400">{itens.length} serviços</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 text-[11px]">
        <div>
          <span className="text-slate-400">Valor</span>
          <p className="font-bold text-emerald-600">{fmtBRL(valorTotal)}</p>
        </div>
        <div>
          <span className="text-slate-400">Responsável</span>
          <p className="font-semibold text-slate-700 truncate">{principal.responsavel?.nome ?? "—"}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Tarefas</span>
          <span>{feitas}/{total}</span>
        </div>
        <ProgressBar value={pct} color={cor} height={5} showLabel={false} />
      </div>
    </div>
  );
}

/* ─── Card (quadro Kanban por tipo) ───────────────────────────────────────── */
const CardKanban = memo(function CardKanban({ servico, cor, onClick }: { servico: Servico; cor: string; onClick: (s: Servico) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: servico.id });
  const { feitas, total, pct } = progressoTarefas(servico);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onClick(servico)}
      className={`mb-2.5 cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-30" : ""}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
    >
      <div
        className="bg-white rounded-xl p-3.5 shadow-card border border-slate-100 border-l-[3px] hover:shadow-card-hover transition-shadow"
        style={{ borderLeftColor: cor }}
      >
        <p className="text-[12px] font-bold text-slate-900 leading-tight mb-1">{servico.cliente?.nome ?? "Cliente"}</p>
        {total > 0 && (
          <div className="mb-1.5">
            <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
              <span>Tarefas</span>
              <span>{feitas}/{total}</span>
            </div>
            <ProgressBar value={pct} color={cor} height={4} showLabel={false} />
          </div>
        )}
        <p className="text-[10px] text-slate-400">{servico.responsavel?.nome ?? "Sem responsável"}</p>
      </div>
    </div>
  );
});

function ColunaFase({ fase, cards, onClick }: {
  fase: { id: string; nome: string; cor: string };
  cards: Servico[];
  onClick: (s: Servico) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: fase.id });

  return (
    <div ref={setNodeRef} className="min-w-[235px] max-w-[250px] flex-shrink-0">
      <div className="flex justify-between items-center mb-2.5 px-2.5 py-2 bg-slate-50 rounded-xl border-t-[3px]" style={{ borderTopColor: fase.cor }}>
        <p className="text-xs font-bold text-slate-900">{fase.nome}</p>
        <Badge color={fase.cor}>{cards.length}</Badge>
      </div>
      <div className={`min-h-[80px] rounded-xl transition-colors ${isOver ? "bg-blue-50 outline-2 outline-dashed outline-blue-300" : ""}`}>
        {cards.map((s) => <CardKanban key={s.id} servico={s} cor={fase.cor} onClick={onClick} />)}
      </div>
    </div>
  );
}

/* ─── Quadro Kanban por tipo de serviço ───────────────────────────────────── */
function QuadroFasesExecucao({ catalogoServico, servicos, onMoverFase, onClick }: {
  catalogoServico: CatalogoServico;
  servicos: Servico[];
  onMoverFase: (servicoId: string, faseId: string) => void;
  onClick: (s: Servico) => void;
}) {
  const [activeServico, setActiveServico] = useState<Servico | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const fases = catalogoServico.fases_execucao;
  const primeiraFase = fases[0]?.id;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveServico(servicos.find((s) => s.id === event.active.id) ?? null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveServico(null);
    const { active, over } = event;
    if (!over) return;
    const servico = servicos.find((s) => s.id === active.id);
    const novaFase = over.id as string;
    if (!servico || (servico.fase_execucao_id ?? primeiraFase) === novaFase) return;
    onMoverFase(servico.id, novaFase);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3 items-start">
        {fases.map((fase) => (
          <ColunaFase
            key={fase.id}
            fase={fase}
            cards={servicos.filter((s) => (s.fase_execucao_id ?? primeiraFase) === fase.id)}
            onClick={onClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeServico ? (
          <div className="w-[220px] rotate-2 shadow-card-hover">
            <div className="bg-white rounded-xl p-3.5 border border-slate-100">
              <p className="text-[12px] font-bold text-slate-900">{activeServico.cliente?.nome ?? "Cliente"}</p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export default function AbaGestaoProjetos() {
  const { servicos, loading, salvar, avancarEtapa } = useServicos();
  const [catalogo, setCatalogo] = useState<CatalogoServico[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("");
  const [tipoSelecionado, setTipoSelecionado] = useState<string>("todos");
  const [filtro, setFiltro] = useState<Filtro>("execucao");
  const [modal, setModal] = useState<Servico | null>(null);

  useEffect(() => { getCatalogoServicos().then(setCatalogo).catch(() => {}); }, []);

  const relevantes = useMemo(
    () => servicos.filter((s) => s.etapa === "execucao" || s.etapa === "concluido"),
    [servicos]
  );

  const tiposComQuadro = useMemo(
    () => catalogo.filter((c) => c.fases_execucao.length > 0),
    [catalogo]
  );

  // Categoria → Serviço em vez de um botão por tipo (46+ tipos não cabem
  // numa fileira de pills) — só categorias com pelo menos um tipo com
  // quadro configurado aparecem no primeiro filtro.
  const categoriasComQuadro = useMemo(() => {
    const mapa = new Map<string, CatalogoServico["categoriaServico"]>();
    for (const c of tiposComQuadro) {
      const chave = c.categoria_id ?? "sem-categoria";
      if (!mapa.has(chave)) mapa.set(chave, c.categoriaServico ?? null);
    }
    return [...mapa.entries()];
  }, [tiposComQuadro]);

  const tiposDaCategoria = useMemo(
    () => tiposComQuadro.filter((c) => (c.categoria_id ?? "sem-categoria") === categoriaSelecionada),
    [tiposComQuadro, categoriaSelecionada]
  );

  // "Todos os serviços da categoria" (sem tipo específico escolhido) não vira
  // um quadro Kanban — tipos diferentes dentro da mesma categoria podem ter
  // fases diferentes se usarem templates diferentes. Cai na lista por status,
  // só que já restrita aos tipos daquela categoria.
  const escopo = useMemo(() => {
    if (categoriaSelecionada && tipoSelecionado === "todos") {
      const idsDaCategoria = new Set(tiposDaCategoria.map((c) => c.id));
      return relevantes.filter((s) => s.catalogo_servico_id && idsDaCategoria.has(s.catalogo_servico_id));
    }
    return relevantes;
  }, [relevantes, categoriaSelecionada, tipoSelecionado, tiposDaCategoria]);

  // Agrupado por proposta pra a lista por status virar cards, não serviços
  // soltos (Sprint 13.11) — o status/etapa do grupo é o do principal.
  const gruposEscopo = useMemo(() => agruparPorProposta(escopo), [escopo]);
  const gruposFiltrados = useMemo(
    () => gruposEscopo.filter((g) => passaFiltro(g.principal, filtro)),
    [gruposEscopo, filtro]
  );

  const handleSave = async (data: Partial<Servico>) => {
    if (!modal) return;
    await salvar({ ...data, id: modal.id });
  };

  const handleMoverFase = async (servicoId: string, faseId: string) => {
    await salvar({ id: servicoId, fase_execucao_id: faseId });
  };

  if (loading) return <p className="text-sm text-slate-400 text-center py-12">Carregando...</p>;

  const catalogoAtivo = tiposComQuadro.find((c) => c.id === tipoSelecionado);

  return (
    <div>
      {categoriasComQuadro.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <span className="text-[11px] text-slate-400 font-semibold">Ver quadro por tipo:</span>
          <select
            value={categoriaSelecionada}
            onChange={(e) => { setCategoriaSelecionada(e.target.value); setTipoSelecionado("todos"); }}
            className="input-base !w-auto !py-1.5 text-xs"
          >
            <option value="">Nenhuma (lista por status)</option>
            {categoriasComQuadro.map(([chave, cat]) => (
              <option key={chave} value={chave}>{cat?.nome ?? "Sem categoria"}</option>
            ))}
          </select>
          {categoriaSelecionada && (
            <select
              value={tipoSelecionado}
              onChange={(e) => setTipoSelecionado(e.target.value)}
              className="input-base !w-auto !py-1.5 text-xs"
            >
              <option value="todos">Todos os serviços da categoria</option>
              {tiposDaCategoria.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
        </div>
      )}

      {catalogoAtivo ? (
        <QuadroFasesExecucao
          catalogoServico={catalogoAtivo}
          servicos={relevantes.filter((s) => s.etapa === "execucao" && s.catalogo_servico_id === catalogoAtivo.id)}
          onMoverFase={handleMoverFase}
          onClick={setModal}
        />
      ) : (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {FILTROS.map((f) => {
              const count = gruposEscopo.filter((g) => passaFiltro(g.principal, f.id)).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`border-[1.5px] rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition-colors ${
                    filtro === f.id ? "border-blue-500 bg-blue-50 text-blue-500" : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>

          {gruposFiltrados.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-slate-400">
                {relevantes.length === 0
                  ? "Nenhum serviço chegou em Execução ainda — eles aparecem aqui a partir da etapa Contrato, na aba Comercial."
                  : "Nenhum serviço nesse filtro."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3.5">
              {gruposFiltrados.map((g) => <CardServico key={g.chave} grupo={g} onClick={setModal} />)}
            </div>
          )}
        </>
      )}

      {modal && (
        <ModalServico
          servico={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onAvancar={async (id, etapa) => { await avancarEtapa(id, etapa); }}
        />
      )}
    </div>
  );
}
