"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useServicos } from "@/hooks/useServicos";
import PipelineServicos from "./PipelineServicos";
import ModalServico from "./ModalServico";
import PainelFinanceiroServicos from "./PainelFinanceiroServicos";
import AbaEquipeServicos from "./AbaEquipeServicos";
import AbaGestaoProjetos from "./AbaGestaoProjetos";
import { getCatalogoServicos, createCatalogoServico, updateCatalogoServico, deleteCatalogoServico } from "@/services/catalogoServicos.service";
import { getCategoriasServico } from "@/services/categoriasServico.service";
import { getTemplatesServico, createTemplateServico, updateTemplateServico, deleteTemplateServico } from "@/services/templatesServico.service";
import { corDoGrupo } from "@/lib/tarefasGrupos";
import type {
  CatalogoServico, Servico, EtapaServico, GrupoTarefasPadrao, FaseExecucao,
  CategoriaServico, TemplateServico,
} from "@/types/app.types";
import toast from "react-hot-toast";

type Aba = "comercial" | "projetos" | "equipe" | "financeiro" | "configuracoes";
type SubAbaConfig = "catalogo" | "templates";

interface GrupoEditavel { nome: string; tarefasTexto: string }

function novaFaseId(): string {
  return `f${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/* ───────── editor reutilizável: checklist por etapa + fases de execução ──── */
// Usado só dentro de ModalTemplateServico — é aqui que "como o serviço é
// executado" é definido, não mais no cadastro do item de catálogo.
function useEditorTemplate(template: TemplateServico | null) {
  const [grupos, setGrupos] = useState<GrupoEditavel[]>(() => {
    const iniciais = (template?.tarefas_padrao ?? []).map((g) => ({ nome: g.grupo, tarefasTexto: g.tarefas.join("\n") }));
    return iniciais.length > 0 ? iniciais : [{ nome: "", tarefasTexto: "" }];
  });
  const [fases, setFases] = useState<{ id: string; nome: string }[]>(
    () => (template?.fases_execucao ?? []).map((f) => ({ id: f.id, nome: f.nome }))
  );

  const setGrupo = (i: number, campo: keyof GrupoEditavel, v: string) => {
    setGrupos((prev) => prev.map((g, idx) => (idx === i ? { ...g, [campo]: v } : g)));
  };
  const addGrupo = () => setGrupos((prev) => [...prev, { nome: "", tarefasTexto: "" }]);
  const removerGrupo = (i: number) => setGrupos((prev) => prev.filter((_, idx) => idx !== i));

  const setFaseNome = (i: number, nome: string) => setFases((prev) => prev.map((f, idx) => (idx === i ? { ...f, nome } : f)));
  const addFase = () => setFases((prev) => [...prev, { id: novaFaseId(), nome: "" }]);
  const removerFase = (i: number) => setFases((prev) => prev.filter((_, idx) => idx !== i));
  const moverFase = (i: number, dir: -1 | 1) => {
    setFases((prev) => {
      const alvo = i + dir;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[alvo]] = [copia[alvo], copia[i]];
      return copia;
    });
  };

  const construir = (): { tarefas_padrao: GrupoTarefasPadrao[]; fases_execucao: FaseExecucao[] } => {
    // Mantém uma etapa mesmo sem tarefa nenhuma ainda (o nome já é
    // estrutura válida — só descarta a linha se estiver 100% vazia, senão
    // o usuário perde a etapa que acabou de nomear antes de preencher os
    // itens).
    const tarefas_padrao: GrupoTarefasPadrao[] = grupos
      .filter((g) => g.nome.trim() || g.tarefasTexto.trim())
      .map((g) => ({
        grupo: g.nome.trim() || "Geral",
        tarefas: g.tarefasTexto.split("\n").map((t) => t.trim()).filter(Boolean),
      }));
    const nomesFases = fases.map((f) => f.nome.trim()).filter(Boolean);
    const fases_execucao: FaseExecucao[] = fases
      .filter((f) => f.nome.trim())
      .map((f) => ({ id: f.id, nome: f.nome.trim(), cor: corDoGrupo(f.nome.trim(), nomesFases) }));
    return { tarefas_padrao, fases_execucao };
  };

  return { grupos, setGrupo, addGrupo, removerGrupo, fases, setFaseNome, addFase, removerFase, moverFase, construir };
}

function EditorChecklistEFases(props: ReturnType<typeof useEditorTemplate>) {
  const { grupos, setGrupo, addGrupo, removerGrupo, fases, setFaseNome, addFase, removerFase, moverFase } = props;
  return (
    <>
      <div>
        <label className="field-label">Checklist padrão — por etapa</label>
        <p className="text-[10px] text-slate-400 -mt-0.5 mb-2">
          Cada grupo vira uma seção na aba Tarefas de todo serviço criado com esse template (ex: um serviço de
          Reforma tem etapas diferentes de um Projeto Arquitetônico).
        </p>
        <div className="space-y-2.5">
          {grupos.map((g, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={g.nome}
                  onChange={(e) => setGrupo(i, "nome", e.target.value)}
                  className="input-base flex-1 !py-1.5 font-semibold"
                  placeholder="Nome da etapa — ex: Arquitetônico"
                />
                {grupos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerGrupo(i)}
                    title="Remover etapa"
                    className="text-slate-300 hover:text-red-400 text-xs flex-shrink-0 px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
              <textarea
                value={g.tarefasTexto}
                onChange={(e) => setGrupo(i, "tarefasTexto", e.target.value)}
                rows={3}
                className="input-base resize-none !text-xs"
                placeholder={"Uma tarefa por linha\nEx: Estudo Preliminar\nDetalhamento\nCompatibilização"}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={addGrupo} className="mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-semibold">
          + Nova Etapa
        </button>
      </div>

      <div>
        <label className="field-label">Fases de Execução (quadro Kanban)</label>
        <p className="text-[10px] text-slate-400 -mt-0.5 mb-2">
          Colunas do quadro em Gestão de Projetos pra serviços com esse template (ex: Levantamento → Anteprojeto →
          Aprovação do Cliente). Deixe vazio pra usar a lista simples em vez de quadro.
        </p>
        <div className="space-y-1.5">
          {fases.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-300 w-4 flex-shrink-0 text-center">{i + 1}</span>
              <input
                value={f.nome}
                onChange={(e) => setFaseNome(i, e.target.value)}
                className="input-base flex-1 !py-1.5"
                placeholder={`Ex: ${["Levantamento", "Anteprojeto", "Aprovação do Cliente"][i] ?? "Fase"}`}
              />
              <button type="button" onClick={() => moverFase(i, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 text-xs px-0.5">▲</button>
              <button type="button" onClick={() => moverFase(i, 1)} disabled={i === fases.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 text-xs px-0.5">▼</button>
              <button type="button" onClick={() => removerFase(i)} className="text-slate-300 hover:text-red-400 text-xs px-0.5">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addFase} className="mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-semibold">
          + Nova Fase
        </button>
      </div>
    </>
  );
}

/* ───────── sub-modal: Novo/Editar Template ────────────────────────────────── */
function ModalTemplateServico({
  template, onClose, onSave, onDelete,
}: {
  template: TemplateServico | null;
  onClose: () => void;
  onSave: (data: Partial<TemplateServico>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const isNovo = !template;
  const [form, setForm] = useState<Partial<TemplateServico>>(template ?? { nome: "", descricao: "", ativo: true });
  const editor = useEditorTemplate(template);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k: keyof TemplateServico, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleDelete = async () => {
    if (!template) return;
    if (!confirm(`Excluir o template "${template.nome}"? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await onDelete(template.id);
      onClose();
    } catch (e) {
      const jaEmUso = e instanceof Object && "code" in e && (e as { code?: string }).code === "23503";
      toast.error(
        jaEmUso
          ? "Esse template está em uso por serviços do catálogo — troque o template deles primeiro, ou edite o conteúdo deste em vez de excluir."
          : e instanceof Error ? e.message : "Erro ao excluir template."
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome do template"); return; }
    setSaving(true);
    try {
      const { tarefas_padrao, fases_execucao } = editor.construir();
      await onSave({ ...form, tarefas_padrao, fases_execucao });
      const totalItens = tarefas_padrao.reduce((s, g) => s + g.tarefas.length, 0);
      toast.success(
        `${isNovo ? "Template criado" : "Template atualizado"}! ${tarefas_padrao.length} etapa${tarefas_padrao.length !== 1 ? "s" : ""}, ${totalItens} tarefa${totalItens !== 1 ? "s" : ""}.`
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={isNovo ? "Novo Template" : "Editar Template"} onClose={onClose} />
      <div className="p-5 space-y-3">
        <div>
          <label className="field-label">Nome *</label>
          <input
            value={form.nome ?? ""}
            onChange={(e) => set("nome", e.target.value)}
            className="input-base"
            placeholder="Ex: Projeto Elétrico Residencial"
          />
        </div>
        <div>
          <label className="field-label">Descrição</label>
          <textarea
            value={form.descricao ?? ""}
            onChange={(e) => set("descricao", e.target.value)}
            rows={2}
            className="input-base resize-none"
            placeholder="Quando usar esse template..."
          />
        </div>

        <EditorChecklistEFases {...editor} />

        {!isNovo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo ?? true}
              onChange={(e) => set("ativo", e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-xs text-slate-700">Ativo (disponível pra vincular a serviços do catálogo)</span>
          </label>
        )}

        <div className="flex gap-2 pt-2">
          {!isNovo && (
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>Excluir</Button>
          )}
          <Button variant="secondary" className="flex-1" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" size="sm" onClick={handleSave} loading={saving}>
            {isNovo ? "Criar Template" : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── sub-modal: Novo/Editar item do catálogo ───────────────────────── */
// Simplificado (Sprint 13.8) — "como se executa" saiu daqui e virou
// Template; aqui fica só "o que se vende".
function ModalCatalogoServico({
  servico, categorias, templates, onClose, onSave, onDelete,
}: {
  servico: CatalogoServico | null;
  categorias: CategoriaServico[];
  templates: TemplateServico[];
  onClose: () => void;
  onSave: (data: Partial<CatalogoServico>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const isNovo = !servico;
  const [form, setForm] = useState<Partial<CatalogoServico>>(
    servico ?? { nome: "", categoria_id: null, template_padrao_id: null, descricao: "", ativo: true }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k: keyof CatalogoServico, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome do serviço"); return; }
    setSaving(true);
    try {
      await onSave({
        nome: form.nome,
        categoria_id: form.categoria_id || null,
        template_padrao_id: form.template_padrao_id || null,
        descricao: form.descricao || null,
        ativo: form.ativo ?? true,
      });
      toast.success(isNovo ? "Serviço cadastrado!" : "Serviço atualizado!");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar serviço.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!servico) return;
    if (!confirm(`Excluir "${servico.nome}" do catálogo? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await onDelete(servico.id);
      onClose();
    } catch (e) {
      const jaEmUso = e instanceof Object && "code" in e && (e as { code?: string }).code === "23503";
      toast.error(
        jaEmUso
          ? "Esse serviço está em uso por um ou mais serviços do pipeline — inative em vez de excluir."
          : e instanceof Error ? e.message : "Erro ao excluir serviço."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={isNovo ? "Novo Serviço no Catálogo" : "Editar Serviço"} onClose={onClose} />
      <div className="p-5 space-y-3">
        <div>
          <label className="field-label">Nome *</label>
          <input
            value={form.nome ?? ""}
            onChange={(e) => set("nome", e.target.value)}
            className="input-base"
            placeholder="Ex: Administração de Obra"
          />
        </div>

        <div>
          <label className="field-label">Categoria</label>
          <select value={form.categoria_id ?? ""} onChange={(e) => set("categoria_id", e.target.value || null)} className="input-base">
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">Descrição</label>
          <textarea
            value={form.descricao ?? ""}
            onChange={(e) => set("descricao", e.target.value)}
            rows={3}
            className="input-base resize-none"
            placeholder="O que esse serviço inclui..."
          />
        </div>

        <div>
          <label className="field-label">Template padrão</label>
          <p className="text-[10px] text-slate-400 -mt-0.5 mb-1">
            Define o checklist e o quadro Kanban usados por todo serviço criado com esse tipo. Gerenciado em
            Configurações → Templates.
          </p>
          <select value={form.template_padrao_id ?? ""} onChange={(e) => set("template_padrao_id", e.target.value || null)} className="input-base">
            <option value="">Nenhum (sem checklist/fases)</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>

        {!isNovo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo ?? true}
              onChange={(e) => set("ativo", e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-xs text-slate-700">Ativo no catálogo</span>
          </label>
        )}

        <div className="flex gap-2 pt-2">
          {!isNovo && (
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>Excluir</Button>
          )}
          <Button variant="secondary" className="flex-1" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" size="sm" onClick={handleSave} loading={saving}>
            {isNovo ? "Cadastrar" : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── painel: Catálogo de Serviços ──────────────────────────────────── */
// Agrupado por categoria e recolhido por padrão (Sprint 13.8) — com ~47
// serviços numa lista só, achar um item específico tinha virado o problema
// que a Categoria como entidade deveria resolver.
interface GrupoCatalogo { categoria: CategoriaServico | null; itens: CatalogoServico[] }

function PainelCatalogo() {
  const { pode } = usePermissoes();
  const [servicos, setServicos] = useState<CatalogoServico[]>([]);
  const [categorias, setCategorias] = useState<CategoriaServico[]>([]);
  const [templates, setTemplates] = useState<TemplateServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<CatalogoServico | "novo" | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, t] = await Promise.all([getCatalogoServicos(), getCategoriasServico(), getTemplatesServico()]);
      setServicos(s); setCategorias(c); setTemplates(t);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Partial<CatalogoServico>) => {
    if (typeof modal === "object" && modal) await updateCatalogoServico(modal.id, data);
    else await createCatalogoServico(data as Parameters<typeof createCatalogoServico>[0]);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteCatalogoServico(id);
    await load();
  };

  const toggleGrupo = (chave: string) => {
    setExpandidas((prev) => {
      const copia = new Set(prev);
      if (copia.has(chave)) copia.delete(chave); else copia.add(chave);
      return copia;
    });
  };

  const grupos: GrupoCatalogo[] = categorias
    .map((cat) => ({ categoria: cat, itens: servicos.filter((s) => s.categoria_id === cat.id) }))
    .filter((g) => g.itens.length > 0);
  const semCategoria = servicos.filter((s) => !s.categoria_id);
  if (semCategoria.length > 0) grupos.push({ categoria: null, itens: semCategoria });

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div>
          <p className="text-[13px] font-bold text-slate-700">Catálogo de Serviços ({servicos.length})</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Cada linha aqui é um serviço que a empresa vende — aparece pra seleção ao criar um serviço no pipeline.
          </p>
        </div>
        {pode("servicos-tecnicos", "criar") && (
          <Button variant="primary" size="sm" onClick={() => setModal("novo")} className="flex-shrink-0">
            + Novo Serviço
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : servicos.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400">Nenhum serviço cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map((g) => {
            const chave = g.categoria?.id ?? "sem-categoria";
            const aberto = expandidas.has(chave);
            return (
              <div key={chave} className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGrupo(chave)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-[12.5px] font-bold text-slate-700">{g.categoria?.nome ?? "Sem categoria"}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10.5px] text-slate-400">{g.itens.length}</span>
                    <span className={`text-slate-400 text-[10px] transition-transform ${aberto ? "rotate-180" : ""}`}>▼</span>
                  </span>
                </button>
                {aberto && (
                  <div className="p-2 space-y-1.5">
                    {g.itens.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => pode("servicos-tecnicos", "editar") && setModal(s)}
                        className={`rounded-lg p-3 flex justify-between items-center ${pode("servicos-tecnicos", "editar") ? "cursor-pointer hover:bg-slate-50" : ""}`}
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900">{s.nome}</p>
                          {s.template_padrao_id && (
                            <p className="text-[11px] text-slate-400">
                              {templates.find((t) => t.id === s.template_padrao_id)?.nome ?? "Template"}
                            </p>
                          )}
                        </div>
                        <Badge color={s.ativo ? "#10B981" : "#94A3B8"}>{s.ativo ? "Ativo" : "Inativo"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <ModalCatalogoServico
          servico={modal === "novo" ? null : modal}
          categorias={categorias}
          templates={templates}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/* ───────── painel: Templates ──────────────────────────────────────────────── */
function PainelTemplates() {
  const { pode } = usePermissoes();
  const [templates, setTemplates] = useState<TemplateServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<TemplateServico | "novo" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await getTemplatesServico()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Partial<TemplateServico>) => {
    if (typeof modal === "object" && modal) await updateTemplateServico(modal.id, data);
    else await createTemplateServico(data as Omit<TemplateServico, "id" | "created_at">);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplateServico(id);
    await load();
  };

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div>
          <p className="text-[13px] font-bold text-slate-700">Templates ({templates.length})</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Checklist + fases de execução reutilizáveis — um template pode ser usado por vários serviços do catálogo.
          </p>
        </div>
        {pode("servicos-tecnicos", "criar") && (
          <Button variant="primary" size="sm" onClick={() => setModal("novo")} className="flex-shrink-0">
            + Novo Template
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : templates.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400">Nenhum template cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map((t) => {
            const totalTarefas = t.tarefas_padrao.reduce((s, g) => s + g.tarefas.length, 0);
            return (
              <div
                key={t.id}
                onClick={() => pode("servicos-tecnicos", "editar") && setModal(t)}
                className={`card p-4 flex justify-between items-center ${pode("servicos-tecnicos", "editar") ? "cursor-pointer hover:shadow-card-hover" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">{t.nome}</p>
                  <p className="text-[11px] text-slate-400">
                    {t.tarefas_padrao.length} etapa{t.tarefas_padrao.length !== 1 ? "s" : ""} · {totalTarefas} tarefa{totalTarefas !== 1 ? "s" : ""}
                    {t.fases_execucao.length > 0 && ` · quadro com ${t.fases_execucao.length} fases`}
                  </p>
                </div>
                <Badge color={t.ativo ? "#10B981" : "#94A3B8"}>{t.ativo ? "Ativo" : "Inativo"}</Badge>
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <ModalTemplateServico
          template={modal === "novo" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/* ───────── aba Configurações (Catálogo + Templates) ──────────────────────── */
// Dados de configuração do sistema, não do dia a dia — por isso ficam à
// parte das abas operacionais (Comercial/Projetos/Equipe/Financeiro), num
// botão próprio do outro lado da barra.
function PainelConfiguracoes() {
  const [subAba, setSubAba] = useState<SubAbaConfig>("catalogo");
  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        <button
          onClick={() => setSubAba("catalogo")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${subAba === "catalogo" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
        >
          Catálogo de Serviços
        </button>
        <button
          onClick={() => setSubAba("templates")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${subAba === "templates" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
        >
          Templates
        </button>
      </div>
      {subAba === "catalogo" && <PainelCatalogo />}
      {subAba === "templates" && <PainelTemplates />}
    </div>
  );
}

/* ───────── aba Comercial (Pipeline) ──────────────────────────────────────── */
function AbaComercial() {
  const { pode } = usePermissoes();
  const { servicos, loading, salvar, avancarEtapa } = useServicos();
  const [modal, setModal] = useState<Servico | "novo" | null>(null);

  // Veio de um link de alerta (ex: /servicos-tecnicos?servico=xxx) — abre direto.
  const searchParams = useSearchParams();
  const servicoParam = searchParams.get("servico");
  const [linkConsumido, setLinkConsumido] = useState(false);
  useEffect(() => {
    if (linkConsumido || !servicoParam || servicos.length === 0) return;
    const alvo = servicos.find((s) => s.id === servicoParam);
    if (alvo) setModal(alvo);
    setLinkConsumido(true);
  }, [servicoParam, servicos, linkConsumido]);

  const handleSave = async (data: Partial<Servico>) => {
    await salvar(modal !== "novo" && modal ? { ...data, id: modal.id } : data);
  };

  const handleMoveEtapa = (servicoId: string, novaEtapa: EtapaServico) => {
    avancarEtapa(servicoId, novaEtapa);
  };

  return (
    <div>
      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : (
        <PipelineServicos
          servicos={servicos}
          onEdit={(s) => setModal(s)}
          onAddServico={() => setModal("novo")}
          onMoveEtapa={handleMoveEtapa}
          podeCriar={pode("servicos-tecnicos", "criar")}
        />
      )}

      {modal !== null && (
        <ModalServico
          servico={modal === "novo" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onAvancar={async (id, etapa) => { await avancarEtapa(id, etapa); }}
        />
      )}
    </div>
  );
}

/* ───────── Main ────────────────────────────────────────────────────────── */
export default function SetorServicosTecnicos() {
  const searchParams = useSearchParams();
  const abaParam = searchParams.get("aba") as Aba | null;
  const [aba, setAba] = useState<Aba>(abaParam ?? "comercial");
  const tabs: [Aba, string][] = [
    ["comercial", "Comercial"],
    ["projetos", "Gestão de Projetos"],
    ["equipe", "Equipe"],
    ["financeiro", "Financeiro"],
  ];

  return (
    <div>
      <div className="bg-white border-b border-slate-100 px-6 flex gap-1 justify-between">
        <div className="flex gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)} className={`tab-btn ${aba === id ? "active" : ""}`}>{label}</button>
          ))}
        </div>
        <button
          onClick={() => setAba("configuracoes")}
          title="Catálogo de Serviços e Templates"
          className={`tab-btn ${aba === "configuracoes" ? "active" : ""}`}
        >
          ⚙ Configurações
        </button>
      </div>
      <div className="p-6 max-w-[1400px] mx-auto">
        {aba === "comercial" && <AbaComercial />}
        {aba === "projetos" && <AbaGestaoProjetos />}
        {aba === "equipe" && <AbaEquipeServicos />}
        {aba === "financeiro" && <PainelFinanceiroServicos />}
        {aba === "configuracoes" && <PainelConfiguracoes />}
      </div>
    </div>
  );
}
