"use client";
import { useState, useEffect } from "react";
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

const TODOS_SETORES = SETORES_ACESSO.map((s) => s.id);
const isDono = (cargo: string) => cargo === "CEO / Dono";

export default function ModalMembro({ membro, onClose, onSave }: Props) {
  const isNovo = !membro;
  const { profile } = useAuth();
  const supabase = createClient();

  const [form, setForm] = useState<Partial<Profile>>(
    membro ?? { nome: "", cargo: CARGOS[0], setores: TODOS_SETORES, status: "ativo" }
  );
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Profile, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  // Quando cargo muda para CEO/Dono, auto-seleciona todos os setores
  useEffect(() => {
    if (isDono(form.cargo ?? "")) {
      set("setores", TODOS_SETORES);
    }
  }, [form.cargo]);

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome"); return; }

    if (isNovo) {
      if (!email.trim()) { toast.error("Informe o e-mail"); return; }

      setSaving(true);
      try {
        // 1. Cria o registro de convite no banco
        const { error: inviteErr } = await supabase
          .from("workspace_invites" as never)
          .insert({
            email: email.trim().toLowerCase(),
            nome: form.nome?.trim(),
            cargo: form.cargo ?? CARGOS[0],
            setores: isDono(form.cargo ?? "") ? TODOS_SETORES : (form.setores ?? [SETORES_ACESSO[0].id]),
            workspace_id: profile?.workspace_id,
            created_by: profile?.id,
          } as never);

        if (inviteErr) throw inviteErr;

        // 2. Envia o link de acesso por email via Supabase Auth (OTP magic link)
        //    Quando o usuário clicar, a conta é criada e o trigger aplica
        //    automaticamente o workspace, cargo e setores do convite.
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/aceitar-convite`,
          },
        });

        if (otpErr) {
          // OTP pode estar desabilitado no projeto — avisa mas não cancela o convite
          toast.success(
            `Convite criado para ${email.trim()}! Crie a conta no Supabase Dashboard → Authentication → Create user com este e-mail.`,
            { duration: 8000 }
          );
        } else {
          toast.success(
            `Convite enviado para ${email.trim()}! O usuário receberá um e-mail com o link de acesso.`,
            { duration: 6000 }
          );
        }

        onClose();
      } catch {
        toast.error("Erro ao criar convite. Tente novamente.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Edição de membro existente
    setSaving(true);
    try {
      await onSave({
        ...form,
        setores: isDono(form.cargo ?? "") ? TODOS_SETORES : form.setores,
      });
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

        {/* Setor de acesso: oculto para CEO/Dono (tem acesso a tudo automaticamente) */}
        {!isDono(form.cargo ?? "") && (
          <div>
            <label className="field-label">Setor de Acesso</label>
            <select
              value={form.setores?.[0] ?? ""}
              onChange={(e) => set("setores", [e.target.value])}
              className="input-base"
            >
              {SETORES_ACESSO.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        {isDono(form.cargo ?? "") && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
            <p className="text-[11px] text-slate-500">
              CEO / Dono tem acesso a <strong>todos os setores</strong> automaticamente.
            </p>
          </div>
        )}

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
