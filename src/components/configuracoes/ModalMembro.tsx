"use client";
import { useState, useEffect } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCargos } from "@/services/cargos.service";
import type { Cargo, Profile } from "@/types/app.types";
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

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [form, setForm] = useState<Partial<Profile>>(
    membro ?? { nome: "", cargo_id: null, ativo: true }
  );
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Profile, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    getCargos().then((lista) => {
      setCargos(lista);
      if (!form.cargo_id && lista.length > 0) set("cargo_id", lista[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargoSelecionado = cargos.find((c) => c.id === form.cargo_id);

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome"); return; }
    if (!form.cargo_id) { toast.error("Selecione um cargo"); return; }

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
            cargo: cargoSelecionado?.nome ?? "",
            cargo_id: form.cargo_id,
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
            emailRedirectTo: `${window.location.origin}/aceitar-convite`,
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

    // Edição de membro existente — só nome/cargo_id/ativo. cargo (texto) e
    // setores são recalculados automaticamente pelo trigger de sync a partir
    // do cargo_id (ver migration 027), não precisa (nem deve) mandar direto.
    setSaving(true);
    try {
      await onSave({
        id: form.id,
        nome: form.nome,
        cargo_id: form.cargo_id,
        ativo: form.ativo,
      });
      toast.success("Membro atualizado!");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar membro.");
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
            value={form.cargo_id ?? ""}
            onChange={(e) => set("cargo_id", e.target.value)}
            className="input-base"
          >
            {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            Setores e permissões desse cargo podem ser ajustados em Configurações → Cargos.
          </p>
        </div>

        {!isNovo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo ?? true}
              onChange={(e) => set("ativo", e.target.checked)}
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
