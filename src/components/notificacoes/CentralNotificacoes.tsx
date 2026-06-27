"use client";
import { useState, useMemo } from "react";
import { useLeads } from "@/hooks/useLeads";
import { useObras } from "@/hooks/useObras";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { CONFIG_PADRAO } from "@/constants/config";
import Badge from "@/components/ui/Badge";
import type { Notificacao } from "@/types/app.types";

const TIPO_COR: Record<Notificacao["tipo"], string> = {
  critico: "#EF4444",
  alerta:  "#F59E0B",
  info:    "#3B82F6",
};

const TIPO_BG: Record<Notificacao["tipo"], string> = {
  critico: "#FEF2F2",
  alerta:  "#FFFBEB",
  info:    "#EFF6FF",
};

const ICON: Record<Notificacao["tipo"], string> = {
  critico: "🔴",
  alerta:  "🟡",
  info:    "🔵",
};

const SETORES = [
  { id: "todos",      label: "Todos" },
  { id: "comercial",  label: "Comercial" },
  { id: "obras",      label: "Obras" },
  { id: "financeiro", label: "Financeiro" },
];

export default function CentralNotificacoes() {
  const { leads } = useLeads();
  const { obras } = useObras();
  const notifs = useNotificacoes(leads, obras, CONFIG_PADRAO, []);

  const [filtroTipo,  setFiltroTipo]  = useState<Notificacao["tipo"] | "todas">("todas");
  const [filtroSetor, setFiltroSetor] = useState<string>("todos");

  const filtradas = useMemo(() =>
    notifs.filter((n) => {
      const matchTipo  = filtroTipo  === "todas" || n.tipo  === filtroTipo;
      const matchSetor = filtroSetor === "todos"  || n.setor === filtroSetor;
      return matchTipo && matchSetor;
    }),
    [notifs, filtroTipo, filtroSetor]
  );

  const criticos = notifs.filter((n) => n.tipo === "critico").length;
  const alertas  = notifs.filter((n) => n.tipo === "alerta").length;
  const infos    = notifs.filter((n) => n.tipo === "info").length;

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[18px] font-extrabold text-slate-900">Central de Alertas</h1>
        <span className="text-xs text-slate-400">{notifs.length} alerta{notifs.length !== 1 ? "s" : ""}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3.5 mb-5">
        {[
          { label: "Críticos", valor: criticos, cor: "border-t-red-500" },
          { label: "Alertas",  valor: alertas,  cor: "border-t-amber-400" },
          { label: "Infos",    valor: infos,    cor: "border-t-blue-500" },
        ].map((k) => (
          <div key={k.label} className={`card p-4 border-t-[3px] ${k.cor} text-center`}>
            <p className="section-title mb-1">{k.label}</p>
            <p className="text-[28px] font-extrabold text-slate-900">{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtro por setor */}
      <div className="flex gap-2 mb-3">
        {SETORES.map((s) => (
          <button
            key={s.id}
            onClick={() => setFiltroSetor(s.id)}
            className={`border-[1.5px] rounded-lg px-3.5 py-1 text-xs font-bold cursor-pointer transition-colors ${
              filtroSetor === s.id ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filtro por tipo */}
      <div className="flex gap-2 mb-4">
        {(["todas", "critico", "alerta", "info"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroTipo(f)}
            className={`border-[1.5px] rounded-lg px-3.5 py-1 text-xs font-bold cursor-pointer transition-colors capitalize ${
              filtroTipo === f ? "border-blue-500 bg-blue-50 text-blue-500" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {f === "todas" ? "Todos os tipos" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-[15px] font-semibold text-slate-600">Nenhum alerta encontrado.</p>
          <p className="text-xs text-slate-400 mt-1">Tudo em dia!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtradas.map((n, i) => (
            <div
              key={i}
              className="rounded-xl p-4 border-l-[4px] flex items-start gap-3.5"
              style={{ background: TIPO_BG[n.tipo], borderLeftColor: TIPO_COR[n.tipo] }}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{ICON[n.tipo]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="text-[13px] font-bold text-slate-900 leading-snug">{n.titulo}</p>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Badge color={TIPO_COR[n.tipo]}>
                      {n.tipo.charAt(0).toUpperCase() + n.tipo.slice(1)}
                    </Badge>
                    <Badge color="#94A3B8">{n.setor}</Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{n.mensagem}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
