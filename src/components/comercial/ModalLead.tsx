"use client";
import { useState, useCallback, useEffect } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Timeline from "@/components/shared/Timeline";
import { ETAPAS_LEAD, FLUXO_LEAD } from "@/constants/etapas";
import {
  ORIGENS, ORIGENS_RECURSO, TIPOS_RENDA, MODALIDADES, CIDADES,
  LOCAIS_REUNIAO, MOTIVOS_REPROVACAO, COM_MURO_OPTIONS,
} from "@/constants/dominios";
import AbaDocumentos from "@/components/shared/AbaDocumentos";
import { fmtBRL, fmtDate, fmtDateTime, maskCPF, maskPhone, gerarLinkCalendar, validarCPF } from "@/lib/utils";
import { getCorrespondentes, createCorrespondente, deleteCorrespondente } from "@/services/correspondentes.service";
import { getCorretores, createCorretor, deleteCorretor } from "@/services/corretores.service";
import { getCidades, createCidade, deleteCidade } from "@/services/cidades.service";
import type { Lead, EtapaLead, Correspondente, Corretor, Cidade } from "@/types/app.types";
import toast from "react-hot-toast";

/* ───────── helpers ───────────────────────────────────────────────────────── */
type Tab = "perfil" | "docs" | "editar";
type SubModal =
  | "reuniao"
  | "analise"
  | "resultado"
  | "novoCorrespondente"
  | "novoCorretor"
  | "gerenciarCidades"
  | null;

const EMPTY_LEAD: Partial<Lead> = {
  nome: "", cpf: "", telefone: "", email: "", nascimento: "",
  cidade: "", origem: ORIGENS[0], tipo_renda: TIPOS_RENDA[0],
  modalidade: MODALIDADES[0], origem_recurso: null,
  renda_bruta: 0, valor_caixa: 0, valor_venda: 0, valor_subsidio: 0,
  valor_lote: 0, valor_financiamento: 0,
  dependente: false, fgts_3anos: false, com_conjuge: false,
  tamanho_imovel: "", com_muro: null,
};

/* ───────── helper: label do correspondente ──────────────────────────────── */
function corrLabel(c: Correspondente) {
  const ag = c.agencia || c.banco || "";
  return ag ? `${c.nome} — ${ag}` : c.nome;
}

/* ───────── ícone lixeira SVG ─────────────────────────────────────────────── */
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6.5v4M8.5 6.5v4M3 3.5l.667 7.5a.5.5 0 00.5.5h5.667a.5.5 0 00.5-.5L11 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ───────── sub-modal: Gerenciar Correspondentes ──────────────────────────── */
function ModalNovoCorrespondente({
  onClose, onSaved, onDeleted, cidades, correspondentes,
}: {
  onClose: () => void;
  onSaved: (c: Correspondente) => void;
  onDeleted: (id: string) => void;
  cidades: Cidade[];
  correspondentes: Correspondente[];
}) {
  const [form, setForm] = useState({ nome: "", contato: "", email: "", cidade: "", agencia: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const novo = await createCorrespondente({
        nome: form.nome,
        contato: form.contato || null,
        email: form.email || null,
        cidade: form.cidade || null,
        agencia: form.agencia || null,
      });
      toast.success("Correspondente cadastrado!");
      setForm({ nome: "", contato: "", email: "", cidade: "", agencia: "" });
      onSaved(novo);
    } catch {
      toast.error("Erro ao cadastrar correspondente");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCorrespondente(id);
      onDeleted(id);
    } catch {
      toast.error("Erro ao remover correspondente");
    } finally { setDeletingId(null); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Gerenciar Correspondentes" onClose={onClose} />
      <div className="p-5 space-y-4">
        {/* Lista existente */}
        <div>
          <p className="field-label mb-2">Cadastrados ({correspondentes.length})</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {correspondentes.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum correspondente cadastrado</p>
            )}
            {correspondentes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm text-slate-700">{c.nome}</span>
                  {(c.agencia || c.banco) && (
                    <span className="text-[11px] text-slate-400 ml-2">— {c.agencia || c.banco}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  title="Remover correspondente"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5 flex-shrink-0 ml-2"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Formulário de adição */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="field-label">Adicionar Novo</p>
          <div>
            <label className="field-label">Nome *</label>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className="input-base" placeholder="Ex: Genilza" />
          </div>
          <div>
            <label className="field-label">Agência / Banco</label>
            <input value={form.agencia} onChange={(e) => set("agencia", e.target.value)} className="input-base" placeholder="Ex: Agência Presidente Dutra" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Telefone</label>
              <input value={form.contato} onChange={(e) => set("contato", maskPhone(e.target.value))} maxLength={15} className="input-base" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-base" placeholder="email@banco.com" />
            </div>
          </div>
          <div>
            <label className="field-label">Cidade</label>
            <select value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className="input-base">
              <option value="">Selecione</option>
              {cidades.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>Cadastrar</Button>
        </div>

        <Button variant="secondary" className="w-full" onClick={onClose} size="sm">Fechar</Button>
      </div>
    </Modal>
  );
}

/* ───────── sub-modal: Gerenciar Corretores ──────────────────────────────── */
function ModalNovoCorretor({ onClose, onSaved, onDeleted, corretores }: {
  onClose: () => void;
  onSaved: (c: Corretor) => void;
  onDeleted: (id: string) => void;
  corretores: Corretor[];
}) {
  const [form, setForm] = useState({ nome: "", telefone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const novo = await createCorretor({
        nome: form.nome,
        telefone: form.telefone || null,
        email: form.email || null,
      });
      toast.success("Corretor cadastrado!");
      setForm({ nome: "", telefone: "", email: "" });
      onSaved(novo);
    } catch {
      toast.error("Erro ao cadastrar corretor");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCorretor(id);
      onDeleted(id);
    } catch {
      toast.error("Erro ao remover corretor");
    } finally { setDeletingId(null); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Gerenciar Corretores" onClose={onClose} />
      <div className="p-5 space-y-4">
        {/* Lista existente */}
        <div>
          <p className="field-label mb-2">Cadastrados ({corretores.length})</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {corretores.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum corretor cadastrado</p>
            )}
            {corretores.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm text-slate-700">{c.nome}</span>
                  {c.telefone && (
                    <span className="text-[11px] text-slate-400 ml-2">— {c.telefone}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  title="Remover corretor"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5 flex-shrink-0 ml-2"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Formulário de adição */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="field-label">Adicionar Novo</p>
          <div>
            <label className="field-label">Nome *</label>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className="input-base" placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Telefone</label>
              <input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} maxLength={15} className="input-base" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-base" placeholder="email@exemplo.com" />
            </div>
          </div>
          <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>Cadastrar</Button>
        </div>

        <Button variant="secondary" className="w-full" onClick={onClose} size="sm">Fechar</Button>
      </div>
    </Modal>
  );
}

/* ───────── sub-modal: Gerenciar Cidades ─────────────────────────────────── */
function ModalGerenciarCidades({
  cidades, onClose, onAdded, onDeleted,
}: {
  cidades: Cidade[];
  onClose: () => void;
  onAdded: (c: Cidade) => void;
  onDeleted: (id: string) => void;
}) {
  const [nova, setNova] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    const nome = nova.trim();
    if (!nome) { toast.error("Informe o nome da cidade"); return; }
    if (cidades.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Cidade já cadastrada"); return;
    }
    setAdding(true);
    try {
      const c = await createCidade(nome);
      toast.success(`${nome} adicionada!`);
      onAdded(c);
      setNova("");
    } catch {
      toast.error("Erro ao adicionar cidade");
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCidade(id);
      onDeleted(id);
    } catch {
      toast.error("Erro ao remover cidade");
    } finally { setDeletingId(null); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Gerenciar Cidades" onClose={onClose} />
      <div className="p-5 space-y-4">
        {/* Adicionar */}
        <div>
          <label className="field-label">Adicionar Cidade</label>
          <div className="flex gap-2">
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              className="input-base flex-1"
              placeholder="Nome da cidade"
            />
            <Button variant="primary" loading={adding} onClick={handleAdd} size="sm">
              Adicionar
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div>
          <p className="field-label mb-2">Cidades cadastradas ({cidades.length})</p>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {cidades.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-5">Nenhuma cidade cadastrada</p>
            )}
            {cidades.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span className="text-sm text-slate-700">{c.nome}</span>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  title="Remover cidade"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Button variant="secondary" className="w-full" onClick={onClose} size="sm">Fechar</Button>
      </div>
    </Modal>
  );
}

/* ───────── sub-modal: Agendar Reunião ────────────────────────────────────── */
function ModalAgendarReuniao({ onClose, onConfirm, nomeLead }: {
  onClose: () => void;
  onConfirm: (d: { data: string; local: string; hora: string }) => void;
  nomeLead: string;
}) {
  const [data, setData]   = useState("");
  const [hora, setHora]   = useState("10:00");
  const [local, setLocal] = useState(LOCAIS_REUNIAO[0]);
  const [obs, setObs]     = useState("");

  const fmtPrev = (d: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "";

  const calLink = data
    ? gerarLinkCalendar({ nomeCliente: nomeLead, data, hora, local, obs })
    : "";

  const handleConfirmar = () => {
    if (!data) { toast.error("Informe a data da reunião"); return; }
    if (calLink) window.open(calLink, "_blank");
    onConfirm({ data, hora, local });
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Agendar Reunião" onClose={onClose} />
      <div className="p-5 space-y-3">
        <p className="text-sm text-slate-600">Cliente: <strong>{nomeLead}</strong></p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Data *</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="field-label">Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input-base" />
          </div>
        </div>

        <div>
          <label className="field-label">Local</label>
          <select value={local} onChange={(e) => setLocal(e.target.value)} className="input-base">
            {LOCAIS_REUNIAO.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">Observações (opcional)</label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
            className="input-base resize-none"
            placeholder="Notas sobre a reunião, documentos a trazer..."
          />
        </div>

        {/* Preview */}
        {data && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
              Preview do agendamento
            </p>
            <p className="text-sm font-bold text-slate-800">Reunião com {nomeLead}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>📅</span>
              <span>{fmtPrev(data)} às {hora}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>📍</span>
              <span>{local}</span>
            </div>
            {obs && (
              <p className="text-xs text-slate-500 italic border-t border-blue-100 pt-1.5 mt-1">{obs}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirmar}>
            📅 Confirmar e Abrir Google Agenda
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── sub-modal: Enviar para Análise de Crédito ────────────────────── */
function ModalAnalise({ onClose, onConfirm, nomeLead, correspondentes }: {
  onClose: () => void;
  onConfirm: (d: { correspondente_id: string | null; pls: string; obs: string }) => void;
  nomeLead: string;
  correspondentes: Correspondente[];
}) {
  const [corrId, setCorrId] = useState<string>("");
  const [pls, setPls]       = useState("");
  const [obs, setObs]       = useState("");

  const corrSelecionado = correspondentes.find((c) => c.id === corrId);

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Enviar para Análise de Crédito" onClose={onClose} />
      <div className="p-5 space-y-3">
        <p className="text-sm text-slate-600">Cliente: <strong>{nomeLead}</strong></p>

        <div>
          <label className="field-label">Correspondente Bancário</label>
          <select value={corrId} onChange={(e) => setCorrId(e.target.value)} className="input-base">
            <option value="">Selecione o correspondente</option>
            {correspondentes.map((c) => (
              <option key={c.id} value={c.id}>{corrLabel(c)}</option>
            ))}
          </select>
          {corrSelecionado && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {corrSelecionado.contato ?? corrSelecionado.banco ?? ""}
            </p>
          )}
        </div>

        <div>
          <label className="field-label">PLS / Protocolo</label>
          <input value={pls} onChange={(e) => setPls(e.target.value)} className="input-base" placeholder="Nº do protocolo" />
        </div>

        <div>
          <label className="field-label">Observações</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="input-base resize-none" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => onConfirm({ correspondente_id: corrId || null, pls, obs })}
          >
            Enviar para Análise
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────── sub-modal: Resultado da Análise (bifurcação) ─────────────────── */
function ModalResultado({ onClose, onAprovar, onReprovar, nomeLead }: {
  onClose: () => void;
  onAprovar: (obs: string) => void;
  onReprovar: (motivo: string) => void;
  nomeLead: string;
}) {
  const [resultado, setResultado] = useState<"aprovada" | "reprovada" | "">("");
  const [motivo, setMotivo]       = useState(MOTIVOS_REPROVACAO[0]);
  const [obs, setObs]             = useState("");

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Resultado da Análise de Crédito" onClose={onClose} />
      <div className="p-5 space-y-3">
        <p className="text-sm text-slate-600">Cliente: <strong>{nomeLead}</strong></p>
        <div className="flex gap-2">
          <button
            onClick={() => setResultado("aprovada")}
            className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${resultado === "aprovada" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:border-emerald-300"}`}
          >
            ✅ Aprovada
          </button>
          <button
            onClick={() => setResultado("reprovada")}
            className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-colors ${resultado === "reprovada" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-500 hover:border-red-300"}`}
          >
            ❌ Reprovada
          </button>
        </div>
        {resultado === "reprovada" && (
          <div>
            <label className="field-label">Motivo da Reprovação</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input-base">
              {MOTIVOS_REPROVACAO.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        )}
        {resultado === "aprovada" && (
          <div>
            <label className="field-label">Observações do Crédito Aprovado</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="input-base resize-none"
              placeholder="Valor aprovado, taxa, prazo..." />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            variant={resultado === "aprovada" ? "success" : "danger"}
            className="flex-1"
            disabled={!resultado}
            onClick={() => {
              if (!resultado) { toast.error("Selecione o resultado"); return; }
              if (resultado === "aprovada") onAprovar(obs);
              else onReprovar(motivo);
            }}
          >
            Confirmar Resultado
          </Button>
        </div>
      </div>
    </Modal>
  );
}


/* ───────── formulário de edição com todos os campos ─────────────────────── */
function FormLead({
  lead, onChange, correspondentes, corretores, cidades,
  onAddCorrespondente, onAddCorretor, onGerenciarCidades,
}: {
  lead: Partial<Lead>;
  onChange: (d: Partial<Lead>) => void;
  correspondentes: Correspondente[];
  corretores: Corretor[];
  cidades: Cidade[];
  onAddCorrespondente: () => void;
  onAddCorretor: () => void;
  onGerenciarCidades: () => void;
}) {
  const set = (k: keyof Lead, v: unknown) => onChange({ ...lead, [k]: v });
  const num = (k: keyof Lead, v: string) => set(k, Number(v.replace(/\D/g, "")) || 0);

  return (
    <div className="space-y-5">
      {/* Dados Pessoais */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Dados Pessoais</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="field-label">Nome Completo *</label>
            <input value={lead.nome ?? ""} onChange={(e) => set("nome", e.target.value)}
              className="input-base" placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="field-label">CPF</label>
            <input
              value={lead.cpf ?? ""}
              onChange={(e) => set("cpf", maskCPF(e.target.value))}
              maxLength={14}
              className={`input-base ${lead.cpf && !validarCPF(lead.cpf) ? "border-red-300" : ""}`}
              placeholder="000.000.000-00"
            />
            {lead.cpf && !validarCPF(lead.cpf) && <p className="text-[10px] text-red-500 mt-0.5">CPF inválido</p>}
          </div>
          <div>
            <label className="field-label">Data de Nascimento</label>
            <input type="date" value={lead.nascimento ?? ""} onChange={(e) => set("nascimento", e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="field-label">E-mail</label>
            <input type="email" value={lead.email ?? ""} onChange={(e) => set("email", e.target.value)}
              className="input-base" placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="field-label">Telefone</label>
            <input value={lead.telefone ?? ""} onChange={(e) => set("telefone", maskPhone(e.target.value))}
              maxLength={15} className="input-base" placeholder="(00) 00000-0000" />
          </div>
          <div className="col-span-2">
            <label className="field-label">Cidade</label>
            <div className="flex gap-1.5">
              <select
                value={lead.cidade ?? ""}
                onChange={(e) => set("cidade", e.target.value)}
                className="input-base flex-1"
              >
                <option value="">Selecione</option>
                {cidades.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <button
                type="button"
                onClick={onGerenciarCidades}
                title="Gerenciar cidades (adicionar / remover)"
                className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-500 flex items-center justify-center text-lg font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Origem */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Origem</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Canal de Origem</label>
            <select value={lead.origem ?? ""} onChange={(e) => set("origem", e.target.value)} className="input-base">
              {ORIGENS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          {lead.origem === "Corretor" && (
            <div>
              <label className="field-label">Corretor</label>
              <div className="flex gap-1.5">
                <select
                  value={lead.corretor_id ?? ""}
                  onChange={(e) => {
                    const sel = corretores.find((c) => c.id === e.target.value);
                    set("corretor_id", e.target.value || null);
                    set("corretor", sel?.nome ?? null);
                  }}
                  className="input-base flex-1"
                >
                  <option value="">Selecionar corretor</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.telefone ? ` — ${c.telefone}` : ""}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onAddCorretor}
                  title="Cadastrar novo corretor"
                  className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-500 flex items-center justify-center text-lg font-bold transition-colors"
                >+</button>
              </div>
              {lead.corretor && (
                <p className="text-[10px] text-slate-400 mt-0.5">{lead.corretor}</p>
              )}
            </div>
          )}
          {lead.origem === "Indicação" && (
            <div>
              <label className="field-label">Indicado por</label>
              <input value={lead.indicado_por ?? ""} onChange={(e) => set("indicado_por", e.target.value)}
                className="input-base" placeholder="Nome de quem indicou" />
            </div>
          )}
        </div>
      </div>

      {/* Imóvel */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Imóvel</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Tamanho do Imóvel (m²)</label>
            <input value={lead.tamanho_imovel ?? ""} onChange={(e) => set("tamanho_imovel", e.target.value)}
              className="input-base" placeholder="Ex: 65m², 80m², 41 x 20m" />
          </div>
          <div>
            <label className="field-label">Muro</label>
            <select value={lead.com_muro ?? ""} onChange={(e) => set("com_muro", e.target.value || null)} className="input-base">
              <option value="">Não informado</option>
              {COM_MURO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Modalidade</label>
            <select value={lead.modalidade ?? ""} onChange={(e) => set("modalidade", e.target.value)} className="input-base">
              {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Correspondente e Recurso */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Correspondente e Recurso</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Correspondente Bancário</label>
            <div className="flex gap-1.5">
              <select
                value={lead.correspondente_id ?? ""}
                onChange={(e) => set("correspondente_id", e.target.value || null)}
                className="input-base flex-1"
              >
                <option value="">Selecionar correspondente</option>
                {correspondentes.map((c) => (
                  <option key={c.id} value={c.id}>{corrLabel(c)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAddCorrespondente}
                title="Cadastrar novo correspondente"
                className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-500 flex items-center justify-center text-lg font-bold transition-colors"
              >+</button>
            </div>
          </div>
          <div>
            <label className="field-label">Origem do Recurso</label>
            <select value={lead.origem_recurso ?? ""} onChange={(e) => set("origem_recurso", e.target.value || null)} className="input-base">
              <option value="">Selecionar</option>
              {ORIGENS_RECURSO.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Financeiro */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Financeiro</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Tipo de Renda</label>
            <select value={lead.tipo_renda ?? ""} onChange={(e) => set("tipo_renda", e.target.value)} className="input-base">
              {TIPOS_RENDA.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Renda Bruta (R$)</label>
            <input value={lead.renda_bruta || ""} onChange={(e) => num("renda_bruta", e.target.value)}
              className="input-base" placeholder="Ex: 3500" type="text" inputMode="numeric" />
          </div>
          <div>
            <label className="field-label">Valor do Terreno (R$)</label>
            <input value={lead.valor_lote || ""} onChange={(e) => num("valor_lote", e.target.value)}
              className="input-base" placeholder="Ex: 40000" type="text" inputMode="numeric" />
          </div>
          <div>
            <label className="field-label">Valor Caixa (R$)</label>
            <input value={lead.valor_caixa || ""} onChange={(e) => num("valor_caixa", e.target.value)}
              className="input-base" placeholder="Ex: 120000" type="text" inputMode="numeric" />
          </div>
          <div>
            <label className="field-label">Valor Financiado (R$)</label>
            <input value={lead.valor_financiamento || ""} onChange={(e) => num("valor_financiamento", e.target.value)}
              className="input-base" placeholder="Ex: 110000" type="text" inputMode="numeric" />
          </div>
          <div>
            <label className="field-label">Subsídio (R$)</label>
            <input value={lead.valor_subsidio || ""} onChange={(e) => num("valor_subsidio", e.target.value)}
              className="input-base" placeholder="Ex: 30000" type="text" inputMode="numeric" />
          </div>
          <div>
            <label className="field-label">Valor Total de Venda (R$)</label>
            <input value={lead.valor_venda || ""} onChange={(e) => num("valor_venda", e.target.value)}
              className="input-base" placeholder="Ex: 150000" type="text" inputMode="numeric" />
          </div>
        </div>
      </div>

      {/* Extras */}
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Configurações</p>
        <div className="flex gap-5 flex-wrap mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!lead.com_conjuge} onChange={(e) => set("com_conjuge", e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-slate-700">Possui cônjuge</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!lead.dependente} onChange={(e) => set("dependente", e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-slate-700">Possui dependente</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!lead.fgts_3anos} onChange={(e) => set("fgts_3anos", e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-slate-700">FGTS 3+ anos</span>
          </label>
        </div>
        <div>
          <label className="field-label">Observações</label>
          <textarea value={lead.obs ?? ""} onChange={(e) => set("obs", e.target.value)}
            rows={3} className="input-base resize-none" placeholder="Anotações sobre o cliente..." />
        </div>
      </div>
    </div>
  );
}

/* ───────── aba Perfil ────────────────────────────────────────────────────── */
function PerfilLead({ lead }: { lead: Lead }) {
  const comMuroLabel = COM_MURO_OPTIONS.find((o) => o.value === lead.com_muro)?.label;

  return (
    <div className="space-y-4">
      {/* Cards financeiros */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: "Renda Bruta",       valor: fmtBRL(lead.renda_bruta),         cor: "text-slate-900" },
          { label: "Valor Caixa",       valor: fmtBRL(lead.valor_caixa),         cor: "text-blue-500" },
          { label: "Valor de Venda",    valor: fmtBRL(lead.valor_venda),         cor: "text-emerald-600 font-extrabold" },
          { label: "Subsídio",          valor: fmtBRL(lead.valor_subsidio),      cor: "text-purple-500" },
          { label: "Terreno",           valor: fmtBRL(lead.valor_lote),          cor: "text-amber-500" },
          { label: "Valor Financiado",  valor: fmtBRL(lead.valor_financiamento), cor: "text-cyan-500" },
        ].map((f) => (
          <div key={f.label} className="card p-3 text-center">
            <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{f.label}</p>
            <p className={`text-[13px] font-bold ${f.cor}`}>{f.valor}</p>
          </div>
        ))}
      </div>

      {/* Dados */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
        {[
          ["CPF",               lead.cpf],
          ["Nascimento",        lead.nascimento ? fmtDate(lead.nascimento) : null],
          ["E-mail",            lead.email],
          ["Telefone",          lead.telefone],
          ["Cidade",            lead.cidade],
          ["Origem",            lead.origem],
          ["Corretor",          lead.corretor],
          ["Indicado por",      lead.indicado_por],
          ["Tipo de Renda",     lead.tipo_renda],
          ["Modalidade",        lead.modalidade],
          ["Origem do Recurso", lead.origem_recurso],
          ["Tamanho do Imóvel", lead.tamanho_imovel],
          ["Muro",              comMuroLabel],
          ["Data de Contato",   fmtDate(lead.data_contato)],
          [
            "Reunião",
            lead.data_reuniao
              ? `${fmtDate(lead.data_reuniao)}${lead.local_reuniao ? ` — ${lead.local_reuniao}` : ""}`
              : null,
          ],
          ["Responsável",     lead.responsavel?.nome],
          ["Correspondente",  lead.correspondente ? corrLabel(lead.correspondente) : null],
        ]
          .filter(([, v]) => !!v)
          .map(([k, v]) => (
            <div key={k as string} className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">{k}</span>
              <span className="font-semibold text-slate-900 text-right max-w-[55%]">{v}</span>
            </div>
          ))}
        {lead.com_conjuge  && <div className="flex items-center gap-1.5 py-1 text-blue-500 font-semibold text-xs">👫 Com cônjuge</div>}
        {lead.dependente   && <div className="flex items-center gap-1.5 py-1 text-yellow-600 font-semibold text-xs">👶 Com dependente</div>}
        {lead.fgts_3anos   && <div className="flex items-center gap-1.5 py-1 text-emerald-600 font-semibold text-xs">✅ FGTS 3+ anos</div>}
        {lead.enviado_para_obras && (
          <div className="flex items-center gap-1.5 py-1 text-green-600 font-semibold text-xs col-span-2">
            🏗 Enviado para Obras {lead.data_envio_obras ? `em ${fmtDateTime(lead.data_envio_obras)}` : ""}
          </div>
        )}
      </div>

      {lead.obs && (
        <div className="bg-slate-50 rounded-xl p-3.5">
          <p className="text-[11px] font-bold text-slate-500 mb-1">Observações</p>
          <p className="text-xs text-slate-700 leading-relaxed">{lead.obs}</p>
        </div>
      )}
    </div>
  );
}

/* ───────── main ModalLead ────────────────────────────────────────────────── */
interface Props {
  lead: Lead | null;
  onClose: () => void;
  onSave: (data: Partial<Lead>) => Promise<void>;
  onAvancar: (leadId: string, novaEtapa: EtapaLead, payload?: Record<string, unknown>) => Promise<void>;
  onEnviarObras?: (leadId: string) => Promise<void>;
}

export default function ModalLead({ lead, onClose, onSave, onAvancar, onEnviarObras }: Props) {
  const isNovo = !lead;

  const [tab, setTab]           = useState<Tab>(isNovo ? "editar" : "perfil");
  const [form, setForm]         = useState<Partial<Lead>>(lead ?? EMPTY_LEAD);
  const [saving, setSaving]     = useState(false);
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [correspondentes, setCorrespondentes] = useState<Correspondente[]>([]);
  const [corretores, setCorretores]           = useState<Corretor[]>([]);
  const [cidades, setCidades]                 = useState<Cidade[]>([]);

  useEffect(() => {
    getCorrespondentes().then(setCorrespondentes).catch(() => {});
    getCorretores().then(setCorretores).catch(() => {});
    getCidades()
      .then(setCidades)
      .catch(() => {
        // fallback para lista estática enquanto migration não foi executada
        setCidades(CIDADES.map((nome, i) => ({ id: String(i), nome, ativo: true })));
      });
  }, []);

  const etapaAtual   = ETAPAS_LEAD.find((e) => e.id === (lead?.etapa ?? form.etapa));
  const idxAtual     = FLUXO_LEAD.indexOf(form.etapa ?? "leads");
  const proximaEtapa = idxAtual !== -1 && idxAtual < FLUXO_LEAD.length - 1
    ? FLUXO_LEAD[idxAtual + 1] as EtapaLead
    : null;
  const podeAvancar  = !isNovo && proximaEtapa !== null && form.etapa !== "reprovada";

  const handleSave = useCallback(async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  }, [form, onSave]);

  const handleAvancar = useCallback(async (etapaAlvo: EtapaLead, payload?: Record<string, unknown>) => {
    if (!lead?.id) return;
    setSaving(true);
    try {
      await onAvancar(lead.id, etapaAlvo, payload);
      onClose();
    } finally {
      setSaving(false);
      setSubModal(null);
    }
  }, [lead, onAvancar, onClose]);

  const btnAvancar = () => {
    if (!proximaEtapa) return;
    if (proximaEtapa === "reuniao")  { setSubModal("reuniao");  return; }
    if (proximaEtapa === "analise")  { setSubModal("analise");  return; }
    if (form.etapa === "analise")    { setSubModal("resultado"); return; }
    handleAvancar(proximaEtapa);
  };

  const tabs: [Tab, string][] = isNovo
    ? [["editar", "Dados do Lead"]]
    : [["perfil", "Perfil"], ["docs", "Documentos"], ["editar", "Editar"]];

  return (
    <>
      <Modal onClose={onClose} size="lg">
        <ModalHeader
          title={isNovo ? "Novo Lead" : form.nome ?? "Lead"}
          onClose={onClose}
          subtitle={etapaAtual ? <Badge color={etapaAtual.cor}>{etapaAtual.label}</Badge> : undefined}
        />

        {/* ── Timeline no TOPO ── */}
        {!isNovo && lead && (
          <Timeline
            etapas={ETAPAS_LEAD}
            etapaAtual={lead.etapa}
            log={lead.log ?? []}
            gradientColors={["#3B82F6", "#8B5CF6"]}
          />
        )}

        {/* Tabs */}
        <div className="border-b border-slate-100 px-5 flex gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`tab-btn ${tab === id ? "active" : ""}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto max-h-[52vh]">
          {tab === "perfil" && lead && <PerfilLead lead={lead} />}
          {tab === "docs" && lead && (
            <AbaDocumentos
              leadId={lead.id}
              comConjuge={lead.com_conjuge}
              dependente={lead.dependente}
              tipoRenda={lead.tipo_renda}
              fgts3anos={lead.fgts_3anos}
            />
          )}
          {tab === "editar" && (
            <FormLead
              lead={form}
              onChange={setForm}
              correspondentes={correspondentes}
              corretores={corretores}
              cidades={cidades}
              onAddCorrespondente={() => setSubModal("novoCorrespondente")}
              onAddCorretor={() => setSubModal("novoCorretor")}
              onGerenciarCidades={() => setSubModal("gerenciarCidades")}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3.5 flex justify-between items-center gap-3">
          <Button variant="secondary" onClick={onClose} size="sm">Fechar</Button>
          <div className="flex gap-2 flex-wrap justify-end">
            {tab === "editar" && (
              <Button variant="primary" onClick={handleSave} loading={saving} size="sm">
                {isNovo ? "Criar Lead" : "Salvar Alterações"}
              </Button>
            )}
            {podeAvancar && tab === "perfil" && form.etapa !== "analise" && proximaEtapa && (
              <Button variant="success" onClick={btnAvancar} loading={saving} size="sm">
                → {ETAPAS_LEAD.find((e) => e.id === proximaEtapa)?.label ?? proximaEtapa}
              </Button>
            )}
            {tab === "perfil" && form.etapa === "analise" && (
              <Button variant="primary" onClick={() => setSubModal("resultado")} loading={saving} size="sm">
                Informar Resultado
              </Button>
            )}
            {!isNovo && lead?.etapa === "aprovada" && !lead.enviado_para_obras && tab === "perfil" && (
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={async () => {
                  if (!lead?.id) return;
                  setSaving(true);
                  try {
                    if (onEnviarObras) await onEnviarObras(lead.id);
                    onClose();
                  } finally { setSaving(false); }
                }}
              >
                🏗 Enviar para Obras
              </Button>
            )}
            {!isNovo && lead?.etapa === "aprovada" && lead.enviado_para_obras && tab === "perfil" && (
              <Badge color="#10B981">✓ Enviado para Obras</Badge>
            )}
          </div>
        </div>
      </Modal>

      {/* Sub-modais */}
      {subModal === "reuniao" && (
        <ModalAgendarReuniao
          nomeLead={form.nome ?? ""}
          onClose={() => setSubModal(null)}
          onConfirm={(d) => handleAvancar("reuniao", {
            data_reuniao:  d.data,
            local_reuniao: d.local,
          })}
        />
      )}
      {subModal === "analise" && (
        <ModalAnalise
          nomeLead={form.nome ?? ""}
          onClose={() => setSubModal(null)}
          correspondentes={correspondentes}
          onConfirm={(d) => handleAvancar("analise", {
            correspondente_id: d.correspondente_id,
            pls: d.pls,
            obs: d.obs,
          })}
        />
      )}
      {subModal === "resultado" && (
        <ModalResultado
          nomeLead={form.nome ?? ""}
          onClose={() => setSubModal(null)}
          onAprovar={(obsAprov) => handleAvancar("aprovada",  { obs: obsAprov })}
          onReprovar={(motivo)  => handleAvancar("reprovada", { motivo_reprovacao: motivo })}
        />
      )}
      {subModal === "novoCorrespondente" && (
        <ModalNovoCorrespondente
          cidades={cidades}
          correspondentes={correspondentes}
          onClose={() => setSubModal(null)}
          onSaved={(novo) => {
            setCorrespondentes((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
            setForm((f) => ({ ...f, correspondente_id: novo.id }));
          }}
          onDeleted={(id) => {
            setCorrespondentes((prev) => prev.filter((c) => c.id !== id));
          }}
        />
      )}
      {subModal === "novoCorretor" && (
        <ModalNovoCorretor
          corretores={corretores}
          onClose={() => setSubModal(null)}
          onSaved={(novo) => {
            setCorretores((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
            setForm((f) => ({ ...f, corretor_id: novo.id, corretor: novo.nome }));
          }}
          onDeleted={(id) => {
            setCorretores((prev) => prev.filter((c) => c.id !== id));
          }}
        />
      )}
      {subModal === "gerenciarCidades" && (
        <ModalGerenciarCidades
          cidades={cidades}
          onClose={() => setSubModal(null)}
          onAdded={(nova) => {
            setCidades((prev) => [...prev, nova].sort((a, b) => a.nome.localeCompare(b.nome)));
          }}
          onDeleted={(id) => {
            setCidades((prev) => prev.filter((c) => c.id !== id));
          }}
        />
      )}
    </>
  );
}
