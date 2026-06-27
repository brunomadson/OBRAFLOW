"use client";
import { useState, useCallback } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Timeline from "@/components/shared/Timeline";
import StatusBadgeMedicao from "@/components/shared/StatusBadgeMedicao";
import ChecklistDocumentosObra from "./ChecklistDocumentosObra";
import ModalMedicao from "./ModalMedicao";
import { ETAPAS_OBRA, FLUXO_OBRA } from "@/constants/etapas";
import { CIDADES, ENGENHEIROS, MODALIDADES } from "@/constants/dominios";
import { fmtBRL, fmtDate, maskCPF, maskPhone } from "@/lib/utils";
import type { Obra, Medicao } from "@/types/app.types";
import toast from "react-hot-toast";

type Tab = "perfil" | "medicoes" | "docs" | "editar";

const EMPTY_OBRA: Partial<Obra> = {
  cliente: "", cpf: "", telefone: "", cidade: "", modalidade: MODALIDADES[0],
  engenheiro: ENGENHEIROS[0] ?? "", renda_bruta: 0, valor_caixa: 0, valor_venda: 0, valor_subsidio: 0,
};

interface Props {
  obra: Obra | null;
  onClose: () => void;
  onSave: (data: Partial<Obra>) => Promise<void>;
  onAvancar: (id: string, etapaAtual: string) => Promise<void>;
  onSalvarMedicao: (obraId: string, data: Partial<Medicao>) => Promise<void>;
  onRemoverMedicao: (obraId: string, medicaoId: string) => Promise<void>;
}

export default function ModalObra({ obra, onClose, onSave, onAvancar, onSalvarMedicao, onRemoverMedicao }: Props) {
  const isNovo   = !obra;
  const [tab, setTab]     = useState<Tab>(isNovo ? "editar" : "perfil");
  const [form, setForm]   = useState<Partial<Obra>>(obra ?? EMPTY_OBRA);
  const [saving, setSaving] = useState(false);
  const [editMedicao, setEditMedicao] = useState<{ medicao: Partial<Medicao> | null } | null>(null);

  const etapaAtual = ETAPAS_OBRA.find((e) => e.id === form.etapa);
  const prox       = FLUXO_OBRA.indexOf(form.etapa ?? "contrato");
  const podeAvancar = !isNovo && prox !== -1 && prox < FLUXO_OBRA.length - 1;
  const proximaEtapa = podeAvancar ? ETAPAS_OBRA.find((e) => e.id === FLUXO_OBRA[prox + 1]) : null;

  const set = (k: keyof Obra, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = useCallback(async () => {
    if (!form.cliente?.trim()) { toast.error("Informe o nome do cliente"); return; }
    setSaving(true);
    try { await onSave(form); toast.success(isNovo ? "Obra criada!" : "Obra atualizada!"); onClose(); }
    finally { setSaving(false); }
  }, [form, isNovo, onSave, onClose]);

  const handleAvancar = useCallback(async () => {
    if (!obra?.id) return;
    setSaving(true);
    try { await onAvancar(obra.id, obra.etapa); toast.success("Etapa avançada!"); onClose(); }
    finally { setSaving(false); }
  }, [obra, onAvancar, onClose]);

  const tabs: [Tab, string][] = isNovo
    ? [["editar", "Dados"]]
    : [["perfil", "Perfil"], ["medicoes", "Medições"], ["docs", "Docs"], ["editar", "Editar"]];

  const medicoes = obra?.medicoes ?? [];

  return (
    <>
      <Modal onClose={onClose} size="lg">
        <ModalHeader
          title={isNovo ? "Nova Obra" : form.cliente ?? "Obra"}
          onClose={onClose}
          subtitle={etapaAtual ? <Badge color={etapaAtual.cor}>{etapaAtual.label}</Badge> : undefined}
        />
        <div className="border-b border-slate-100 px-5 flex gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`tab-btn ${tab === id ? "active" : ""}`}>{label}</button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto max-h-[65vh]">
          {/* Perfil */}
          {tab === "perfil" && obra && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Valor Caixa",   valor: fmtBRL(obra.valor_caixa),    cor: "text-blue-500" },
                  { label: "Valor de Venda", valor: fmtBRL(obra.valor_venda),   cor: "text-emerald-600 font-extrabold" },
                  { label: "Subsídio",       valor: fmtBRL(obra.valor_subsidio), cor: "text-purple-500" },
                  { label: "Renda Bruta",    valor: fmtBRL(obra.renda_bruta),    cor: "text-slate-900" },
                ].map((f) => (
                  <div key={f.label} className="card p-3.5 text-center">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{f.label}</p>
                    <p className={`text-[15px] font-bold ${f.cor}`}>{f.valor}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
                {[
                  ["CPF", obra.cpf], ["Telefone", obra.telefone], ["Cidade", obra.cidade],
                  ["Modalidade", obra.modalidade], ["Engenheiro", obra.engenheiro],
                  ["PLS", obra.pls], ["Prazo Conclusão", fmtDate(obra.prazo_conclusao)],
                  ["Data Início", fmtDate(obra.data_inicio)],
                ].filter(([, v]) => !!v).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-slate-50">
                    <span className="text-slate-400">{k}</span>
                    <span className="font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
              </div>
              {obra.obs && (
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">Observações</p>
                  <p className="text-sm text-slate-700">{obra.obs}</p>
                </div>
              )}
              <Timeline
                etapas={ETAPAS_OBRA}
                etapaAtual={obra.etapa}
                log={obra.log ?? []}
                gradientColors={["#10B981", "#3B82F6"]}
              />
            </div>
          )}

          {/* Medições */}
          {tab === "medicoes" && obra && (
            <div>
              <div className="flex justify-between mb-3">
                <p className="text-[13px] font-bold text-slate-700">Medições ({medicoes.length})</p>
                <Button variant="primary" size="sm" onClick={() => setEditMedicao({ medicao: null })}>+ Medição</Button>
              </div>
              {medicoes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Nenhuma medição cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {medicoes.map((m, i) => (
                    <div
                      key={m.id ?? i}
                      onClick={() => setEditMedicao({ medicao: m })}
                      className="card p-3.5 flex justify-between items-center cursor-pointer hover:shadow-card-hover"
                    >
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900">{m.numero_medicao}ª Medição</p>
                        <p className="text-[11px] text-slate-400">{fmtDate(m.data_vencimento)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-600 text-[13px]">{fmtBRL(m.valor)}</span>
                        <StatusBadgeMedicao status={m.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documentos */}
          {tab === "docs" && <ChecklistDocumentosObra />}

          {/* Editar */}
          {tab === "editar" && (
            <div className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2">
                <label className="field-label">Nome do Cliente *</label>
                <input value={form.cliente ?? ""} onChange={(e) => set("cliente", e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="field-label">CPF</label>
                <input value={form.cpf ?? ""} onChange={(e) => set("cpf", maskCPF(e.target.value))} maxLength={14} className="input-base" />
              </div>
              <div>
                <label className="field-label">Telefone</label>
                <input value={form.telefone ?? ""} onChange={(e) => set("telefone", maskPhone(e.target.value))} maxLength={15} className="input-base" />
              </div>
              <div>
                <label className="field-label">Cidade</label>
                <select value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} className="input-base">
                  <option value="">Selecione</option>
                  {CIDADES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Modalidade</label>
                <select value={form.modalidade ?? ""} onChange={(e) => set("modalidade", e.target.value)} className="input-base">
                  {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Engenheiro</label>
                <select value={form.engenheiro ?? ""} onChange={(e) => set("engenheiro", e.target.value)} className="input-base">
                  {ENGENHEIROS.map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">PLS</label>
                <input value={form.pls ?? ""} onChange={(e) => set("pls", e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="field-label">Renda Bruta</label>
                <input type="number" min={0} value={form.renda_bruta ?? ""} onChange={(e) => set("renda_bruta", Number(e.target.value))} className="input-base" />
              </div>
              <div>
                <label className="field-label">Valor Caixa</label>
                <input type="number" min={0} value={form.valor_caixa ?? ""} onChange={(e) => set("valor_caixa", Number(e.target.value))} className="input-base" />
              </div>
              <div>
                <label className="field-label">Valor de Venda</label>
                <input type="number" min={0} value={form.valor_venda ?? ""} onChange={(e) => set("valor_venda", Number(e.target.value))} className="input-base" />
              </div>
              <div>
                <label className="field-label">Subsídio</label>
                <input type="number" min={0} value={form.valor_subsidio ?? ""} onChange={(e) => set("valor_subsidio", Number(e.target.value))} className="input-base" />
              </div>
              <div>
                <label className="field-label">Data Início</label>
                <input type="date" value={form.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="field-label">Prazo de Conclusão</label>
                <input type="date" value={form.prazo_conclusao ?? ""} onChange={(e) => set("prazo_conclusao", e.target.value)} className="input-base" />
              </div>
              <div className="col-span-2">
                <label className="field-label">Observações</label>
                <textarea value={form.obs ?? ""} onChange={(e) => set("obs", e.target.value)} rows={3} className="input-base resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5 flex justify-between items-center gap-3">
          <Button variant="secondary" onClick={onClose} size="sm">Fechar</Button>
          <div className="flex gap-2">
            {tab === "editar" && (
              <Button variant="primary" onClick={handleSave} loading={saving} size="sm">
                {isNovo ? "Criar Obra" : "Salvar"}
              </Button>
            )}
            {podeAvancar && tab === "perfil" && proximaEtapa && (
              <Button variant="success" onClick={handleAvancar} loading={saving} size="sm">
                → {proximaEtapa.label}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {editMedicao !== null && obra && (
        <ModalMedicao
          obraId={obra.id}
          obraCliente={obra.cliente}
          medicao={editMedicao.medicao}
          onClose={() => setEditMedicao(null)}
          onSave={onSalvarMedicao}
          onDelete={editMedicao.medicao?.id ? onRemoverMedicao : undefined}
        />
      )}
    </>
  );
}
