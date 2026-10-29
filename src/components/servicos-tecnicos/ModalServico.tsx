"use client";
import { useState, useEffect, useCallback } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Timeline from "@/components/shared/Timeline";
import AbaHistorico from "@/components/shared/AbaHistorico";
import AbaTarefasServico from "./AbaTarefasServico";
import AbaCronogramaServico from "./AbaCronogramaServico";
import AbaArquivosServico from "./AbaArquivosServico";
import AbaOrcamentoServico from "./AbaOrcamentoServico";
import AbaFinanceiroServico from "./AbaFinanceiroServico";
import ModalCliente from "@/components/clientes/ModalCliente";
import { ETAPAS_SERVICO, FLUXO_SERVICO } from "@/constants/etapas";
import { buscarClientePorCpfCnpj, createCliente, updateCliente } from "@/services/clientes.service";
import { getCatalogoServicos } from "@/services/catalogoServicos.service";
import { getIndicadores, createIndicador, deleteIndicador } from "@/services/indicadores.service";
import { getProfiles } from "@/services/profiles.service";
import { getLancamentosPorServico } from "@/services/lancamentosServico.service";
import { getServicosPorProposta } from "@/services/servicos.service";
import { principalDoGrupo } from "@/lib/propostas";
import { gerarRelatorioServico } from "@/lib/pdf/relatorios/servico";
import { baixarPdf } from "@/lib/pdf/baixarPdf";
import { useEmpresaContexto } from "@/hooks/useEmpresaContexto";
import { fmtBRL, maskCPF, maskPhone, validarCPF } from "@/lib/utils";
import type { Servico, EtapaServico, CatalogoServico, Indicador, Profile, TarefaServico, Cliente } from "@/types/app.types";
import toast from "react-hot-toast";

type Tab = "geral" | "orcamento" | "tarefas" | "cronograma" | "financeiro" | "arquivos" | "historico" | "editar";

function novoId(): string {
  return `t${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// Uma proposta pode fechar vários serviços do catálogo de uma vez pro mesmo
// cliente (ex: Projeto Arquitetônico + Complementares de uma mesma casa) —
// cada item vira um Servico próprio na criação, todos compartilhando
// proposta_id quando há mais de um. Ver ModalServico.handleSave.
interface ItemProposta {
  id: string;
  catalogo_servico_id: string;
  valor_proposta: number | null;
}

/* ───────── sub-modal: Gerenciar Indicadores ──────────────────────────────── */
function ModalNovoIndicador({ onClose, onSaved, onDeleted, indicadores }: {
  onClose: () => void;
  onSaved: (i: Indicador) => void;
  onDeleted: (id: string) => void;
  indicadores: Indicador[];
}) {
  const [form, setForm] = useState({ nome: "", tipo: "", telefone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const novo = await createIndicador({
        nome: form.nome,
        tipo: form.tipo || null,
        telefone: form.telefone || null,
        email: form.email || null,
        ativo: true,
      });
      toast.success("Indicador cadastrado!");
      setForm({ nome: "", tipo: "", telefone: "", email: "" });
      onSaved(novo);
    } catch {
      toast.error("Erro ao cadastrar indicador");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteIndicador(id);
      onDeleted(id);
    } catch {
      toast.error("Erro ao remover indicador");
    } finally { setDeletingId(null); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Gerenciar Indicadores" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div>
          <p className="field-label mb-2">Cadastrados ({indicadores.length})</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {indicadores.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum indicador cadastrado</p>
            )}
            {indicadores.map((i) => (
              <div key={i.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="min-w-0">
                  <span className="text-sm text-slate-700">{i.nome}</span>
                  {i.tipo && <span className="text-[11px] text-slate-400 ml-2">— {i.tipo}</span>}
                </div>
                <button
                  onClick={() => handleDelete(i.id)}
                  disabled={deletingId === i.id}
                  title="Remover indicador"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5 flex-shrink-0 ml-2 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="field-label">Adicionar Novo</p>
          <p className="text-[11px] text-slate-400 -mt-1">
            Corretor, parceiro, cliente indicando cliente, engenheiro, arquiteto, construtora, contador — qualquer um.
          </p>
          <div>
            <label className="field-label">Nome *</label>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className="input-base" placeholder="Nome completo" />
          </div>
          <div>
            <label className="field-label">Tipo (opcional)</label>
            <input value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className="input-base" placeholder="Ex: Arquiteto, Corretor, Cliente..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Telefone</label>
              <input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} maxLength={15} className="input-base" />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-base" />
            </div>
          </div>
          <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>Cadastrar</Button>
        </div>

        <Button variant="secondary" className="w-full" onClick={onClose} size="sm">Fechar</Button>
      </div>
    </Modal>
  );
}

/* ───────── aba Geral ──────────────────────────────────────────────────────── */
function GeralServico({ servico, cliente, outrosDaProposta }: { servico: Servico; cliente: Cliente | null; outrosDaProposta: Servico[] }) {
  return (
    <div className="space-y-4">
      {outrosDaProposta.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
          <p className="text-[11px] font-bold text-blue-700 mb-1.5">
            📎 Proposta com {outrosDaProposta.length + 1} serviços
          </p>
          <div className="space-y-0.5">
            {[servico, ...outrosDaProposta].map((s) => (
              <div key={s.id} className="flex justify-between text-[12px]">
                <span className="text-slate-600">{s.catalogoServico?.nome ?? "Serviço"}</span>
                <span className="font-semibold text-slate-700">{fmtBRL(s.valor_proposta)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[12px] font-bold text-blue-700 mt-1.5 pt-1.5 border-t border-blue-100">
            <span>Total da proposta</span>
            <span>{fmtBRL([servico, ...outrosDaProposta].reduce((sum, s) => sum + (s.valor_proposta ?? 0), 0))}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Valor da Proposta</p>
          <p className="text-[13px] font-extrabold text-emerald-600">
            {fmtBRL([servico, ...outrosDaProposta].reduce((sum, s) => sum + (s.valor_proposta ?? 0), 0))}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Comissão</p>
          <p className="text-[13px] font-bold text-purple-500">
            {servico.indicador ? `${servico.indicador.nome} — ${servico.indicador_pct ?? 0}%` : "Sem indicação"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
        {[
          ["Cliente", cliente?.nome],
          ["CPF/CNPJ", cliente?.cpf_cnpj],
          ["Telefone", cliente?.telefone],
          ["E-mail", cliente?.email],
          ["Serviço", servico.catalogoServico?.nome],
          ["Responsável", servico.responsavel?.nome],
        ]
          .filter(([, v]) => !!v)
          .map(([k, v]) => (
            <div key={k as string} className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">{k}</span>
              <span className="font-semibold text-slate-900 text-right max-w-[55%]">{v}</span>
            </div>
          ))}
      </div>

      {servico.anotacoes && (
        <div className="bg-slate-50 rounded-xl p-3.5">
          <p className="text-[11px] font-bold text-slate-500 mb-1">Observações</p>
          <p className="text-xs text-slate-700 leading-relaxed">{servico.anotacoes}</p>
        </div>
      )}
    </div>
  );
}

/* ───────── formulário de edição ──────────────────────────────────────────── */
function FormServico({
  servico, onChange, catalogo, indicadores, profiles, onAddIndicador, clienteVinculado, onEditarCliente,
}: {
  servico: Partial<Servico> & { _cpf?: string; _nome?: string; _telefone?: string; _email?: string; _itens?: ItemProposta[] };
  onChange: (d: Partial<Servico> & { _cpf?: string; _nome?: string; _telefone?: string; _email?: string; _itens?: ItemProposta[] }) => void;
  catalogo: CatalogoServico[];
  indicadores: Indicador[];
  profiles: Profile[];
  onAddIndicador: () => void;
  clienteVinculado: Cliente | null;
  onEditarCliente: () => void;
}) {
  const set = (k: string, v: unknown) => onChange({ ...servico, [k]: v });
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const isNovo = !servico.id;

  const handleBlurCpf = async () => {
    if (!servico._cpf || !validarCPF(servico._cpf)) return;
    setBuscandoCliente(true);
    try {
      const cliente = await buscarClientePorCpfCnpj(servico._cpf);
      if (cliente) {
        onChange({
          ...servico,
          cliente_id: cliente.id,
          _nome: servico._nome || cliente.nome,
          _telefone: servico._telefone || cliente.telefone || servico._telefone,
          _email: servico._email || cliente.email || servico._email,
        });
        toast.success(`Cliente já cadastrado — dados preenchidos (${cliente.nome})`);
      }
    } catch {
      // busca falhou silenciosamente — não impede o preenchimento manual
    } finally {
      setBuscandoCliente(false);
    }
  };

  const indicadorSelecionado = indicadores.find((i) => i.id === servico.indicador_id);

  const itens = servico._itens ?? [{ id: novoId(), catalogo_servico_id: "", valor_proposta: null }];
  const setItens = (novos: ItemProposta[]) => set("_itens", novos);
  const setItem = (i: number, campo: keyof ItemProposta, v: string | number | null) =>
    setItens(itens.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it)));
  const addItem = () => setItens([...itens, { id: novoId(), catalogo_servico_id: "", valor_proposta: null }]);
  const removerItem = (i: number) => setItens(itens.filter((_, idx) => idx !== i));
  const totalProposta = itens.reduce((s, it) => s + (it.valor_proposta ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Cliente</p>
        {!isNovo ? (
          // Serviço já existe — o cliente é o registro único (Cliente Único,
          // Sprint 13.1). Editar aqui não faz sentido (viraria um segundo
          // formulário desconectado do cadastro real) — mostra os dados e
          // abre o ModalCliente de verdade pra editar.
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] space-y-0.5">
                <p className="font-bold text-slate-900">{clienteVinculado?.nome ?? "—"}</p>
                {clienteVinculado?.cpf_cnpj && <p className="text-slate-500">{clienteVinculado.cpf_cnpj}</p>}
                {clienteVinculado?.telefone && <p className="text-slate-500">{clienteVinculado.telefone}</p>}
                {clienteVinculado?.email && <p className="text-slate-500">{clienteVinculado.email}</p>}
              </div>
              <button type="button" onClick={onEditarCliente} className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold flex-shrink-0">
                Editar cliente
              </button>
            </div>
          </div>
        ) : (
          <>
            {servico.cliente_id ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                <p className="text-sm font-semibold text-emerald-700">★ {servico._nome} — cliente já cadastrado</p>
                <button
                  type="button"
                  onClick={() => onChange({ ...servico, cliente_id: undefined })}
                  className="text-[11px] text-emerald-600 underline"
                >
                  trocar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="field-label">Nome do Cliente *</label>
                  <input value={servico._nome ?? ""} onChange={(e) => set("_nome", e.target.value)} className="input-base" placeholder="Nome completo" />
                </div>
                <div>
                  <label className="field-label">CPF/CNPJ{buscandoCliente ? " (buscando...)" : ""}</label>
                  <input
                    value={servico._cpf ?? ""}
                    onChange={(e) => set("_cpf", maskCPF(e.target.value))}
                    onBlur={handleBlurCpf}
                    maxLength={14}
                    className="input-base"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="field-label">Telefone</label>
                  <input value={servico._telefone ?? ""} onChange={(e) => set("_telefone", maskPhone(e.target.value))} maxLength={15} className="input-base" />
                </div>
                <div className="col-span-2">
                  <label className="field-label">E-mail</label>
                  <input type="email" value={servico._email ?? ""} onChange={(e) => set("_email", e.target.value)} className="input-base" />
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1.5">
              Se o CPF já existir no sistema (de uma Obra ou outro serviço), os dados vêm preenchidos automaticamente.
            </p>
          </>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Serviço</p>

        {isNovo ? (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-400 -mt-1">
              Um cliente pode fechar vários serviços numa proposta só (ex: Projeto Arquitetônico + Complementares) —
              adicione quantos precisar. O checklist e as fases de cada um vêm do template do tipo escolhido.
            </p>
            {itens.map((item, i) => (
              <div key={item.id} className="flex gap-2 items-center">
                <select
                  value={item.catalogo_servico_id}
                  onChange={(e) => setItem(i, "catalogo_servico_id", e.target.value)}
                  className="input-base flex-1"
                >
                  <option value="">Selecione no catálogo</option>
                  {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <div className="w-32 flex-shrink-0">
                  <CurrencyInput value={item.valor_proposta} onChange={(v) => setItem(i, "valor_proposta", v)} placeholder="Valor" />
                </div>
                {itens.length > 1 && (
                  <button type="button" onClick={() => removerItem(i)} title="Remover item" className="text-slate-300 hover:text-red-400 text-sm px-1 flex-shrink-0">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold">
              + Adicionar Serviço
            </button>
            {itens.length > 1 && (
              <p className="text-[11px] font-bold text-emerald-600">Total da proposta: {fmtBRL(totalProposta)}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="field-label">Tipo de Serviço</label>
              <select value={servico.catalogo_servico_id ?? ""} onChange={(e) => set("catalogo_servico_id", e.target.value || null)} className="input-base">
                <option value="">Selecione no catálogo</option>
                {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Valor da Proposta (R$)</label>
              <CurrencyInput value={servico.valor_proposta} onChange={(v) => set("valor_proposta", v)} placeholder="Ex: 5000" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="field-label">Responsável</label>
            <select value={servico.responsavel_id ?? ""} onChange={(e) => set("responsavel_id", e.target.value || null)} className="input-base">
              <option value="">Selecionar</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Status de Execução</label>
            <select value={servico.status_execucao ?? "ativo"} onChange={(e) => set("status_execucao", e.target.value)} className="input-base">
              <option value="ativo">Ativo</option>
              <option value="paralisado">Paralisado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Indicação / Comissão</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Indicador</label>
            <div className="flex gap-1.5">
              <select value={servico.indicador_id ?? ""} onChange={(e) => set("indicador_id", e.target.value || null)} className="input-base flex-1">
                <option value="">Sem indicação</option>
                {indicadores.map((i) => <option key={i.id} value={i.id}>{i.nome}{i.tipo ? ` — ${i.tipo}` : ""}</option>)}
              </select>
              <button
                type="button"
                onClick={onAddIndicador}
                title="Cadastrar novo indicador"
                className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-500 flex items-center justify-center text-lg font-bold transition-colors"
              >+</button>
            </div>
            {indicadorSelecionado?.telefone && (
              <p className="text-[10px] text-slate-400 mt-0.5">{indicadorSelecionado.telefone}</p>
            )}
          </div>
          <div>
            <label className="field-label">% de Comissão</label>
            <input
              type="number" min={0} max={100} step={0.5}
              value={servico.indicador_pct ?? ""}
              onChange={(e) => set("indicador_pct", e.target.value ? Number(e.target.value) : null)}
              disabled={!servico.indicador_id}
              className="input-base disabled:bg-slate-50 disabled:text-slate-300"
              placeholder="Ex: 5"
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          O parcelamento da comissão é calculado automaticamente no Financeiro quando as parcelas do cliente forem lançadas (Sprint 13.5).
        </p>
      </div>

      <div>
        <label className="field-label">Observações</label>
        <textarea value={servico.anotacoes ?? ""} onChange={(e) => set("anotacoes", e.target.value)} rows={3} className="input-base resize-none" />
      </div>
    </div>
  );
}

/* ───────── main ModalServico ─────────────────────────────────────────────── */
interface Props {
  servico: Servico | null;
  onClose: () => void;
  onSave: (data: Partial<Servico>) => Promise<void>;
  onAvancar: (servicoId: string, novaEtapa: EtapaServico) => Promise<void>;
}

type FormState = Partial<Servico> & { _cpf?: string; _nome?: string; _telefone?: string; _email?: string; _itens?: ItemProposta[] };

export default function ModalServico({ servico, onClose, onSave, onAvancar }: Props) {
  const isNovo = !servico;
  const [tab, setTab] = useState<Tab>(isNovo ? "editar" : "geral");
  const [form, setForm] = useState<FormState>(
    servico ?? { etapa: "novo_lead", tarefas: [] }
  );
  const [tarefas, setTarefas] = useState<TarefaServico[]>(servico?.tarefas ?? []);
  const [saving, setSaving] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoServico[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [modalIndicador, setModalIndicador] = useState(false);
  const [clienteAtual, setClienteAtual] = useState<Cliente | null>(servico?.cliente ?? null);
  const [modalCliente, setModalCliente] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [outrosDaProposta, setOutrosDaProposta] = useState<Servico[]>([]);
  const { empresaNome, usuarioNome } = useEmpresaContexto();

  const catalogoDoServico = catalogo.find((c) => c.id === servico?.catalogo_servico_id) ?? null;

  useEffect(() => {
    getCatalogoServicos().then(setCatalogo).catch(() => {});
    getIndicadores().then(setIndicadores).catch(() => {});
    getProfiles().then(setProfiles).catch(() => {});
  }, []);

  useEffect(() => {
    if (!servico?.proposta_id) { setOutrosDaProposta([]); return; }
    getServicosPorProposta(servico.proposta_id)
      .then((lista) => setOutrosDaProposta(lista.filter((s) => s.id !== servico.id)))
      .catch(() => {});
  }, [servico?.proposta_id, servico?.id]);

  // Financeiro é um só por proposta, não por disciplina — "se o serviço tá
  // sendo orçado de uma vez só o pagamento é igual; se for parcelar
  // diferente é porque são propostas diferentes". Não importa por qual
  // serviço do grupo o usuário abriu o modal, lançamentos sempre vão pro
  // mesmo (o mais antigo do grupo, ver principalDoGrupo). Sem grupo =
  // Financeiro do próprio serviço, como sempre foi.
  const servicoFinanceiro = servico && outrosDaProposta.length > 0
    ? principalDoGrupo([servico, ...outrosDaProposta])
    : servico;

  // Tarefas integradas entre disciplinas da mesma proposta (Sprint 13.11) —
  // cada sibling entra com o próprio catálogo/template resolvido, pra
  // AbaTarefasServico saber o nome da disciplina e o checklist padrão dela.
  const outrasDisciplinas = outrosDaProposta.map((s) => ({
    servico: s,
    catalogoServico: catalogo.find((c) => c.id === s.catalogo_servico_id) ?? null,
  }));

  const etapaAtual = ETAPAS_SERVICO.find((e) => e.id === (servico?.etapa ?? form.etapa));
  const idxAtual = FLUXO_SERVICO.indexOf(form.etapa ?? "novo_lead");
  const proximaEtapa = idxAtual !== -1 && idxAtual < FLUXO_SERVICO.length - 1
    ? (FLUXO_SERVICO[idxAtual + 1] as EtapaServico)
    : null;
  const podeAvancar = !isNovo && proximaEtapa !== null;

  const handleSave = useCallback(async () => {
    if (!form.cliente_id && !form._nome?.trim()) { toast.error("Informe o nome do cliente"); return; }
    const itensValidos = isNovo ? (form._itens ?? []).filter((it) => it.catalogo_servico_id) : null;
    if (isNovo && (!itensValidos || itensValidos.length === 0)) { toast.error("Selecione ao menos um serviço do catálogo"); return; }
    setSaving(true);
    try {
      let clienteId = form.cliente_id;
      if (!clienteId) {
        const novoCliente = await createCliente({
          nome: form._nome!.trim(),
          cpf_cnpj: form._cpf || null,
          telefone: form._telefone || null,
          email: form._email || null,
        });
        clienteId = novoCliente.id;
      }

      if (isNovo && itensValidos) {
        // Mais de um item = proposta com vários serviços do mesmo cliente,
        // amarrados pelo mesmo proposta_id (Sprint 13.9). Cada um recebe o
        // template do tipo escolhido já aplicado — checklist e fase inicial
        // prontos na criação, sem precisar "Carregar checklist padrão" depois.
        const propostaId = itensValidos.length > 1 ? crypto.randomUUID() : null;
        for (const item of itensValidos) {
          const catalogoItem = catalogo.find((c) => c.id === item.catalogo_servico_id);
          const tarefasDoTemplate: TarefaServico[] = (catalogoItem?.tarefas_padrao ?? []).flatMap((g) =>
            g.tarefas.map((texto) => ({ id: novoId(), texto, feito: false, grupo: g.grupo }))
          );
          await onSave({
            cliente_id: clienteId,
            catalogo_servico_id: item.catalogo_servico_id,
            etapa: "novo_lead",
            status_execucao: "ativo",
            valor_proposta: item.valor_proposta,
            indicador_id: form.indicador_id ?? null,
            indicador_pct: form.indicador_id ? (form.indicador_pct ?? null) : null,
            responsavel_id: form.responsavel_id ?? null,
            anotacoes: form.anotacoes ?? null,
            template_id: catalogoItem?.template_padrao_id ?? null,
            proposta_id: propostaId,
            tarefas: tarefasDoTemplate,
            fase_execucao_id: catalogoItem?.fases_execucao[0]?.id ?? null,
          });
        }
      } else {
        await onSave({
          id: form.id,
          cliente_id: clienteId,
          catalogo_servico_id: form.catalogo_servico_id ?? null,
          etapa: form.etapa ?? "novo_lead",
          status_execucao: form.status_execucao ?? "ativo",
          valor_proposta: form.valor_proposta ?? null,
          indicador_id: form.indicador_id ?? null,
          indicador_pct: form.indicador_id ? (form.indicador_pct ?? null) : null,
          responsavel_id: form.responsavel_id ?? null,
          anotacoes: form.anotacoes ?? null,
        });
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar serviço.");
    } finally {
      setSaving(false);
    }
  }, [form, onSave, onClose, isNovo, catalogo]);

  const handleAvancar = useCallback(async () => {
    if (!servico?.id || !proximaEtapa) return;
    setSaving(true);
    try {
      await onAvancar(servico.id, proximaEtapa);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [servico, proximaEtapa, onAvancar, onClose]);

  const handleGerarRelatorio = useCallback(async () => {
    if (!servico) return;
    setGerandoRelatorio(true);
    try {
      const lancamentosServico = await getLancamentosPorServico((servicoFinanceiro ?? servico).id);
      const doc = gerarRelatorioServico(
        { empresaNome, usuarioNome, clienteNome: clienteAtual?.nome ?? "Cliente" },
        servico,
        lancamentosServico
      );
      await baixarPdf(doc, `servico-${clienteAtual?.nome ?? "cliente"}`);
    } catch {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGerandoRelatorio(false);
    }
  }, [servico, servicoFinanceiro, empresaNome, usuarioNome, clienteAtual]);

  const tabs: [Tab, string][] = isNovo
    ? [["editar", "Novo Serviço"]]
    : [
        ["geral", "Geral"],
        ["orcamento", "Orçamento"],
        ["tarefas", "Tarefas"],
        ["cronograma", "Cronograma"],
        ["financeiro", "Financeiro"],
        ["arquivos", "Arquivos"],
        ["historico", "Histórico"],
        ["editar", "Editar"],
      ];

  return (
    <>
      <Modal onClose={onClose} size="lg">
        <ModalHeader
          title={isNovo ? "Novo Serviço" : clienteAtual?.nome ?? "Serviço"}
          onClose={onClose}
          subtitle={
            etapaAtual ? (
              <span className="flex items-center gap-1.5">
                <Badge color={etapaAtual.cor}>{etapaAtual.label}</Badge>
                {servico?.status_execucao === "paralisado" && <Badge color="#F59E0B">Paralisado</Badge>}
                {servico?.status_execucao === "cancelado" && <Badge color="#EF4444">Cancelado</Badge>}
              </span>
            ) : undefined
          }
        />

        {!isNovo && servico && (
          <Timeline
            etapas={ETAPAS_SERVICO}
            etapaAtual={servico.etapa}
            log={servico.log ?? []}
            gradientColors={["#EC4899", "#8B5CF6"]}
          />
        )}

        <div className="border-b border-slate-100 px-5 flex gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`tab-btn ${tab === id ? "active" : ""}`}>{label}</button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto max-h-[52vh]">
          {tab === "geral" && servico && <GeralServico servico={servico} cliente={clienteAtual} outrosDaProposta={outrosDaProposta} />}
          {tab === "orcamento" && servico && <AbaOrcamentoServico servico={servico} />}
          {tab === "tarefas" && servico && (
            <AbaTarefasServico
              servico={{ ...servico, tarefas }}
              catalogoServico={catalogoDoServico}
              profiles={profiles}
              onUpdated={setTarefas}
              outrasDisciplinas={outrasDisciplinas}
            />
          )}
          {tab === "cronograma" && servico && (
            <AbaCronogramaServico
              servico={{ ...servico, tarefas }}
              catalogoServico={catalogoDoServico}
              onUpdated={setTarefas}
              outrasDisciplinas={outrasDisciplinas}
            />
          )}
          {tab === "financeiro" && servico && servicoFinanceiro && (
            <AbaFinanceiroServico
              servico={servicoFinanceiro}
              valorTotalProposta={[servico, ...outrosDaProposta].reduce((sum, s) => sum + (s.valor_proposta ?? 0), 0)}
              avisoConsolidado={
                outrosDaProposta.length > 0
                  ? `Financeiro da proposta inteira (${outrosDaProposta.length + 1} serviços) — os lançamentos aqui valem pra todos eles juntos.`
                  : undefined
              }
            />
          )}
          {tab === "arquivos" && servico && <AbaArquivosServico servicoId={servico.id} />}
          {tab === "historico" && servico && <AbaHistorico servicoId={servico.id} />}
          {tab === "editar" && (
            <FormServico
              servico={form}
              onChange={setForm}
              catalogo={catalogo}
              indicadores={indicadores}
              profiles={profiles}
              onAddIndicador={() => setModalIndicador(true)}
              clienteVinculado={clienteAtual}
              onEditarCliente={() => setModalCliente(true)}
            />
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5 flex justify-between items-center gap-3">
          <Button variant="secondary" onClick={onClose} size="sm">Fechar</Button>
          <div className="flex gap-2 flex-wrap justify-end">
            {!isNovo && (
              <Button variant="secondary" onClick={handleGerarRelatorio} loading={gerandoRelatorio} size="sm">
                📄 Gerar Relatório
              </Button>
            )}
            {tab === "editar" && (
              <Button variant="primary" onClick={handleSave} loading={saving} size="sm">
                {isNovo ? "Criar Serviço" : "Salvar Alterações"}
              </Button>
            )}
            {podeAvancar && tab === "geral" && (
              <Button variant="success" onClick={handleAvancar} loading={saving} size="sm">
                → {ETAPAS_SERVICO.find((e) => e.id === proximaEtapa)?.label ?? proximaEtapa}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {modalIndicador && (
        <ModalNovoIndicador
          indicadores={indicadores}
          onClose={() => setModalIndicador(false)}
          onSaved={(novo) => {
            setIndicadores((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
            setForm((f) => ({ ...f, indicador_id: novo.id }));
          }}
          onDeleted={(id) => {
            setIndicadores((prev) => prev.filter((i) => i.id !== id));
          }}
        />
      )}

      {modalCliente && clienteAtual && (
        <ModalCliente
          cliente={clienteAtual}
          onClose={() => setModalCliente(false)}
          onSave={async (data) => {
            await updateCliente(clienteAtual.id, data);
            setClienteAtual((c) => (c ? { ...c, ...data } : c));
          }}
        />
      )}
    </>
  );
}
