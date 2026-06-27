"use client";
import { useState, useMemo, useCallback } from "react";
import { useFinanceiro } from "@/hooks/useFinanceiro";
import { fmtBRL, fmtDate } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { TipoLancamento } from "@/types/app.types";
import toast from "react-hot-toast";

const TIPOS: { id: TipoLancamento; label: string; cor: string }[] = [
  { id: "entrada",   label: "Entrada",   cor: "#10B981" },
  { id: "saida",     label: "Saída",     cor: "#EF4444" },
  { id: "comissao",  label: "Comissão",  cor: "#8B5CF6" },
  { id: "imposto",   label: "Imposto",   cor: "#F59E0B" },
];

export default function SetorFinanceiro() {
  const { lancamentos, loading, criar, remover } = useFinanceiro();
  const [filtro, setFiltro]       = useState<TipoLancamento | "todos">("todos");
  const [busca, setBusca]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ descricao: "", valor: "", tipo: "entrada" as TipoLancamento, data: "", obs: "" });
  const [saving, setSaving]       = useState(false);

  const filtrados = useMemo(() => {
    return lancamentos.filter((l) => {
      const matchTipo  = filtro === "todos" || l.tipo === filtro;
      const matchBusca = l.descricao.toLowerCase().includes(busca.toLowerCase());
      return matchTipo && matchBusca;
    });
  }, [lancamentos, filtro, busca]);

  const totais = useMemo(() => {
    const entradas  = lancamentos.filter((l) => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
    const saidas    = lancamentos.filter((l) => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
    const comissoes = lancamentos.filter((l) => l.tipo === "comissao").reduce((s, l) => s + Number(l.valor), 0);
    const impostos  = lancamentos.filter((l) => l.tipo === "imposto").reduce((s, l) => s + Number(l.valor), 0);
    return { entradas, saidas, comissoes, impostos, saldo: entradas - saidas - comissoes - impostos };
  }, [lancamentos]);

  const handleSalvar = useCallback(async () => {
    if (!form.descricao.trim()) { toast.error("Informe a descrição"); return; }
    if (!form.valor || Number(form.valor) <= 0) { toast.error("Informe o valor"); return; }
    if (!form.data) { toast.error("Informe a data"); return; }
    setSaving(true);
    try {
      await criar({ descricao: form.descricao, valor: Number(form.valor), tipo: form.tipo, data: form.data, obs: form.obs });
      toast.success("Lançamento criado!");
      setForm({ descricao: "", valor: "", tipo: "entrada", data: "", obs: "" });
      setShowForm(false);
    } finally { setSaving(false); }
  }, [form, criar]);

  const handleRemover = async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    await remover(id);
    toast.success("Lançamento removido.");
  };

  return (
    <div>
      <div className="bg-white border-b border-slate-100 px-6 flex items-center justify-between py-2">
        <div className="flex gap-1">
          {[{ id: "todos", label: "Todos" }, ...TIPOS].map((t) => (
            <button
              key={t.id}
              onClick={() => setFiltro(t.id as typeof filtro)}
              className={`tab-btn ${filtro === t.id ? "active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2.5">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar descrição..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-400 w-44"
          />
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-1.5">
            + Lançamento
          </button>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* KPIs */}
        <div className="grid grid-cols-5 gap-3.5 mb-5">
          {[
            { label: "Entradas",  valor: fmtBRL(totais.entradas),  cor: "border-t-emerald-500" },
            { label: "Saídas",    valor: fmtBRL(totais.saidas),    cor: "border-t-red-500" },
            { label: "Comissões", valor: fmtBRL(totais.comissoes), cor: "border-t-purple-500" },
            { label: "Impostos",  valor: fmtBRL(totais.impostos),  cor: "border-t-amber-400" },
            { label: "Saldo",     valor: fmtBRL(totais.saldo),     cor: `border-t-${totais.saldo >= 0 ? "blue" : "red"}-500` },
          ].map((k) => (
            <div key={k.label} className={`card p-4 border-t-[3px] ${k.cor}`}>
              <p className="section-title mb-1.5">{k.label}</p>
              <p className={`text-[18px] font-extrabold ${k.label === "Saldo" && totais.saldo < 0 ? "text-red-500" : "text-slate-900"}`}>{k.valor}</p>
            </div>
          ))}
        </div>

        {/* Form novo lançamento */}
        {showForm && (
          <div className="card p-5 mb-4">
            <p className="text-[13px] font-bold text-slate-900 mb-3.5">Novo Lançamento</p>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="col-span-2">
                <label className="field-label">Descrição *</label>
                <input value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} className="input-base" placeholder="Ex: Honorários obra João" />
              </div>
              <div>
                <label className="field-label">Valor (R$) *</label>
                <input type="number" min={0} value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label className="field-label">Data *</label>
                <input type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} className="input-base" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div>
                <label className="field-label">Tipo *</label>
                <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as TipoLancamento }))} className="input-base">
                  {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="field-label">Observações</label>
                <input value={form.obs} onChange={(e) => setForm((p) => ({ ...p, obs: e.target.value }))} className="input-base" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handleSalvar} loading={saving}>Salvar</Button>
            </div>
          </div>
        )}

        {/* Tabela */}
        {loading ? <SkeletonTable /> : (
          <div className="card overflow-hidden">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Data", "Descrição", "Tipo", "Valor", "Obs", ""].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[11px] font-bold text-slate-500 tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l, i) => {
                  const tipo = TIPOS.find((t) => t.id === l.tipo);
                  return (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50" style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                      <td className="px-3.5 py-2.5 text-slate-400">{fmtDate(l.data)}</td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{l.descricao}</td>
                      <td className="px-3.5 py-2.5">{tipo && <Badge color={tipo.cor}>{tipo.label}</Badge>}</td>
                      <td className={`px-3.5 py-2.5 font-bold ${l.tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                        {l.tipo === "entrada" ? "+" : "-"}{fmtBRL(l.valor)}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-400 text-[12px]">{l.obs ?? "—"}</td>
                      <td className="px-3.5 py-2.5">
                        <button onClick={() => handleRemover(l.id)} className="text-red-400 hover:text-red-600 text-[11px] font-semibold transition-colors">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-[13px]">Nenhum lançamento encontrado.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
