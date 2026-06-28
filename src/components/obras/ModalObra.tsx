"use client";
import { useState, useCallback } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Timeline from "@/components/shared/Timeline";
import StatusBadgeMedicao from "@/components/shared/StatusBadgeMedicao";
import ChecklistDocumentosObra from "./ChecklistDocumentosObra";
import ModalMedicao from "./ModalMedicao";
import { ETAPAS_OBRA, FLUXO_OBRA } from "@/constants/etapas";
import { CIDADES, ENGENHEIROS, MODALIDADES } from "@/constants/dominios";
import { fmtBRL, fmtDate, maskCPF, maskPhone } from "@/lib/utils";
import type { Obra, Medicao, EtapaObra, EngCaixaObra, ConformidadeObra, StatusItem } from "@/types/app.types";
import toast from "react-hot-toast";

type Tab = "perfil" | "medicoes" | "docs" | "editar";

// ── Helper date+hora ──────────────────────────────────────────────────────────
function fmtDH(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Eng. Caixa — padrão vazio ─────────────────────────────────────────────────
const EMPTY_ENG: EngCaixaObra = {
  enviado: "pendente", dtEnviado: "",
  solicitado: "pendente", dtSolicitado: "",
  boletoPago: "pendente", dtBoletoPago: "",
  vistoriaRealizada: "pendente", dtVistoria: "",
  laudoEmitido: "pendente", dtLaudo: "",
};

// ── Seção de acompanhamento Eng. Caixa (exibida na aba Perfil) ────────────────
function EngCaixaSection({
  obra, onSave, onAvancar, onClose,
}: {
  obra: Obra;
  onSave: (data: Partial<Obra>) => Promise<void>;
  onAvancar: (id: string, novaEtapa: EtapaObra) => Promise<void>;
  onClose: () => void;
}) {
  const [eng, setEng] = useState<EngCaixaObra>(() => ({ ...EMPTY_ENG, ...(obra.eng_caixa ?? {}) }));
  const [saving, setSaving] = useState(false);

  const handleStep = useCallback(async (
    field: "solicitado" | "boletoPago" | "vistoriaRealizada" | "laudoEmitido",
    dtField: "dtSolicitado" | "dtBoletoPago" | "dtVistoria" | "dtLaudo",
    isLaudo = false,
  ) => {
    const current = eng[field] as StatusItem;
    const next: StatusItem = current === "concluido" ? "pendente" : "concluido";
    const novoEng: EngCaixaObra = {
      ...eng,
      [field]: next,
      [dtField]: next === "concluido" ? new Date().toISOString() : "",
    };
    setEng(novoEng);
    setSaving(true);
    try {
      await onSave({ eng_caixa: novoEng });
      if (isLaudo && next === "concluido") {
        toast.success("Laudo emitido! Avançando para Conformidade...");
        await onAvancar(obra.id, "conformidade");
        onClose();
      }
    } catch {
      setEng(eng); // reverte em caso de erro
    } finally {
      setSaving(false);
    }
  }, [eng, obra.id, onSave, onAvancar, onClose]);

  const steps: Array<{
    field: "solicitado" | "boletoPago" | "vistoriaRealizada" | "laudoEmitido";
    dtField: "dtSolicitado" | "dtBoletoPago" | "dtVistoria" | "dtLaudo";
    label: string;
    isLaudo: boolean;
  }> = [
    { field: "solicitado",        dtField: "dtSolicitado", label: "Solicitado à Caixa", isLaudo: false },
    { field: "boletoPago",        dtField: "dtBoletoPago", label: "Boleto Pago",         isLaudo: false },
    { field: "vistoriaRealizada", dtField: "dtVistoria",   label: "Vistoria Realizada",  isLaudo: false },
    { field: "laudoEmitido",      dtField: "dtLaudo",      label: "Laudo Emitido",       isLaudo: true  },
  ];

  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Eng. Caixa — Acompanhamento</p>
      <div className="space-y-2">
        {steps.map(({ field, dtField, label, isLaudo }) => {
          const done = eng[field] === "concluido";
          const dt = eng[dtField];
          return (
            <button
              key={field}
              type="button"
              disabled={saving}
              onClick={() => handleStep(field, dtField, isLaudo)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                done
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                done ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
              }`}>
                {done && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
              </div>
              <span className={`text-[13px] font-semibold flex-1 ${done ? "text-emerald-700" : "text-slate-700"}`}>
                {label}
              </span>
              {done && dt ? (
                <span className="text-[11px] text-emerald-600 font-medium">{fmtDH(dt)}</span>
              ) : isLaudo ? (
                <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                  avança para Conformidade
                </span>
              ) : (
                <span className="text-[11px] text-slate-300">Pendente</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Conformidade — padrão vazio ───────────────────────────────────────────────
const EMPTY_CONF: ConformidadeObra = {
  docsGerados: "pendente", dtDocsGerados: "",
  docsAssinados: "pendente", dtDocsAssinados: "",
  docsEnviados: "pendente", dtDocsEnviados: "",
  conforme: "pendente", dtConforme: "",
  inconforme: "pendente", dtInconforme: "",
};

// ── Seção de acompanhamento Conformidade (exibida na aba Perfil) ──────────────
function ConformidadeSection({
  obra, onSave,
}: {
  obra: Obra;
  onSave: (data: Partial<Obra>) => Promise<void>;
}) {
  const [conf, setConf] = useState<ConformidadeObra>(() => ({ ...EMPTY_CONF, ...(obra.conformidade ?? {}) }));
  const [saving, setSaving] = useState(false);

  const handleStep = useCallback(async (
    field: "docsGerados" | "docsAssinados" | "docsEnviados",
    dtField: "dtDocsGerados" | "dtDocsAssinados" | "dtDocsEnviados",
  ) => {
    const current = conf[field] as StatusItem;
    const next: StatusItem = current === "concluido" ? "pendente" : "concluido";
    const novoConf: ConformidadeObra = {
      ...conf,
      [field]: next,
      [dtField]: next === "concluido" ? new Date().toISOString() : "",
    };
    setConf(novoConf);
    setSaving(true);
    try {
      await onSave({ id: obra.id, conformidade: novoConf });
    } catch {
      setConf(conf);
    } finally {
      setSaving(false);
    }
  }, [conf, obra.id, onSave]);

  const steps: Array<{
    field: "docsGerados" | "docsAssinados" | "docsEnviados";
    dtField: "dtDocsGerados" | "dtDocsAssinados" | "dtDocsEnviados";
    label: string;
  }> = [
    { field: "docsGerados",   dtField: "dtDocsGerados",   label: "Formulários Gerados" },
    { field: "docsAssinados", dtField: "dtDocsAssinados", label: "Formulários Assinados" },
    { field: "docsEnviados",  dtField: "dtDocsEnviados",  label: "Formulários Enviados à Caixa" },
  ];

  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Conformidade — Acompanhamento</p>
      <div className="space-y-2">
        {steps.map(({ field, dtField, label }) => {
          const done = conf[field] === "concluido";
          const dt = conf[dtField];
          return (
            <button
              key={field}
              type="button"
              disabled={saving}
              onClick={() => handleStep(field, dtField)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                done
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                done ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
              }`}>
                {done && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
              </div>
              <span className={`text-[13px] font-semibold flex-1 ${done ? "text-emerald-700" : "text-slate-700"}`}>
                {label}
              </span>
              {done && dt ? (
                <span className="text-[11px] text-emerald-600 font-medium">{fmtDH(dt)}</span>
              ) : (
                <span className="text-[11px] text-slate-300">Pendente</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY_OBRA: Partial<Obra> = {
  cliente: "", cpf: "", telefone: "", cidade: "", modalidade: MODALIDADES[0],
  engenheiro: ENGENHEIROS[0] ?? "", renda_bruta: 0, valor_caixa: 0, valor_venda: 0, valor_subsidio: 0,
};

const COM_MURO_OPTS = [
  { value: "sem_muro",    label: "Sem muro" },
  { value: "com_muro",    label: "Com muro" },
  { value: "muro_parcial",label: "Muro parcial" },
];
const COM_MURO_LABEL: Record<string, string> = {
  sem_muro: "Sem muro", com_muro: "Com muro", muro_parcial: "Muro parcial",
};

interface Props {
  obra: Obra | null;
  onClose: () => void;
  onSave: (data: Partial<Obra>) => Promise<void>;
  onAvancar: (id: string, novaEtapa: EtapaObra) => Promise<void>;
  onSalvarMedicao: (obraId: string, data: Partial<Medicao>) => Promise<void>;
  onRemoverMedicao: (obraId: string, medicaoId: string) => Promise<void>;
}

export default function ModalObra({ obra, onClose, onSave, onAvancar, onSalvarMedicao, onRemoverMedicao }: Props) {
  const isNovo   = !obra;
  const [tab, setTab]     = useState<Tab>(isNovo ? "editar" : "perfil");
  const [form, setForm]   = useState<Partial<Obra>>(obra ?? EMPTY_OBRA);
  const [saving, setSaving] = useState(false);
  const [editMedicao, setEditMedicao] = useState<{ medicao: Partial<Medicao> | null } | null>(null);

  const etapaAtual = ETAPAS_OBRA.find((e) => e.id === form.etapa);
  const prox       = FLUXO_OBRA.indexOf(form.etapa ?? "contrato");
  const podeAvancar = !isNovo && prox !== -1 && prox < FLUXO_OBRA.length - 1;
  const proximaEtapa = podeAvancar ? ETAPAS_OBRA.find((e) => e.id === FLUXO_OBRA[prox + 1]) : null;

  const set = (k: keyof Obra, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = useCallback(async () => {
    if (!form.cliente?.trim()) { toast.error("Informe o nome do cliente"); return; }
    setSaving(true);
    try { await onSave(form); toast.success(isNovo ? "Obra criada!" : "Obra atualizada!"); onClose(); }
    finally { setSaving(false); }
  }, [form, isNovo, onSave, onClose]);

  const handleAvancar = useCallback(async () => {
    if (!obra?.id || !proximaEtapa) return;
    setSaving(true);
    try { await onAvancar(obra.id, proximaEtapa.id as EtapaObra); toast.success(`Avançado para ${proximaEtapa.label}!`); onClose(); }
    finally { setSaving(false); }
  }, [obra, proximaEtapa, onAvancar, onClose]);

  const tabs: [Tab, string][] = isNovo
    ? [["editar", "Dados"]]
    : [["perfil", "Perfil"], ["medicoes", "Medições"], ["docs", "Docs"], ["editar", "Editar"]];

  const medicoes = obra?.medicoes ?? [];
  const ETAPAS_POS_CONTRATO = new Set(["contrato", "execucao", "entregue"]);

  return (
    <>
      <Modal onClose={onClose} size="xl">
        <ModalHeader
          title={isNovo ? "Nova Obra" : form.cliente ?? "Obra"}
          onClose={onClose}
          subtitle={etapaAtual ? <Badge color={etapaAtual.cor}>{etapaAtual.label}</Badge> : undefined}
        />
        {/* Timeline sempre visível — acima das abas */}
        {!isNovo && obra && (
          <div className="px-5 pt-4 pb-1">
            <Timeline
              etapas={ETAPAS_OBRA}
              etapaAtual={obra.etapa}
              log={obra.log ?? []}
              gradientColors={["#10B981", "#3B82F6"]}
            />
          </div>
        )}

        <div className="border-b border-slate-100 px-5 flex gap-1">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`tab-btn ${tab === id ? "active" : ""}`}>{label}</button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto max-h-[70vh]">

          {/* ── PERFIL ───────────────────────────────────────────────────────── */}
          {tab === "perfil" && obra && (
            <div className="space-y-5">

              {/* Eng. Caixa — seção de acompanhamento */}
              {obra.etapa === "eng_caixa" && (
                <EngCaixaSection
                  obra={obra}
                  onSave={async (updates) => { await onSave({ id: obra.id, ...updates }); }}
                  onAvancar={onAvancar}
                  onClose={onClose}
                />
              )}

              {/* Conformidade — seção de acompanhamento */}
              {obra.etapa === "conformidade" && (
                <ConformidadeSection
                  obra={obra}
                  onSave={async (updates) => { await onSave({ id: obra.id, ...updates }); }}
                />
              )}

              {/* Valores — Caixa / Venda / Terreno / Tamanho / Muro */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Valor Caixa",    valor: fmtBRL(obra.valor_caixa),    cor: "text-blue-500" },
                  { label: "Valor de Venda", valor: fmtBRL(obra.valor_venda),    cor: "text-emerald-600 font-extrabold" },
                  { label: "Valor Terreno",  valor: fmtBRL(obra.valor_lote),     cor: "text-amber-600" },
                  { label: "Tamanho Imóvel", valor: obra.tamanho_imovel ?? "—",  cor: "text-slate-900" },
                  { label: "Muro",           valor: obra.com_muro ? (COM_MURO_LABEL[obra.com_muro] ?? obra.com_muro) : "—", cor: "text-slate-900" },
                ].map((f) => (
                  <div key={f.label} className="card p-3 text-center">
                    <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-wider leading-tight">{f.label}</p>
                    <p className={`text-[13px] font-bold ${f.cor}`}>{f.valor}</p>
                  </div>
                ))}
              </div>

              {/* 3. Correspondente + Contrato + Previsão */}
              {(() => {
                const corr = obra.correspondente;
                const corrLabel = corr
                  ? `${corr.nome}${corr.agencia ? ` — ${corr.agencia}` : ""}`
                  : null;
                const atrasadaPrevisao = obra.prazo_conclusao
                  && new Date(obra.prazo_conclusao) < new Date()
                  && obra.etapa !== "entregue";
                const posContrato = ETAPAS_POS_CONTRATO.has(obra.etapa);

                const CardCorrespondente = (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-3 flex-1">
                    <span className="text-lg flex-shrink-0">🏦</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Correspondente Bancário</p>
                      <p className="text-[13px] font-extrabold text-violet-900 truncate">{corrLabel ?? "—"}</p>
                    </div>
                  </div>
                );

                if (posContrato) {
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {CardCorrespondente}
                      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">📋</span>
                        <div>
                          <p className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">Assinatura do Contrato</p>
                          <p className="text-[14px] font-extrabold text-cyan-900">{fmtDate(obra.data_inicio) || "—"}</p>
                        </div>
                      </div>
                      <div className={`border rounded-xl p-3 flex items-center gap-3 ${atrasadaPrevisao ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                        <span className="text-lg flex-shrink-0">🗓</span>
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${atrasadaPrevisao ? "text-red-700" : "text-emerald-700"}`}>Previsão de Término</p>
                          <p className={`text-[14px] font-extrabold ${atrasadaPrevisao ? "text-red-900" : "text-emerald-900"}`}>{fmtDate(obra.prazo_conclusao) || "—"}</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Antes de Contrato — correspondente centralizado
                return (
                  <div className="flex justify-center">
                    <div className="w-full max-w-xs">
                      {CardCorrespondente}
                    </div>
                  </div>
                );
              })()}

              {/* 4. Dados do cliente */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Dados do Cliente</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[13px]">
                  {[
                    ["CPF",           obra.cpf],
                    ["Telefone",      obra.telefone],
                    ["Cidade",        obra.cidade],
                    ["Modalidade",    obra.modalidade],
                    ["Engenheiro",    obra.engenheiro],
                    ["PLS",           obra.pls],
                    ["Renda Bruta",   obra.renda_bruta ? fmtBRL(obra.renda_bruta) : null],
                    ["Subsídio",      obra.valor_subsidio ? fmtBRL(obra.valor_subsidio) : null],
                    ["Data Início",   fmtDate(obra.data_inicio)],
                    ["Prazo Conclusão", fmtDate(obra.prazo_conclusao)],
                    ["Tamanho Imóvel", obra.tamanho_imovel],
                    ["Muro",          obra.com_muro ? (COM_MURO_LABEL[obra.com_muro] ?? obra.com_muro) : null],
                  ].filter(([, v]) => !!v).map(([k, v]) => (
                    <div key={k as string} className="flex justify-between py-1.5 border-b border-slate-50">
                      <span className="text-slate-400">{k}</span>
                      <span className="font-semibold text-slate-900">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Observações */}
              {obra.obs && (
                <div className="bg-slate-50 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-slate-500 mb-1">Observações</p>
                  <p className="text-sm text-slate-700">{obra.obs}</p>
                </div>
              )}
            </div>
          )}

          {/* ── MEDIÇÕES ────────────────────────────────────────────────────── */}
          {tab === "medicoes" && obra && (
            <div>
              <div className="flex justify-between mb-3">
                <p className="text-[13px] font-bold text-slate-700">Medições ({medicoes.length})</p>
                <Button variant="primary" size="sm" onClick={() => setEditMedicao({ medicao: null })}>+ Medição</Button>
              </div>
              {medicoes.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Nenhuma medição cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {medicoes.map((m, i) => (
                    <div
                      key={m.id ?? i}
                      onClick={() => setEditMedicao({ medicao: m })}
                      className="card p-3.5 flex justify-between items-center cursor-pointer hover:shadow-card-hover"
                    >
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900">
                          {m.nome || `Medição ${i + 1}`}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {m.pct_solicitada != null ? `${m.pct_solicitada}% solicitado` : "% não informada"}
                          {m.data_envio_caixa ? ` · Envio: ${fmtDate(m.data_envio_caixa)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {m.status === "paga" && m.valor_liberado != null && (
                          <span className="font-bold text-emerald-600 text-[13px]">{fmtBRL(m.valor_liberado)}</span>
                        )}
                        <StatusBadgeMedicao status={m.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTOS ──────────────────────────────────────────────────── */}
          {tab === "docs" && obra && (
            <ChecklistDocumentosObra
              obra={obra}
              onSave={async (updates) => { await onSave({ ...form, ...updates }); }}
              onAvancar={async (novaEtapa) => {
                await onAvancar(obra.id, novaEtapa);
                onClose();
              }}
            />
          )}

          {/* ── EDITAR ──────────────────────────────────────────────────────── */}
          {tab === "editar" && (
            <div className="space-y-5">

              {/* Identificação */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Identificação</p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="col-span-2">
                    <label className="field-label">Nome do Cliente *</label>
                    <input value={form.cliente ?? ""} onChange={(e) => set("cliente", e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">CPF</label>
                    <input value={form.cpf ?? ""} onChange={(e) => set("cpf", maskCPF(e.target.value))} maxLength={14} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Telefone</label>
                    <input value={form.telefone ?? ""} onChange={(e) => set("telefone", maskPhone(e.target.value))} maxLength={15} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Cidade</label>
                    <select value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} className="input-base">
                      <option value="">Selecione</option>
                      {CIDADES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Modalidade</label>
                    <select value={form.modalidade ?? ""} onChange={(e) => set("modalidade", e.target.value)} className="input-base">
                      {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Imóvel */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Imóvel</p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="field-label">Tamanho do Imóvel</label>
                    <input value={form.tamanho_imovel ?? ""} onChange={(e) => set("tamanho_imovel", e.target.value)}
                      className="input-base" placeholder="Ex: 60m², 3 quartos" />
                  </div>
                  <div>
                    <label className="field-label">Muro</label>
                    <select value={form.com_muro ?? ""} onChange={(e) => set("com_muro", e.target.value || null)} className="input-base">
                      <option value="">Não informado</option>
                      {COM_MURO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Valores */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Valores Financeiros</p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="field-label">Valor Caixa</label>
                    <input type="number" min={0} value={form.valor_caixa ?? ""} onChange={(e) => set("valor_caixa", Number(e.target.value))} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Valor de Venda</label>
                    <input type="number" min={0} value={form.valor_venda ?? ""} onChange={(e) => set("valor_venda", Number(e.target.value))} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Valor Terreno (Lote)</label>
                    <input type="number" min={0} value={form.valor_lote ?? ""} onChange={(e) => set("valor_lote", Number(e.target.value))} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Subsídio</label>
                    <input type="number" min={0} value={form.valor_subsidio ?? ""} onChange={(e) => set("valor_subsidio", Number(e.target.value))} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Renda Bruta</label>
                    <input type="number" min={0} value={form.renda_bruta ?? ""} onChange={(e) => set("renda_bruta", Number(e.target.value))} className="input-base" />
                  </div>
                </div>
              </div>

              {/* Execução */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Execução</p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="field-label">Engenheiro</label>
                    <select value={form.engenheiro ?? ""} onChange={(e) => set("engenheiro", e.target.value)} className="input-base">
                      {ENGENHEIROS.map((e) => <option key={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Data Assinatura (Início)</label>
                    <input type="date" value={form.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Previsão de Término</label>
                    <input type="date" value={form.prazo_conclusao ?? ""} onChange={(e) => set("prazo_conclusao", e.target.value)} className="input-base" />
                  </div>
                  <div className="col-span-2">
                    <label className="field-label">Observações</label>
                    <textarea value={form.obs ?? ""} onChange={(e) => set("obs", e.target.value)} rows={3} className="input-base resize-none" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5 flex justify-between items-center gap-3">
          <Button variant="secondary" onClick={onClose} size="sm">Fechar</Button>
          <div className="flex gap-2">
            {tab === "editar" && (
              <Button variant="primary" onClick={handleSave} loading={saving} size="sm">
                {isNovo ? "Criar Obra" : "Salvar"}
              </Button>
            )}
            {podeAvancar && tab === "perfil" && proximaEtapa && (
              <Button variant="success" onClick={handleAvancar} loading={saving} size="sm">
                → {proximaEtapa.label}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {editMedicao !== null && obra && (
        <ModalMedicao
          obraId={obra.id}
          obraCliente={obra.cliente ?? ""}
          medicao={editMedicao.medicao}
          onClose={() => setEditMedicao(null)}
          onSave={onSalvarMedicao}
          onDelete={editMedicao.medicao?.id ? onRemoverMedicao : undefined}
        />
      )}
    </>
  );
}
