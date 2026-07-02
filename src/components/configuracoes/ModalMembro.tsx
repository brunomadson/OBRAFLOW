"use client";
import { useState } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { CARGOS, SETORES_ACESSO } from "@/constants/dominios";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Profile } from "@/types/app.types";
import toast from "react-hot-toast";

interface Props {
  membro: Profile | null;
  onClose: () => void;
  onSave: (data: Partial<Profile>) => Promise<void>;
}

export default function ModalMembro({ membro, onClose, onSave }: Props) {
  const isNovo = !membro;
  const { profile } = useAuth();
  const supabase = createClient();

  const [form, setForm] = useState<Partial<Profile>>(
    membro ?? { nome: "", cargo: CARGOS[0], setores: [SETORES_ACESSO[0].id], status: "ativo" }
  );
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Profile, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome"); return; }

    if (isNovo) {
      // Convite: cria registro em workspace_invites em vez de tentar
      // criar um perfil sem usuário Auth (que não tem id ainda).
      // O trigger handle_new_user vai usar o invite quando a pessoa criar a conta.
      if (!email.trim()) { toast.error("Informe o e-mail"); return; }

      setSaving(true);
      try {
        const { error } = await supabase
          .from("workspace_invites" as never)
          .insert({
            email: email.trim().toLowerCase(),
            nome: form.nome?.trim(),
            cargo: form.cargo ?? CARGOS[0],
            setores: form.setores ?? [SETORES_ACESSO[0].id],
            workspace_id: profile?.workspace_id,
            created_by: profile?.id,
          } as never);

        if (error) throw error;

        toast.success(
          `Convite criado para ${email}! Crie a conta no Supabase Dashboard e o usuário entrará automaticamente no workspace com cargo e setores configurados.`,
          { duration: 7000 }
        );
        onClose();
      } catch {
        toast.error("Erro ao criar convite. Tente novamente.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Edição de membro existente: comportamento original
    setSaving(true);
    try {
      await onSave(form);
      toast.success("Membro atualizado!");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={isNovo ? "Convidar Membro" : "Editar Membro"} onClose={onClose} />
      <div className="p-5 space-y-3">
        <div>
          <label className="field-label">Nome Completo *</label>
          <input
            value={form.nome ?? ""}
            onChange={(e) => set("nome", e.target.value)}
            className="input-base"
            placeholder="Nome do colaborador"
          />
        </div>

        {isNovo && (
          <div>
            <label className="field-label">E-mail *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              placeholder="email@empresa.com"
            />
          </div>
        )}

        <div>
          <label className="field-label">Cargo</label>
          <select
            value={form.cargo ?? ""}
            onChange={(e) => set("cargo", e.target.value)}
            className="input-base"
          >
            {CARGOS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">Setor de Acesso</label>
          <select
            value={form.setores?.[0] ?? ""}
            onChange={(e) => set("setores", [e.target.value])}
            className="input-base"
          >
            {SETORES_ACESSO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {!isNovo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.status === "ativo"}
              onChange={(e) => set("status", e.target.checked ? "ativo" : "inativo")}
              className="accent-blue-500"
            />
            <span className="text-xs text-slate-700">Conta ativa</span>
          </label>
        )}

        {isNovo && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Após criar o convite, acesse o <strong>Supabase Dashboard → Authentication → Users → Create user</strong> e cadastre o e-mail acima. O usuário entrará automaticamente neste workspace com o cargo e setor configurados.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" className="flex-1" size="sm" onClick={handleSave} loading={saving}>
            {isNovo ? "Criar Convite" : "Salvar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
