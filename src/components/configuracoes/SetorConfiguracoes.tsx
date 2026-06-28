"use client";
import { useState, useEffect, useCallback } from "react";
import ModalMembro from "./ModalMembro";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { GRUPOS_CONFIG } from "@/constants/config";
import { getProfiles, upsertProfile } from "@/services/profiles.service";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/app.types";
import toast from "react-hot-toast";

type Aba = "prazos" | "membros" | "integracoes";

/* ---- Aba Prazos ---- */
function AbaPrazos() {
  const supabase = createClient();
  const [config, setConfig] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("config").select("*").limit(1).single().then(({ data }) => {
      if (data) setConfig(data as Record<string, number>);
    });
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("config").upsert(config as never);
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      {GRUPOS_CONFIG.map((grupo) => (
        <div key={grupo.id} className="card p-5 mb-4">
          <p className="text-[13px] font-bold text-slate-900 mb-1">{grupo.label}</p>
          <div className="space-y-3">
            {grupo.itens.map((campo) => (
              <div key={campo.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] text-slate-700 font-medium">{campo.label}</p>
                  {campo.desc && <p className="text-[11px] text-slate-400">{campo.desc}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={config[campo.key] ?? 0}
                    onChange={(e) => setConfig((p) => ({ ...p, [campo.key]: Number(e.target.value) }))}
                    className="input-base w-20 text-center"
                  />
                  <span className="text-xs text-slate-400">{campo.unidade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="primary" onClick={handleSave} loading={saving}>Salvar Configurações</Button>
    </div>
  );
}

/* ---- Aba Membros ---- */
function AbaMembros() {
  const [membros, setMembros]   = useState<Profile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<Profile | "novo" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMembros(await getProfiles() as Profile[]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Partial<Profile>) => {
    await upsertProfile(data as Parameters<typeof upsertProfile>[0]);
    await load();
    setModal(null);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-[13px] font-bold text-slate-700">Equipe ({membros.length})</p>
        <Button variant="primary" size="sm" onClick={() => setModal("novo")}>+ Convidar Membro</Button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : (
        <div className="space-y-2.5">
          {membros.map((m) => (
            <div
              key={m.id}
              onClick={() => setModal(m)}
              className="card p-4 flex justify-between items-center cursor-pointer hover:shadow-card-hover"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                  {(m.nome ?? "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">{m.nome}</p>
                  <p className="text-[11px] text-slate-400">{m.cargo} · {m.setores?.[0] ?? ""}</p>
                </div>
              </div>
              <Badge color={m.status === "ativo" ? "#10B981" : "#94A3B8"}>{m.status === "ativo" ? "Ativo" : "Inativo"}</Badge>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <ModalMembro
          membro={modal === "novo" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/* ---- Aba Integrações ---- */
function AbaIntegracoes() {
  return (
    <div className="max-w-2xl">
      <div className="card p-5 mb-3.5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[13px] font-bold text-slate-900 mb-0.5">Supabase</p>
            <p className="text-xs text-slate-400">Banco de dados e autenticação</p>
          </div>
          <Badge color="#10B981">Conectado</Badge>
        </div>
      </div>
      <div className="card p-5 mb-3.5 opacity-60">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[13px] font-bold text-slate-900 mb-0.5">WhatsApp (Em breve)</p>
            <p className="text-xs text-slate-400">Envio automático de mensagens</p>
          </div>
          <Badge color="#94A3B8">Indisponível</Badge>
        </div>
      </div>
      <div className="card p-5 opacity-60">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[13px] font-bold text-slate-900 mb-0.5">Google Calendar (Em breve)</p>
            <p className="text-xs text-slate-400">Sincronização de reuniões</p>
          </div>
          <Badge color="#94A3B8">Indisponível</Badge>
        </div>
      </div>
    </div>
  );
}

/* ---- Main ---- */
export default function SetorConfiguracoes() {
  const [aba, setAba] = useState<Aba>("prazos");
  const tabs: [Aba, string][] = [["prazos", "Prazos"], ["membros", "Membros"], ["integracoes", "Integrações"]];

  return (
    <div>
      <div className="bg-white border-b border-slate-100 px-6 flex gap-1">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} className={`tab-btn ${aba === id ? "active" : ""}`}>{label}</button>
        ))}
      </div>
      <div className="p-6 max-w-[1400px] mx-auto">
        {aba === "prazos"      && <AbaPrazos />}
        {aba === "membros"     && <AbaMembros />}
        {aba === "integracoes" && <AbaIntegracoes />}
      </div>
    </div>
  );
}
