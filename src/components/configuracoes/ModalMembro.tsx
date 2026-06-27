"use client";
import { useState } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { CARGOS, SETORES_ACESSO } from "@/constants/dominios";
import type { Profile } from "@/types/app.types";
import toast from "react-hot-toast";

interface Props {
  membro: Profile | null;
  onClose: () => void;
  onSave: (data: Partial<Profile>) => Promise<void>;
}

export default function ModalMembro({ membro, onClose, onSave }: Props) {
  const isNovo = !membro;
  const [form, setForm] = useState<Partial<Profile>>(membro ?? { nome: "", cargo: CARGOS[0], setor: SETORES_ACESSO[0], ativo: true });
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Profile, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome"); return; }
    if (isNovo && !email.trim()) { toast.error("Informe o e-mail"); return; }
    setSaving(true);
    try { await onSave({ ...form, ...(isNovo ? { email } : {}) }); toast.success(isNovo ? "Membro convidado!" : "Membro atualizado!"); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={isNovo ? "Convidar Membro" : "Editar Membro"} onClose={onClose} />
      <div className="p-5 space-y-3">
        <div>
          <label className="field-label">Nome Completo *</label>
          <input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} className="input-base" placeholder="Nome do colaborador" />
        </div>
        {isNovo && (
          <div>
            <label className="field-label">E-mail *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" placeholder="email@empresa.com" />
          </div>
        )}
        <div>
          <label className="field-label">Cargo</label>
          <select value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} className="input-base">
            {CARGOS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Setor de Acesso</label>
          <select value={form.setor ?? ""} onChange={(e) => set("setor", e.target.value)} className="input-base">
            {SETORES_ACESSO.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {!isNovo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.ativo} onChange={(e) => set("ativo", e.target.checked)} className="accent-blue-500" />
            <span className="text-xs text-slate-700">Conta ativa</span>
          </label>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" size="sm" onClick={handleSave} loading={saving}>
            {isNovo ? "Convidar" : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
