"use client";
import { useState } from "react";
import { DOCS_ENG_CONFORMIDADE, DOCS_PROJETOS, DOCS_CONTRATO } from "@/constants/documentos";

const GRUPOS = [
  { titulo: "Engenharia e Conformidade", docs: DOCS_ENG_CONFORMIDADE },
  { titulo: "Projetos",                   docs: DOCS_PROJETOS },
  { titulo: "Contrato e Financeiro",      docs: DOCS_CONTRATO },
];

export default function ChecklistDocumentosObra() {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setMarcados((p) => ({ ...p, [k]: !p[k] }));

  const total   = GRUPOS.reduce((s, g) => s + g.docs.length, 0);
  const marcado = Object.values(marcados).filter(Boolean).length;
  const pct     = total > 0 ? Math.round((marcado / total) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-[13px] font-bold text-slate-700">Checklist da Obra</p>
        <span className="text-xs font-bold text-blue-500">{marcado}/{total} ({pct}%)</span>
      </div>
      <div className="bg-slate-100 rounded h-1.5 mb-4">
        <div className="bg-blue-500 h-1.5 rounded transition-all" style={{ width: `${pct}%` }} />
      </div>
      {GRUPOS.map((g) => (
        <div key={g.titulo} className="mb-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{g.titulo}</p>
          {g.docs.map((doc) => {
            const k = `${g.titulo}_${doc}`;
            return (
              <label key={k} className="flex items-center gap-2.5 mb-1.5 cursor-pointer">
                <input type="checkbox" checked={!!marcados[k]} onChange={() => toggle(k)} className="w-3.5 h-3.5 rounded accent-blue-500" />
                <span className={`text-xs ${marcados[k] ? "line-through text-slate-400" : "text-slate-700"}`}>{doc}</span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
