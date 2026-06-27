"use client";
import { useState } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { STATUS_MEDICAO_LABEL } from "@/constants/dominios";
import type { Medicao, StatusMedicao } from "@/types/app.types";
import toast from "react-hot-toast";

const STATUS_OPTS: StatusMedicao[] = ["pendente", "enviada", "pago"];

interface Props {
  obraId: string;
  obraCliente: string;
  medicao: Partial<Medicao> | null;
  onClose: () => void;
  onSave: (obraId: string, data: Partial<Medicao>) => Promise<void>;
  onDelete?: (obraId: string, medicaoId: string) => Promise<void>;
}

export default function ModalMedicao({ obraId, obraCliente, medicao, onClose, onSave, onDelete }: Props) {
  const isNew = !medicao?.id;
  const [form, setForm]   = useState<Partial<Medicao>>(medicao ?? { numero_medicao: 1, status: "pendente" });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Medicao, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.numero_medicao) { toast.error("Informe o número da medição"); return; }
    if (!form.valor || Number(form.valor) <= 0) { toast.error("Informe o valor"); return; }
    setSaving(true);
    try { await onSave(obraId, form); toast.success("Medição salva!"); onClose(); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!medicao?.id || !onDelete) return;
    if (!confirm("Excluir esta medição?")) return;
    setSaving(true);
    try { await onDelete(obraId, medicao.id); toast.success("Medição removida."); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={isNew ? "Nova Medição" : `Medição #${form.numero_medicao}`} onClose={onClose} subtitle={<span className="text-xs text-slate-400">{obraCliente}</span>} />
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Nº da Medição</label>
            <input type="number" min={1} value={form.numero_medicao ?? ""} onChange={(e) => set("numero_medicao", Number(e.target.value))} className="input-base" />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select value={form.status ?? "pendente"} onChange={(e) => set("status", e.target.value as StatusMedicao)} className="input-base">
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_MEDICAO_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Valor (R$)</label>
          <input type="number" min={0} value={form.valor ?? ""} onChange={(e) => set("valor", Number(e.target.value))} className="input-base" placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Data de Envio</label>
            <input type="date" value={form.data_envio ?? ""} onChange={(e) => set("data_envio", e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="field-label">Data de Vencimento</label>
            <input type="date" value={form.data_vencimento ?? ""} onChange={(e) => set("data_vencimento", e.target.value)} className="input-base" />
          </div>
        </div>
        <div>
          <label className="field-label">Observações</label>
          <textarea value={form.obs ?? ""} onChange={(e) => set("obs", e.target.value)} rows={2} className="input-base resize-none" />
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {!isNew && onDelete && (
            <Button variant="danger" size="sm" onClick={handleDelete} loading={saving}>Excluir</Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>Salvar</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
