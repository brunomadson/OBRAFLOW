"use client";
import { useState, useEffect } from "react";
import Badge from "@/components/ui/Badge";
import { useServicos } from "@/hooks/useServicos";
import { getProfiles } from "@/services/profiles.service";
import { ETAPAS_SERVICO } from "@/constants/etapas";
import { fmtBRL } from "@/lib/utils";
import type { Profile, Servico } from "@/types/app.types";
import toast from "react-hot-toast";

// Carga de trabalho por responsável — quem está tocando quantos serviços,
// em que etapa, e quanto em propostas isso representa. Mesma lógica de
// "quem tem o quê" que Obras nunca teve uma tela dedicada pra isso; aqui
// nasce fresh a partir de servico.responsavel (join já existente).

function CardResponsavel({ nome, cargo, servicos }: { nome: string; cargo?: string | null; servicos: Servico[] }) {
  const ativos = servicos.filter((s) => s.etapa !== "concluido");
  const valorPipeline = ativos.reduce((s, sv) => s + (sv.valor_proposta ?? 0), 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-[13px] font-bold text-pink-600 flex-shrink-0">
            {nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900">{nome}</p>
            {cargo && <p className="text-[10px] text-slate-400">{cargo}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-extrabold text-slate-900">{ativos.length}</p>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">ativo{ativos.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {valorPipeline > 0 && (
        <p className="text-[11px] text-emerald-600 font-semibold mb-3">{fmtBRL(valorPipeline)} em propostas ativas</p>
      )}

      {servicos.length === 0 ? (
        <p className="text-[11px] text-slate-400 text-center py-3">Nenhum serviço atribuído.</p>
      ) : (
        <div className="space-y-1.5">
          {servicos.map((s) => {
            const etapa = ETAPAS_SERVICO.find((e) => e.id === s.etapa);
            return (
              <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-slate-50">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-700 truncate">{s.cliente?.nome ?? "Cliente"}</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.catalogoServico?.nome ?? "Serviço"}</p>
                </div>
                <Badge color={etapa?.cor ?? "#94A3B8"}>{etapa?.label ?? s.etapa}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AbaEquipeServicos() {
  const { servicos, loading: loadingServicos } = useServicos();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  useEffect(() => {
    getProfiles()
      .then(setProfiles)
      .catch(() => toast.error("Erro ao carregar a equipe."))
      .finally(() => setLoadingProfiles(false));
  }, []);

  if (loadingServicos || loadingProfiles) {
    return <p className="text-sm text-slate-400 text-center py-12">Carregando...</p>;
  }

  const responsaveisComServico = new Set(servicos.map((s) => s.responsavel_id).filter(Boolean));
  const membrosComServico = profiles.filter((p) => responsaveisComServico.has(p.id) && p.ativo);
  const semResponsavel = servicos.filter((s) => !s.responsavel_id);

  return (
    <div className="max-w-4xl">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
        {membrosComServico.length} responsável{membrosComServico.length !== 1 ? "eis" : ""} com serviço atribuído
      </p>
      <div className="grid grid-cols-2 gap-3.5">
        {membrosComServico.map((p) => (
          <CardResponsavel
            key={p.id}
            nome={p.nome ?? "—"}
            cargo={p.cargo}
            servicos={servicos.filter((s) => s.responsavel_id === p.id)}
          />
        ))}
      </div>

      {semResponsavel.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-3">
            Sem responsável ({semResponsavel.length})
          </p>
          <CardResponsavel nome="Sem responsável" servicos={semResponsavel} />
        </div>
      )}

      {membrosComServico.length === 0 && semResponsavel.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400">Nenhum serviço cadastrado ainda.</p>
        </div>
      )}
    </div>
  );
}
