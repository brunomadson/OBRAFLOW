"use client";
import { useState } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { STATUS_MEDICAO_LABEL, STATUS_MEDICAO_COR } from "@/constants/dominios";
import type { Medicao, StatusMedicao, MedicaoHistoricoEntry } from "@/types/app.types";
import toast from "react-hot-toast";

const STATUS_OPTS: StatusMedicao[] = ["a_solicitar", "solicitada", "laudo_emitido", "paga"];

function fmtDH(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

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
  const statusOriginal = medicao?.status ?? "a_solicitar";

  const [form, setForm] = useState<Partial<Medicao>>(
    medicao ?? { status: "a_solicitar", nome: "", pct_solicitada: undefined }
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Medicao, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const isPaga = form.status === "paga";

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome/descrição da medição"); return; }
    if (!form.pct_solicitada || Number(form.pct_solicitada) <= 0) {
      toast.error("Informe a % solicitada");
      return;
    }

    // Registra mudança de status no histórico
    let dadosSave = { ...form };
    if (form.status && form.status !== statusOriginal) {
      const entrada: MedicaoHistoricoEntry = {
        status: form.status,
        data: new Date().toISOString(),
      };
      dadosSave = {
        ...dadosSave,
        historico: [...(form.historico ?? []), entrada],
      };
    }

    setSaving(true);
    try {
      await onSave(obraId, dadosSave);
      toast.success("Medição salva!");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!medicao?.id || !onDelete) return;
    if (!confirm("Excluir esta medição?")) return;
    setSaving(true);
    try {
      await onDelete(obraId, medicao.id);
      toast.success("Medição removida.");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const historico = form.historico ?? [];

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader
        title={isNew ? "Nova Medição" : "Editar Medição"}
        onClose={onClose}
        subtitle={<span className="text-xs text-slate-400">{obraCliente}</span>}
      />
      <div className="p-5 space-y-4">

        {/* Nome da Medição */}
        <div>
          <label className="field-label">Descrição da Medição</label>
          <input
            type="text"
            value={form.nome ?? ""}
            onChange={(e) => set("nome", e.target.value)}
            className="input-base"
            placeholder="Ex: 1ª Medição — Fundação"
          />
        </div>

        {/* % Solicitada */}
        <div>
          <label className="field-label">% Solicitada</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.pct_solicitada ?? ""}
              onChange={(e) => set("pct_solicitada", e.target.value ? Number(e.target.value) : undefined)}
              className="input-base pr-10"
              placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="field-label mb-2">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTS.map((s) => {
              const ativo = form.status === s;
              const cor = STATUS_MEDICAO_COR[s] ?? "#94A3B8";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className="rounded-lg px-3 py-2 text-xs font-bold border-2 transition-all cursor-pointer"
                  style={
                    ativo
                      ? { borderColor: cor, backgroundColor: cor + "22", color: cor }
                      : { borderColor: "#E2E8F0", color: "#94A3B8" }
                  }
                >
                  {STATUS_MEDICAO_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data de Envio à Caixa */}
        <div>
          <label className="field-label">Data de Envio à Caixa</label>
          <input
            type="date"
            value={form.data_envio_caixa ?? ""}
            onChange={(e) => set("data_envio_caixa", e.target.value || null)}
            className="input-base"
          />
        </div>

        {/* Dados do pagamento — só quando Paga */}
        {isPaga && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Dados do Pagamento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">% Liberada</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.pct_liberada ?? ""}
                    onChange={(e) => set("pct_liberada", e.target.value ? Number(e.target.value) : undefined)}
                    className="input-base pr-10"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="field-label">Valor Pago (R$)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.valor_liberado ?? ""}
                  onChange={(e) => set("valor_liberado", e.target.value ? Number(e.target.value) : undefined)}
                  className="input-base"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <label className="field-label">Data de Pagamento</label>
              <input
                type="date"
                value={form.data_liberacao ?? ""}
                onChange={(e) => set("data_liberacao", e.target.value || null)}
                className="input-base"
              />
            </div>
          </div>
        )}

        {/* Histórico de status */}
        {historico.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Histórico de Status</p>
            <div className="space-y-2">
              {[...historico].reverse().map((h, i) => {
                const cor = STATUS_MEDICAO_COR[h.status] ?? "#94A3B8";
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                    <span className="text-[12px] font-bold" style={{ color: cor }}>
                      {STATUS_MEDICAO_LABEL[h.status]}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-auto">{fmtDH(h.data)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-between gap-2 pt-2">
          {!isNew && onDelete && (
            <Button variant="danger" size="sm" onClick={handleDelete} loading={saving}>
              Excluir
            </Button>
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
