"use client";
import { useState, useEffect, useCallback } from "react";
import { getHistorico } from "@/services/historico.service";
import type { Historico, TipoHistorico } from "@/types/app.types";

type FiltroTipo = TipoHistorico | "todos";

const FILTROS: { id: FiltroTipo; label: string }[] = [
  { id: "todos",     label: "Todos" },
  { id: "comercial", label: "Comercial" },
  { id: "obras",     label: "Obras" },
  { id: "documento", label: "Documentos" },
  { id: "medicao",   label: "Medições" },
  { id: "sistema",   label: "Sistema" },
];

const COR_TIPO: Record<TipoHistorico, string> = {
  lead:      "text-blue-400",
  comercial: "text-violet-400",
  obras:     "text-emerald-500",
  documento: "text-orange-400",
  medicao:   "text-cyan-500",
  sistema:   "text-slate-400",
};

function IconTipo({ tipo }: { tipo: TipoHistorico }) {
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  switch (tipo) {
    case "lead":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "comercial":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "obras":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none">
          <path d="M2 14V7.5L8 2l6 5.5V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="6" y="10" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case "documento":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none">
          <path d="M4 2h6l3 3v9H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 9h4M6 11.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "medicao":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none">
          <path d="M2 12l3-5 3 4 2.5-3L14 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
  }
}

function fmtDataHora(iso: string) {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} • ${hora}`;
}

interface Props {
  leadId?: string;
  obraId?: string;
}

export default function AbaHistorico({ leadId, obraId }: Props) {
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroTipo>("todos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistorico({ lead_id: leadId, obra_id: obraId });
      setHistorico(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [leadId, obraId]);

  useEffect(() => { load(); }, [load]);

  const filtrado = historico
    .filter((h) => filtro === "todos" || h.tipo === filtro)
    .filter((h) => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return h.acao.toLowerCase().includes(q) || h.usuario_nome.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-3">
      {/* Busca */}
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar no histórico..."
        className="input-base w-full"
      />

      {/* Filtros */}
      <div className="flex gap-1 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              filtro === f.id
                ? "bg-blue-500 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-xs text-slate-400 text-center py-8">Carregando histórico...</p>
      ) : filtrado.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-8">
          {historico.length === 0
            ? "Nenhum evento registrado ainda."
            : "Nenhum resultado encontrado."}
        </p>
      ) : (
        <div>
          {filtrado.map((h) => (
            <div
              key={h.id}
              className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0"
            >
              <span className={`mt-[3px] ${COR_TIPO[h.tipo as TipoHistorico] ?? "text-slate-400"}`}>
                <IconTipo tipo={h.tipo as TipoHistorico} />
              </span>
              <span className="text-[12px] leading-snug text-slate-700 min-w-0">
                <span className="text-slate-400">{fmtDataHora(h.created_at)}</span>
                {" • "}
                <span className="font-semibold text-slate-800">{h.usuario_nome}</span>
                {" "}
                <span className="text-slate-600">{h.acao}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
