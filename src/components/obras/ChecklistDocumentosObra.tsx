"use client";
import { useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import type { Obra, StatusItem, EtapaObra } from "@/types/app.types";
import type { ProjetoObra, LicencasObra, EngCaixaObra, ConformidadeObra } from "@/types/app.types";
import toast from "react-hot-toast";

interface Props {
  obra: Obra;
  onSave: (updates: Partial<Obra>) => Promise<void>;
  onAvancar?: (novaEtapa: EtapaObra) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMPTY_PROJETO: ProjetoObra = {
  arquitetonico: "pendente", dtArquitetonico: "",
  complementares: "pendente", dtComplementares: "",
};
const EMPTY_LICENCAS: LicencasObra = {
  art: "pendente", dtArt: "",
  pci: "pendente", dtPci: "",
  projetoLegal: "pendente", dtProjetoLegalSolicitado: "", dtProjetoLegalAprovado: "",
  usoOcupacao: "pendente", dtUsoOcupacaoSolicitado: "", dtUsoOcupacaoAprovado: "",
};
const EMPTY_ENG: EngCaixaObra = {
  enviado: "pendente", dtEnviado: "",
  solicitado: "pendente", dtSolicitado: "",
  boletoPago: "pendente", dtBoletoPago: "",
  vistoriaRealizada: "pendente", dtVistoria: "",
  laudoEmitido: "pendente", dtLaudo: "",
};
const EMPTY_CONF: ConformidadeObra = {
  docsGerados: "pendente", dtDocsGerados: "",
  docsAssinados: "pendente", dtDocsAssinados: "",
  docsEnviados: "pendente", dtDocsEnviados: "",
  conforme: "pendente", dtConforme: "",
  inconforme: "pendente", dtInconforme: "",
};

function inicialProjetoObra(raw: unknown): ProjetoObra {
  const r = (raw as ProjetoObra) ?? {};
  return { ...EMPTY_PROJETO, ...r };
}
function inicialLicencas(raw: unknown): LicencasObra {
  const r = (raw as LicencasObra) ?? {};
  return { ...EMPTY_LICENCAS, ...r };
}
function inicialEngCaixa(raw: unknown): EngCaixaObra {
  const r = (raw as EngCaixaObra) ?? {};
  return { ...EMPTY_ENG, ...r };
}
function inicialConf(raw: unknown): ConformidadeObra {
  const r = (raw as ConformidadeObra) ?? {};
  return { ...EMPTY_CONF, ...r };
}

function statusIcon(s: StatusItem): string {
  if (s === "concluido")      return "✅";
  if (s === "nao_necessario") return "⊘";
  return "⬜";
}
function nextStatus(s: StatusItem, optional: boolean): StatusItem {
  if (s === "pendente")       return "concluido";
  if (s === "concluido")      return optional ? "nao_necessario" : "pendente";
  return "pendente"; // nao_necessario → pendente
}

// ── Item de Checklist ─────────────────────────────────────────────────────────
function CheckItem({
  label, status, optional, onToggle, dataField, onDate,
}: {
  label: string;
  status: StatusItem;
  optional?: boolean;
  onToggle: () => void;
  dataField?: string;
  onDate?: (v: string) => void;
}) {
  const concluido    = status === "concluido";
  const naoNecessario = status === "nao_necessario";
  return (
    <div className={`rounded-lg border px-3.5 py-3 mb-2 transition-colors ${
      concluido     ? "border-emerald-200 bg-emerald-50"
      : naoNecessario ? "border-slate-200 bg-slate-50"
      : "border-slate-200 bg-white"
    }`}>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="text-lg cursor-pointer flex-shrink-0 leading-none"
          title={optional ? "Clique: pendente → concluído → não necessário → pendente" : "Clique para alternar"}
        >
          {statusIcon(status)}
        </button>
        <span className={`text-[13px] flex-1 font-semibold ${
          concluido ? "text-emerald-700 line-through" : naoNecessario ? "text-slate-400 line-through" : "text-slate-800"
        }`}>
          {label}
        </span>
        {optional && !concluido && (
          <span className="text-[10px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded">opcional</span>
        )}
      </div>
      {concluido && onDate && (
        <div className="mt-2 ml-8">
          <label className="text-[10px] text-emerald-600 font-bold mr-2">Data:</label>
          <input
            type="date"
            value={dataField ?? ""}
            onChange={(e) => onDate(e.target.value)}
            className="text-[11px] border border-emerald-200 rounded px-2 py-0.5 text-emerald-700 bg-white"
          />
        </div>
      )}
    </div>
  );
}

// ── Barra de progresso do checklist ──────────────────────────────────────────
function ProgressoChecklist({ total, concluidos, naoNecessarios }: { total: number; concluidos: number; naoNecessarios: number }) {
  const efetivos = total - naoNecessarios;
  const pct = efetivos > 0 ? Math.round((concluidos / efetivos) * 100) : 100;
  return (
    <div className="mb-4">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-slate-500">{concluidos}/{efetivos} itens concluídos</span>
        <span className="font-bold text-blue-600">{pct}%</span>
      </div>
      <div className="bg-slate-100 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChecklistDocumentosObra({ obra, onSave, onAvancar }: Props) {
  const [saving, setSaving] = useState(false);

  // Estado local de cada checklist
  const [projeto,      setProjeto]     = useState<ProjetoObra>(() => inicialProjetoObra(obra.projeto));
  const [licencas,     setLicencas]    = useState<LicencasObra>(() => inicialLicencas(obra.licencas));
  const [engCaixa,     setEngCaixa]    = useState<EngCaixaObra>(() => inicialEngCaixa(obra.eng_caixa));
  const [conformidade, setConformidade]= useState<ConformidadeObra>(() => inicialConf(obra.conformidade));

  const salvar = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({ projeto, licencas, eng_caixa: engCaixa, conformidade });
      toast.success("Checklist salvo!");
    } finally {
      setSaving(false);
    }
  }, [onSave, projeto, licencas, engCaixa, conformidade]);

  // Auto-avanço eng_caixa → conformidade quando laudo é emitido
  const handleLaudoToggle = useCallback(async () => {
    const novoStatus = nextStatus(engCaixa.laudoEmitido, false);
    const novoEng = { ...engCaixa, laudoEmitido: novoStatus, dtLaudo: novoStatus === "concluido" ? new Date().toISOString().split("T")[0] : engCaixa.dtLaudo };
    setEngCaixa(novoEng);

    if (novoStatus === "concluido" && obra.etapa === "eng_caixa" && onAvancar) {
      setSaving(true);
      try {
        await onSave({ eng_caixa: novoEng });
        toast.success("Laudo emitido! Avançando para Conformidade...");
        await onAvancar("conformidade");
      } finally {
        setSaving(false);
      }
    }
  }, [engCaixa, obra.etapa, onSave, onAvancar]);

  const etapa = obra.etapa;

  // ── PROJETO ───────────────────────────────────────────────────────────────
  if (etapa === "projeto") {
    const concluidos = [projeto.arquitetonico, projeto.complementares].filter((s) => s === "concluido").length;
    const naoNec     = [projeto.complementares].filter((s) => s === "nao_necessario").length;
    return (
      <div>
        <div className="mb-4">
          <p className="text-[13px] font-bold text-slate-900 mb-1">Etapa: Projeto</p>
          <p className="text-[11px] text-slate-400">Gerencie os projetos necessários para avançar à etapa de Licenças.</p>
        </div>
        <ProgressoChecklist total={2} concluidos={concluidos} naoNecessarios={naoNec} />
        <CheckItem
          label="Projeto Arquitetônico"
          status={projeto.arquitetonico}
          onToggle={() => setProjeto((p) => ({ ...p, arquitetonico: nextStatus(p.arquitetonico, false) }))}
          dataField={projeto.dtArquitetonico}
          onDate={(v) => setProjeto((p) => ({ ...p, dtArquitetonico: v }))}
        />
        <CheckItem
          label="Projetos Complementares"
          status={projeto.complementares}
          optional
          onToggle={() => setProjeto((p) => ({ ...p, complementares: nextStatus(p.complementares, true) }))}
          dataField={projeto.dtComplementares}
          onDate={(v) => setProjeto((p) => ({ ...p, dtComplementares: v }))}
        />
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-[11px] text-blue-700">
          <strong>Dica:</strong> Se os Projetos Complementares não são necessários para esta obra, clique duas vezes no item para marcá-lo como <em>&quot;Não necessário&quot;</em> — isso não trava o avanço da etapa.
        </div>
        <Button variant="primary" size="sm" onClick={salvar} loading={saving}>Salvar Checklist</Button>
      </div>
    );
  }

  // ── LICENÇAS ──────────────────────────────────────────────────────────────
  if (etapa === "licencas") {
    const todos = [licencas.art, licencas.pci, licencas.projetoLegal, licencas.usoOcupacao];
    const concluidos = todos.filter((s) => s === "concluido").length;
    const naoNec     = [licencas.usoOcupacao].filter((s) => s === "nao_necessario").length;
    return (
      <div>
        <div className="mb-4">
          <p className="text-[13px] font-bold text-slate-900 mb-1">Etapa: Licenças</p>
          <p className="text-[11px] text-slate-400">Documentos e aprovações junto aos órgãos municipais.</p>
        </div>
        <ProgressoChecklist total={4} concluidos={concluidos} naoNecessarios={naoNec} />
        <CheckItem
          label="ART (Anotação de Responsabilidade Técnica)"
          status={licencas.art}
          onToggle={() => setLicencas((p) => ({ ...p, art: nextStatus(p.art, false) }))}
          dataField={licencas.dtArt}
          onDate={(v) => setLicencas((p) => ({ ...p, dtArt: v }))}
        />
        <CheckItem
          label="PCI"
          status={licencas.pci}
          onToggle={() => setLicencas((p) => ({ ...p, pci: nextStatus(p.pci, false) }))}
          dataField={licencas.dtPci}
          onDate={(v) => setLicencas((p) => ({ ...p, dtPci: v }))}
        />
        <CheckItem
          label="Projeto Legal Aprovado"
          status={licencas.projetoLegal}
          onToggle={() => setLicencas((p) => ({ ...p, projetoLegal: nextStatus(p.projetoLegal, false) }))}
          dataField={licencas.dtProjetoLegalAprovado}
          onDate={(v) => setLicencas((p) => ({ ...p, dtProjetoLegalAprovado: v }))}
        />
        <CheckItem
          label="Uso e Ocupação do Solo"
          status={licencas.usoOcupacao}
          optional
          onToggle={() => setLicencas((p) => ({ ...p, usoOcupacao: nextStatus(p.usoOcupacao, true) }))}
          dataField={licencas.dtUsoOcupacaoAprovado}
          onDate={(v) => setLicencas((p) => ({ ...p, dtUsoOcupacaoAprovado: v }))}
        />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-[11px] text-amber-700">
          <strong>Atenção:</strong> &quot;Uso e Ocupação do Solo&quot; é exigido apenas por algumas prefeituras. Marque como <em>&quot;Não necessário&quot;</em> se não for o caso desta cidade.
        </div>
        <Button variant="primary" size="sm" onClick={salvar} loading={saving}>Salvar Checklist</Button>
      </div>
    );
  }

  // ── ENG. CAIXA — gerenciado direto na aba Perfil ──────────────────────────
  if (etapa === "eng_caixa") {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-[13px] font-semibold text-slate-600 mb-2">Etapa: Engenharia Caixa</p>
        <p className="text-[12px] text-slate-400">
          Os marcos desta etapa (Solicitado à Caixa, Boleto Pago, Vistoria, Laudo) são<br />
          gerenciados diretamente na aba <strong className="text-slate-600">Perfil</strong> da obra.
        </p>
      </div>
    );
  }

  // ── CONFORMIDADE — gerenciado direto na aba Perfil ───────────────────────
  if (etapa === "conformidade") {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-[13px] font-semibold text-slate-600 mb-2">Etapa: Conformidade</p>
        <p className="text-[12px] text-slate-400">
          Os formulários desta etapa (Gerados, Assinados, Enviados) são<br />
          gerenciados diretamente na aba <strong className="text-slate-600">Perfil</strong> da obra.
        </p>
      </div>
    );
  }

  // ── Outras etapas: não há checklist específico ────────────────────────────
  const etapaLabels: Record<string, string> = {
    contrato:  "Contrato",
    execucao:  "Execução",
    entregue:  "Entregue",
  };
  return (
    <div className="text-center py-12 text-slate-400">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-sm font-semibold text-slate-500">
        {etapaLabels[etapa] ? `Etapa "${etapaLabels[etapa]}"` : "Etapa atual"} não possui checklist específico.
      </p>
      <p className="text-xs mt-1">Use as abas Perfil e Medições para acompanhar o andamento.</p>
    </div>
  );
}
