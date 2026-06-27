"use client";
import type { Etapa } from "@/types/app.types";
import { cn } from "@/lib/utils";

interface LogEntry {
  etapa: string;
  criado_em?: string;
  data?: Date | string;
  dados_extras?: Record<string, unknown> | null;
}

interface Props {
  etapas: Etapa[];
  etapaAtual: string;
  log: LogEntry[];
  gradientColors?: [string, string];
}

/* DD/MM/AAAA */
function fmtDia(s: string): string | null {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch { return null; }
}

/* HH:MM:SS */
function fmtHora(s: string): string | null {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch { return null; }
}

export default function Timeline({
  etapas,
  etapaAtual,
  log,
  gradientColors = ["#3B82F6", "#10B981"],
}: Props) {
  const etapasSemReprovada = etapas.filter((e) => e.id !== "reprovada");
  const etapasVisiveis =
    etapaAtual === "reprovada"
      ? etapas.filter((e) => log.some((l) => l.etapa === e.id))
      : etapasSemReprovada;

  const idxAtual = etapasVisiveis.findIndex((e) => e.id === etapaAtual);

  const getLog = (etapaId: string) => log.find((l) => l.etapa === etapaId);

  return (
    <div className="px-5 pt-4 pb-5 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
        Histórico de Etapas
      </p>

      <div className="relative flex items-start justify-between">
        {/* Linha de fundo */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 z-0" />

        {/* Linha de progresso */}
        <div
          className="absolute top-4 left-0 h-0.5 z-[1] transition-all duration-500"
          style={{
            background: `linear-gradient(90deg, ${gradientColors[0]}, ${gradientColors[1]})`,
            width:
              idxAtual < 0
                ? "0%"
                : `${(idxAtual / Math.max(etapasVisiveis.length - 1, 1)) * 100}%`,
          }}
        />

        {etapasVisiveis.map((etapa, i) => {
          const passado  = i < idxAtual;
          const atual    = etapa.id === etapaAtual;
          const futuro   = i > idxAtual;
          const logEntry = getLog(etapa.id);
          const dataStr  =
            logEntry?.criado_em ??
            (logEntry?.data instanceof Date
              ? logEntry.data.toISOString()
              : logEntry?.data);
          const dia  = dataStr ? fmtDia(dataStr)  : null;
          const hora = dataStr ? fmtHora(dataStr) : null;

          return (
            <div
              key={etapa.id}
              className="flex flex-col items-center z-[2] flex-1 min-w-0"
            >
              {/* Círculo */}
              <div
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={{
                  borderColor: futuro ? "#E2E8F0" : etapa.cor,
                  background:  atual || passado ? etapa.cor : "#fff",
                  boxShadow:   atual ? `0 0 0 4px ${etapa.cor}33` : "none",
                }}
              >
                {passado ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 7L5.5 10L11.5 4"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: atual ? "#fff" : futuro ? "#CBD5E1" : "#fff" }}
                  >
                    {i + 1}
                  </span>
                )}
              </div>

              {/* Rótulo + data/hora */}
              <div className="mt-1.5 text-center px-0.5 w-full">
                {/* Nome da etapa */}
                <p
                  className={cn(
                    "text-[10px] leading-tight truncate max-w-[80px] mx-auto",
                    futuro
                      ? "text-slate-300 font-medium"
                      : atual
                      ? "font-bold"
                      : "font-semibold text-slate-500"
                  )}
                  style={{ color: atual ? etapa.cor : undefined }}
                >
                  {etapa.label}
                </p>

                {/* Data e hora quando o log existe */}
                {dia ? (
                  <div className="mt-1 space-y-0.5">
                    <p
                      className="text-[10px] font-semibold leading-tight"
                      style={{ color: passado ? "#475569" : etapa.cor }}
                    >
                      {dia}
                    </p>
                    {hora && (
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {hora}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Traço para etapas sem log */
                  <p className="text-[9px] text-slate-300 mt-1">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
