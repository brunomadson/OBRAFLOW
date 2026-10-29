"use client";
import { useState, useId, memo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { updateServico } from "@/services/servicos.service";
import { agruparTarefas, corDoGrupo } from "@/lib/tarefasGrupos";
import { STATUS_TAREFA, PRIORIDADES_TAREFA, statusDeTarefa } from "@/lib/tarefasStatus";
import type { Servico, TarefaServico, CatalogoServico, Profile, StatusTarefa } from "@/types/app.types";
import toast from "react-hot-toast";

function novoId(): string {
  return `t${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

type Visao = "lista" | "kanban";

interface Disciplina {
  servicoId: string;
  nome: string;
  catalogoServico: CatalogoServico | null;
  tarefas: TarefaServico[];
}

interface Props {
  servico: Servico;
  catalogoServico: CatalogoServico | null;
  profiles: Profile[];
  onUpdated: (tarefas: TarefaServico[]) => void;
  // Sprint 13.11 — outros serviços da MESMA proposta (ver ModalServico).
  // Quando presente, a aba deixa de mostrar só o checklist deste serviço e
  // passa a integrar todas as disciplinas juntas (Disciplina → Etapa →
  // Tarefa) — "quando tem mais de um serviço na mesma proposta, criar nas
  // tarefas a integração".
  outrasDisciplinas?: { servico: Servico; catalogoServico: CatalogoServico | null }[];
}

function sugestoesDoBloco(bloco: Disciplina): string[] {
  const ordem = agruparTarefas(bloco.tarefas).map((g) => g.grupo);
  return [...new Set([...ordem, ...(bloco.catalogoServico?.tarefas_padrao.map((g) => g.grupo) ?? [])])];
}

/* ───────── sub-modal: editar campos ricos de uma tarefa ──────────────────── */
function ModalTarefaServico({
  tarefa, sugestoesGrupos, profiles, onClose, onSave,
}: {
  tarefa: TarefaServico;
  sugestoesGrupos: string[];
  profiles: Profile[];
  onClose: () => void;
  onSave: (t: TarefaServico) => void;
}) {
  const [form, setForm] = useState<TarefaServico>(tarefa);
  const listId = useId();
  const set = <K extends keyof TarefaServico>(k: K, v: TarefaServico[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.texto.trim()) { toast.error("Informe o texto da tarefa"); return; }
    onSave(form);
    onClose();
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Editar Tarefa" onClose={onClose} />
      <div className="p-5 space-y-3">
        <div>
          <label className="field-label">Tarefa *</label>
          <input value={form.texto} onChange={(e) => set("texto", e.target.value)} className="input-base" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Etapa</label>
            <input
              value={form.grupo ?? ""}
              onChange={(e) => set("grupo", e.target.value)}
              list={listId}
              className="input-base"
            />
          </div>
          <div>
            <label className="field-label">Prioridade</label>
            <select value={form.prioridade ?? ""} onChange={(e) => set("prioridade", (e.target.value || undefined) as TarefaServico["prioridade"])} className="input-base">
              <option value="">Sem prioridade</option>
              {PRIORIDADES_TAREFA.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Responsável</label>
            <select value={form.responsavel_id ?? ""} onChange={(e) => set("responsavel_id", e.target.value || null)} className="input-base">
              <option value="">Sem responsável</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Status</label>
            <select
              value={statusDeTarefa(form)}
              onChange={(e) => {
                const status = e.target.value as StatusTarefa;
                setForm((p) => ({ ...p, status, feito: status === "concluido" }));
              }}
              className="input-base"
            >
              {STATUS_TAREFA.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Início</label>
            <input type="date" value={form.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value || null)} className="input-base" />
          </div>
          <div>
            <label className="field-label">Prazo</label>
            <input type="date" value={form.data_prevista ?? ""} onChange={(e) => set("data_prevista", e.target.value || null)} className="input-base" />
          </div>
        </div>

        <div>
          <label className="field-label">Descrição</label>
          <textarea value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} rows={3} className="input-base resize-none" />
        </div>

        <datalist id={listId}>
          {sugestoesGrupos.map((g) => <option key={g} value={g} />)}
        </datalist>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" size="sm" onClick={handleSave}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── linha de "adicionar tarefa" — estado local, um por disciplina ── */
function AddTarefaRow({ sugestoesGrupos, saving, onAdd }: {
  sugestoesGrupos: string[];
  saving: boolean;
  onAdd: (texto: string, grupo: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [grupo, setGrupo] = useState("");
  const listId = useId();

  const submit = () => {
    if (!texto.trim()) return;
    onAdd(texto, grupo);
    setTexto("");
  };

  return (
    <div className="flex gap-2">
      <input
        value={grupo}
        onChange={(e) => setGrupo(e.target.value)}
        list={listId}
        placeholder="Etapa..."
        className="input-base w-32 flex-shrink-0"
      />
      <datalist id={listId}>
        {sugestoesGrupos.map((g) => <option key={g} value={g} />)}
      </datalist>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Nova tarefa..."
        className="input-base flex-1"
      />
      <Button variant="secondary" size="sm" onClick={submit} loading={saving}>+ Adicionar</Button>
    </div>
  );
}

/* ───────── checklist de uma disciplina, agrupado por etapa ───────────────── */
function ChecklistDisciplina({ bloco, saving, onToggle, onRemover, onEditar }: {
  bloco: Disciplina;
  saving: boolean;
  onToggle: (id: string) => void;
  onRemover: (id: string) => void;
  onEditar: (t: TarefaServico) => void;
}) {
  const grupos = agruparTarefas(bloco.tarefas);
  const ordemGrupos = grupos.map((g) => g.grupo);

  if (bloco.tarefas.length === 0) {
    return (
      <div className="py-5 text-center border border-dashed border-slate-200 rounded-xl mb-2">
        <p className="text-xs text-slate-400">Sem tarefas. Adicione manualmente ou carregue o checklist padrão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-3">
      {grupos.map(({ grupo, itens }) => {
        const feitasGrupo = itens.filter((t) => t.feito).length;
        const cor = corDoGrupo(grupo, ordemGrupos);
        return (
          <div key={grupo}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{grupo}</p>
              <span className="text-[10px] text-slate-400">{feitasGrupo}/{itens.length}</span>
            </div>
            <div className="space-y-1.5">
              {itens.map((t) => {
                const prioridade = PRIORIDADES_TAREFA.find((p) => p.id === t.prioridade);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={t.feito}
                      onChange={() => onToggle(t.id)}
                      disabled={saving}
                      className="accent-blue-500 flex-shrink-0"
                    />
                    <button
                      type="button"
                      onClick={() => onEditar(t)}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left"
                    >
                      <span className={`text-[13px] truncate ${t.feito ? "line-through text-slate-400" : "text-slate-700"}`}>
                        {t.texto}
                      </span>
                      {prioridade && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: prioridade.cor }} title={`Prioridade ${prioridade.label}`} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemover(t.id)}
                      className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Kanban de status ────────────────────────────────────────────────
   Eixo diferente do quadro de Fases de Execução (Gestão de Projetos): lá 1
   card = 1 serviço inteiro entre serviços do mesmo tipo; aqui 1 card = 1
   tarefa. Quando a proposta tem várias disciplinas, o quadro mistura as
   tarefas de todas elas — cada card mostra de qual disciplina é.        */
interface TarefaTag { servicoId: string; disciplina: string }

const CardTarefaKanban = memo(function CardTarefaKanban({
  tarefa, disciplina, mostrarDisciplina, responsavel, onClick,
}: { tarefa: TarefaServico; disciplina: string; mostrarDisciplina: boolean; responsavel: Profile | undefined; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id });
  const prioridade = PRIORIDADES_TAREFA.find((p) => p.id === tarefa.prioridade);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onClick()}
      className={`mb-2 cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-30" : ""}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined}
    >
      <div className="bg-white rounded-lg p-2.5 shadow-card border border-slate-100 hover:shadow-card-hover transition-shadow space-y-1">
        {mostrarDisciplina && <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">🛠 {disciplina}</p>}
        <p className="text-[12px] font-semibold text-slate-800 leading-snug">{tarefa.texto}</p>
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] text-slate-400">{tarefa.grupo || "Geral"}</span>
          <div className="flex items-center gap-1.5">
            {prioridade && <span className="w-1.5 h-1.5 rounded-full" style={{ background: prioridade.cor }} title={`Prioridade ${prioridade.label}`} />}
            {responsavel && <span className="text-[9.5px] text-slate-400">{responsavel.nome.split(" ")[0]}</span>}
          </div>
        </div>
      </div>
    </div>
  );
});

function ColunaStatus({ status, tarefas, tags, mostrarDisciplina, profiles, onClickTarefa }: {
  status: (typeof STATUS_TAREFA)[number];
  tarefas: TarefaServico[];
  tags: Map<string, TarefaTag>;
  mostrarDisciplina: boolean;
  profiles: Profile[];
  onClickTarefa: (t: TarefaServico) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  return (
    <div className="min-w-[190px] max-w-[210px] flex-shrink-0">
      <div className="flex justify-between items-center mb-2 px-2 py-1.5 bg-slate-50 rounded-lg border-t-[3px]" style={{ borderTopColor: status.cor }}>
        <p className="text-[11px] font-bold text-slate-800">{status.label}</p>
        <span className="text-[10px] text-slate-400">{tarefas.length}</span>
      </div>
      <div className={`min-h-[60px] rounded-lg transition-colors ${isOver ? "bg-blue-50 outline-2 outline-dashed outline-blue-300" : ""}`}>
        {tarefas.map((t) => (
          <CardTarefaKanban
            key={t.id}
            tarefa={t}
            disciplina={tags.get(t.id)?.disciplina ?? ""}
            mostrarDisciplina={mostrarDisciplina}
            responsavel={profiles.find((p) => p.id === t.responsavel_id)}
            onClick={() => onClickTarefa(t)}
          />
        ))}
      </div>
    </div>
  );
}

function QuadroStatusTarefas({ tarefas, tags, mostrarDisciplina, profiles, onMoverStatus, onClickTarefa }: {
  tarefas: TarefaServico[];
  tags: Map<string, TarefaTag>;
  mostrarDisciplina: boolean;
  profiles: Profile[];
  onMoverStatus: (id: string, status: StatusTarefa) => void;
  onClickTarefa: (t: TarefaServico) => void;
}) {
  const [ativa, setAtiva] = useState<TarefaServico | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    setAtiva(tarefas.find((t) => t.id === event.active.id) ?? null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setAtiva(null);
    const { active, over } = event;
    if (!over) return;
    const tarefa = tarefas.find((t) => t.id === active.id);
    const novoStatus = over.id as StatusTarefa;
    if (!tarefa || statusDeTarefa(tarefa) === novoStatus) return;
    onMoverStatus(tarefa.id, novoStatus);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3 items-start">
        {STATUS_TAREFA.map((s) => (
          <ColunaStatus
            key={s.id}
            status={s}
            tarefas={tarefas.filter((t) => statusDeTarefa(t) === s.id)}
            tags={tags}
            mostrarDisciplina={mostrarDisciplina}
            profiles={profiles}
            onClickTarefa={onClickTarefa}
          />
        ))}
      </div>
      <DragOverlay>
        {ativa ? (
          <div className="w-[180px] rotate-2 shadow-card-hover">
            <div className="bg-white rounded-lg p-2.5 border border-slate-100">
              <p className="text-[12px] font-semibold text-slate-800">{ativa.texto}</p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ───────── Main ─────────────────────────────────────────────────────────── */
export default function AbaTarefasServico({ servico, catalogoServico, profiles, onUpdated, outrasDisciplinas = [] }: Props) {
  const [saving, setSaving] = useState(false);
  const [visao, setVisao] = useState<Visao>("lista");
  const [tarefaEditando, setTarefaEditando] = useState<{ servicoId: string; tarefa: TarefaServico } | null>(null);
  // Tarefas dos outros serviços da proposta — seguem só localmente aqui
  // (ModalServico não os mantém reativos); persistidas direto no serviço
  // dono a cada mudança, igual ao serviço atual.
  const [siblingTarefas, setSiblingTarefas] = useState<Record<string, TarefaServico[]>>(
    () => Object.fromEntries(outrasDisciplinas.map((d) => [d.servico.id, d.servico.tarefas]))
  );
  // Recolhido por padrão quando há mais de uma disciplina — 48 tarefas de
  // 3 serviços abertas ao mesmo tempo é informação demais na tela (mesmo
  // ajuste já feito no Catálogo de Serviços). Serviço avulso nunca usa isso.
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const toggleExpandida = (servicoId: string) => {
    setExpandidas((prev) => {
      const copia = new Set(prev);
      if (copia.has(servicoId)) copia.delete(servicoId); else copia.add(servicoId);
      return copia;
    });
  };

  const blocos: Disciplina[] = [
    { servicoId: servico.id, nome: catalogoServico?.nome ?? "Este serviço", catalogoServico, tarefas: servico.tarefas },
    ...outrasDisciplinas.map((d) => ({
      servicoId: d.servico.id,
      nome: d.catalogoServico?.nome ?? "Serviço",
      catalogoServico: d.catalogoServico,
      tarefas: siblingTarefas[d.servico.id] ?? d.servico.tarefas,
    })),
  ];
  const multiplas = blocos.length > 1;

  const persistir = async (servicoId: string, tarefas: TarefaServico[]) => {
    setSaving(true);
    try {
      await updateServico(servicoId, { tarefas });
      if (servicoId === servico.id) onUpdated(tarefas);
      else setSiblingTarefas((prev) => ({ ...prev, [servicoId]: tarefas }));
    } catch {
      toast.error("Erro ao salvar tarefas.");
    } finally {
      setSaving(false);
    }
  };

  const handleCarregarPadrao = (bloco: Disciplina) => {
    if (!bloco.catalogoServico?.tarefas_padrao?.length) return;
    const novas: TarefaServico[] = bloco.catalogoServico.tarefas_padrao.flatMap((g) =>
      g.tarefas.map((texto) => ({ id: novoId(), texto, feito: false, grupo: g.grupo }))
    );
    persistir(bloco.servicoId, [...bloco.tarefas, ...novas]);
  };

  const handleAdicionar = (bloco: Disciplina, texto: string, grupo: string) => {
    persistir(bloco.servicoId, [
      ...bloco.tarefas,
      { id: novoId(), texto: texto.trim(), feito: false, grupo: grupo.trim() || "Geral" },
    ]);
  };

  const handleToggle = (bloco: Disciplina, id: string) => {
    persistir(bloco.servicoId, bloco.tarefas.map((t) => {
      if (t.id !== id) return t;
      const feito = !t.feito;
      return { ...t, feito, status: feito ? "concluido" : "a_fazer" };
    }));
  };

  const handleRemover = (bloco: Disciplina, id: string) => {
    persistir(bloco.servicoId, bloco.tarefas.filter((t) => t.id !== id));
  };

  const handleMoverStatus = (tarefaId: string, status: StatusTarefa) => {
    const bloco = blocos.find((b) => b.tarefas.some((t) => t.id === tarefaId));
    if (!bloco) return;
    persistir(bloco.servicoId, bloco.tarefas.map((t) => (t.id === tarefaId ? { ...t, status, feito: status === "concluido" } : t)));
  };

  const handleSalvarEdicao = (servicoId: string, editada: TarefaServico) => {
    const bloco = blocos.find((b) => b.servicoId === servicoId);
    if (!bloco) return;
    persistir(servicoId, bloco.tarefas.map((t) => (t.id === editada.id ? editada : t)));
  };

  const totalTarefas = blocos.reduce((s, b) => s + b.tarefas.length, 0);
  const totalFeitas = blocos.reduce((s, b) => s + b.tarefas.filter((t) => t.feito).length, 0);

  const todasTarefas = blocos.flatMap((b) => b.tarefas);
  const tags = new Map<string, TarefaTag>(
    blocos.flatMap((b) => b.tarefas.map((t): [string, TarefaTag] => [t.id, { servicoId: b.servicoId, disciplina: b.nome }]))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setVisao("lista")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${visao === "lista" ? "bg-white shadow-sm text-slate-800" : "text-slate-400"}`}
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setVisao("kanban")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${visao === "kanban" ? "bg-white shadow-sm text-slate-800" : "text-slate-400"}`}
            >
              Kanban
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {totalTarefas > 0 ? `${totalFeitas} de ${totalTarefas} concluídas` : "Nenhuma tarefa ainda"}
          </p>
        </div>
        {!multiplas && !!catalogoServico?.tarefas_padrao?.length && (
          <button
            type="button"
            onClick={() => handleCarregarPadrao(blocos[0])}
            disabled={saving}
            className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold disabled:opacity-50"
          >
            + Carregar checklist padrão ({catalogoServico.nome})
          </button>
        )}
      </div>

      {visao === "kanban" ? (
        <div className="mb-3">
          <QuadroStatusTarefas
            tarefas={todasTarefas}
            tags={tags}
            mostrarDisciplina={multiplas}
            profiles={profiles}
            onMoverStatus={handleMoverStatus}
            onClickTarefa={(t) => setTarefaEditando({ servicoId: tags.get(t.id)!.servicoId, tarefa: t })}
          />
        </div>
      ) : (
        blocos.map((bloco) => {
          const aberto = !multiplas || expandidas.has(bloco.servicoId);
          const feitasBloco = bloco.tarefas.filter((t) => t.feito).length;
          return (
            <div key={bloco.servicoId} className={multiplas ? "mb-2 border border-slate-100 rounded-xl overflow-hidden" : ""}>
              {multiplas && (
                <button
                  type="button"
                  onClick={() => toggleExpandida(bloco.servicoId)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-[12px] font-extrabold text-slate-800 uppercase tracking-wide">🛠 {bloco.nome}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10.5px] text-slate-400">{feitasBloco}/{bloco.tarefas.length}</span>
                    <span className={`text-slate-400 text-[10px] transition-transform ${aberto ? "rotate-180" : ""}`}>▼</span>
                  </span>
                </button>
              )}
              {aberto && (
                <div className={multiplas ? "p-3" : ""}>
                  {multiplas && !!bloco.catalogoServico?.tarefas_padrao?.length && (
                    <div className="mb-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleCarregarPadrao(bloco)}
                        disabled={saving}
                        className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold disabled:opacity-50"
                      >
                        + Carregar checklist padrão
                      </button>
                    </div>
                  )}
                  <ChecklistDisciplina
                    bloco={bloco}
                    saving={saving}
                    onToggle={(id) => handleToggle(bloco, id)}
                    onRemover={(id) => handleRemover(bloco, id)}
                    onEditar={(t) => setTarefaEditando({ servicoId: bloco.servicoId, tarefa: t })}
                  />
                  <AddTarefaRow
                    sugestoesGrupos={sugestoesDoBloco(bloco)}
                    saving={saving}
                    onAdd={(texto, grupo) => handleAdicionar(bloco, texto, grupo)}
                  />
                </div>
              )}
            </div>
          );
        })
      )}

      {tarefaEditando && (
        <ModalTarefaServico
          tarefa={tarefaEditando.tarefa}
          sugestoesGrupos={sugestoesDoBloco(blocos.find((b) => b.servicoId === tarefaEditando.servicoId)!)}
          profiles={profiles}
          onClose={() => setTarefaEditando(null)}
          onSave={(editada) => handleSalvarEdicao(tarefaEditando.servicoId, editada)}
        />
      )}
    </div>
  );
}
