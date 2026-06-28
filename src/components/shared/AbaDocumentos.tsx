"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getDocumentos,
  uploadDocumento,
  getDocumentoUrl,
  deleteDocumento,
} from "@/services/documentos.service";
import type { Documento, EtapaObra } from "@/types/app.types";
import toast from "react-hot-toast";

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface TipoDoc {
  id: string;
  label: string;
  multiple?: boolean;
  opcional?: boolean;
  accept?: string;
  condition?: (ctx: Ctx) => boolean;
}

interface Subsecao {
  id: string;
  titulo: string;
  tipos: TipoDoc[];
  condition?: (ctx: Ctx) => boolean;
}

interface Secao {
  id: string;
  numero: string;
  titulo: string;
  tipos: TipoDoc[];
  subsecoes?: Subsecao[];
}

interface Ctx {
  com_conjuge?: boolean;
  dependente?: boolean;
  tipo_renda?: string | null;
  fgts_3anos?: boolean;
  etapa?: EtapaObra;
}

// ── Ordem das etapas de obra ──────────────────────────────────────────────────

const ORDEM: EtapaObra[] = [
  "projeto", "licencas", "eng_caixa", "conformidade",
  "contrato", "execucao", "entregue",
];

function gte(atual: EtapaObra | undefined, minima: EtapaObra): boolean {
  if (!atual) return false;
  return ORDEM.indexOf(atual) >= ORDEM.indexOf(minima);
}

// ── Configuração das seções ───────────────────────────────────────────────────

const RENDA_CLT = new Set(["CLT", "Carteira Assinada", "Funcionário Público"]);

function buildSecoes(ctx: Ctx): Secao[] {
  const secoes: Secao[] = [
    {
      id: "pessoal",
      numero: "1",
      titulo: "Docs Pessoais",
      tipos: [
        { id: "cnh_rg",            label: "CNH ou RG" },
        { id: "comp_residencia",   label: "Comprovante de Residência" },
        { id: "comp_estado_civil", label: "Comprovante de Estado Civil" },
        { id: "ctps",              label: "Carteira de Trabalho Digital" },
        {
          id: "extrato_fgts", label: "Extrato do FGTS",
          condition: (c) => !!(c.fgts_3anos || (c.tipo_renda && RENDA_CLT.has(c.tipo_renda))),
        },
        { id: "comp_renda", label: "Comprovante de Renda", multiple: true },
      ],
      subsecoes: [
        {
          id: "conjuge",
          titulo: "Documentos do Cônjuge",
          condition: (c) => !!c.com_conjuge,
          tipos: [
            { id: "cnh_rg",     label: "CNH ou RG" },
            { id: "ctps",       label: "Carteira de Trabalho Digital" },
            { id: "comp_renda", label: "Comprovante de Renda", multiple: true },
          ],
        },
        {
          id: "dependente_1",
          titulo: "Documentos do Dependente",
          condition: (c) => !!c.dependente,
          tipos: [
            { id: "cnh_rg",                label: "CNH ou RG" },
            { id: "certidao_nascimento",   label: "Certidão de Nascimento" },
            { id: "declaracao_parentesco", label: "Declaração de Parentesco" },
          ],
        },
      ],
    },
  ];

  if (ctx.etapa && gte(ctx.etapa, "projeto")) {
    secoes.push({
      id: "projetos",
      numero: "2",
      titulo: "Projetos",
      tipos: [
        { id: "projeto_arq",  label: "Projeto Arquitetônico" },
        { id: "projeto_comp", label: "Projeto Complementar", opcional: true },
      ],
    });
  }

  if (ctx.etapa && gte(ctx.etapa, "licencas")) {
    secoes.push({
      id: "engenharia",
      numero: "3",
      titulo: "Engenharia e Conformidade",
      tipos: [
        { id: "art",               label: "ART" },
        { id: "pci",               label: "PCI" },
        { id: "projeto_legal",     label: "Projeto Legal Aprovado" },
        { id: "uso_ocupacao",      label: "Uso e Ocupação do Solo", opcional: true },
        { id: "memorial",          label: "Memorial Descritivo" },
        { id: "alvara",            label: "Alvará de Construção" },
        { id: "inteiro_teor",      label: "Inteiro Teor do Lote" },
        { id: "situacao_juridica", label: "Situação Jurídica / Certidão de Ônus" },
        { id: "cnd_iptu",          label: "CND IPTU" },
        { id: "cnd_itbi",          label: "CND ITBI" },
        { id: "cno",               label: "CNO" },
        { id: "scpo",              label: "SCPO" },
      ],
    });
  }

  if (ctx.etapa && gte(ctx.etapa, "contrato")) {
    secoes.push({
      id: "contrato",
      numero: "4",
      titulo: "Contrato",
      tipos: [
        { id: "contrato_assinado", label: "Contrato Assinado" },
        { id: "registro_contrato", label: "Registro de Contrato" },
      ],
    });
  }

  return secoes;
}

const PLS_NUMS = ["01", "02", "03", "04", "05"];

const PLS_TIPOS: TipoDoc[] = [
  { id: "excel", label: "Planilha Excel", accept: ".xlsx,.xls,.ods,.csv" },
  { id: "pdf",   label: "Relatório PDF",  accept: ".pdf" },
  { id: "fotos", label: "Fotos da Medição", multiple: true, accept: "image/*" },
];

// ── Utilitários ───────────────────────────────────────────────────────────────

function fmtBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024)        return `${n} B`;
  if (n < 1_048_576)   return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function fmtDt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Ícones SVG ────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v8M4 4l3-3 3 3M2 11v.5A.5.5 0 002.5 12h9a.5.5 0 00.5-.5V11"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5M1 10v.5A.5.5 0 001.5 11h9a.5.5 0 00.5-.5V10"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6.5v4M8.5 6.5v4M3 3.5l.667 7.5a.5.5 0 00.5.5h5.667a.5.5 0 00.5-.5L11 3.5"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8 1H3a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5L8 1z"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 1v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── FileRow ───────────────────────────────────────────────────────────────────

function FileRow({
  doc, label, onDelete,
}: {
  doc: Documento;
  label?: string;
  onDelete: (doc: Documento) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const url = await getDocumentoUrl(doc.storage_path);
      window.open(url, "_blank");
    } catch {
      toast.error("Erro ao baixar arquivo");
    } finally { setBusy(false); }
  };

  const handleDel = async () => {
    if (!confirm(`Remover "${doc.nome_arquivo}"?`)) return;
    setBusy(true);
    try { await onDelete(doc); }
    catch { toast.error("Erro ao remover"); setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-blue-50 border border-blue-100 rounded-lg">
      <span className="text-blue-400 flex-shrink-0"><IconFile /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-slate-800 truncate">{label ?? doc.nome_arquivo}</p>
        <p className="text-[10px] text-slate-400 truncate">
          {doc.nome_arquivo} · {fmtBytes(doc.tamanho_bytes)} · {fmtDt(doc.created_at)}
        </p>
      </div>
      <button onClick={handleDownload} disabled={busy}
        title="Baixar" className="text-blue-400 hover:text-blue-600 p-1 disabled:opacity-40 flex-shrink-0">
        <IconDownload />
      </button>
      <button onClick={handleDel} disabled={busy}
        title="Remover" className="text-slate-300 hover:text-red-400 p-1 disabled:opacity-40 flex-shrink-0">
        <IconTrash />
      </button>
    </div>
  );
}

// ── DocTypeRow ─────────────────────────────────────────────────────────────────

function DocTypeRow({
  tipo, docs, leadId, obraId, secao, onUploaded, onDeleted,
}: {
  tipo: TipoDoc;
  docs: Documento[];
  leadId?: string;
  obraId?: string;
  secao: string;
  onUploaded: (doc: Documento) => void;
  onDeleted: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const typeDocs = docs.filter((d) => d.tipo_doc === tipo.id);
  const hasDoc = typeDocs.length > 0;
  const canUpload = tipo.multiple || !hasDoc;

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const novo = await uploadDocumento({
          file, lead_id: leadId, obra_id: obraId, secao, tipo_doc: tipo.id,
        });
        onUploaded(novo);
      }
      toast.success(files.length > 1 ? `${files.length} arquivos enviados!` : "Arquivo enviado!");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: Documento) => {
    await deleteDocumento(doc);
    onDeleted(doc.id);
  };

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700">{tipo.label}</span>
          {tipo.opcional && (
            <span className="text-[9px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">opcional</span>
          )}
        </div>
        {canUpload && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 font-semibold disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <span className="text-slate-400">Enviando...</span>
            ) : (
              <><IconUpload /><span>{tipo.multiple && hasDoc ? "Adicionar" : "Enviar"}</span></>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={tipo.multiple}
          accept={tipo.accept ?? "*/*"}
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      <div className="space-y-1">
        {typeDocs.map((doc, idx) => (
          <FileRow
            key={doc.id}
            doc={doc}
            label={tipo.multiple ? `${tipo.label} ${idx + 1}` : undefined}
            onDelete={handleDelete}
          />
        ))}
        {!hasDoc && (
          <div className="py-2 px-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center">
            <p className="text-[11px] text-slate-300">Nenhum arquivo enviado</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Accordion ──────────────────────────────────────────────────────────────────

function Accordion({
  numero, titulo, badgeCount, defaultOpen = false, children,
}: {
  numero: string;
  titulo: string;
  badgeCount?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 bg-blue-500 text-white rounded-lg text-[12px] font-bold flex items-center justify-center flex-shrink-0">
            {numero}
          </span>
          <span className="text-[13px] font-bold text-slate-800">{titulo}</span>
          {!!badgeCount && badgeCount > 0 && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
              {badgeCount} arquivo{badgeCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="px-4 pt-3 pb-4 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}

function SubAccordion({
  titulo, badgeCount, children,
}: {
  titulo: string;
  badgeCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden mb-2 ml-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-slate-700">{titulo}</span>
          {!!badgeCount && badgeCount > 0 && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
              {badgeCount}
            </span>
          )}
        </div>
        <span className={`text-slate-400 text-[11px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="px-3 pt-2.5 pb-3 border-t border-slate-100 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

interface Props {
  leadId?: string;
  obraId?: string;
  etapa?: EtapaObra;
  comConjuge?: boolean;
  dependente?: boolean;
  tipoRenda?: string | null;
  fgts3anos?: boolean;
}

export default function AbaDocumentos({
  leadId, obraId, etapa, comConjuge, dependente, tipoRenda, fgts3anos,
}: Props) {
  const [docs, setDocs]       = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId && !obraId) { setLoading(false); return; }
    setLoading(true);
    getDocumentos({ lead_id: leadId, obra_id: obraId })
      .then(setDocs)
      .catch(() => toast.error("Erro ao carregar documentos"))
      .finally(() => setLoading(false));
  }, [leadId, obraId]);

  const onUploaded = useCallback((doc: Documento) => {
    setDocs((prev) => [...prev, doc]);
  }, []);

  const onDeleted = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Se há lead_id, todos os uploads usam lead_id (garante continuidade Comercial → Obras)
  const uploadLeadId = leadId;
  const uploadObraId = leadId ? undefined : obraId;

  const ctx: Ctx = { com_conjuge: comConjuge, dependente, tipo_renda: tipoRenda, fgts_3anos: fgts3anos, etapa };
  const secoes = buildSecoes(ctx);

  const secaoDocs  = (id: string) => docs.filter((d) => d.secao === id && d.ativo !== false);
  const secaoCount = (id: string) => secaoDocs(id).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">Carregando documentos...</p>
      </div>
    );
  }

  if (!leadId && !obraId) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-400">Salve o cadastro primeiro para habilitar documentos.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Seções principais */}
      {secoes.map((sec) => (
        <Accordion
          key={sec.id}
          numero={sec.numero}
          titulo={sec.titulo}
          badgeCount={secaoCount(sec.id)}
          defaultOpen={sec.id === "pessoal"}
        >
          {/* Tipos de documento */}
          {sec.tipos.map((tipo) => {
            if (tipo.condition && !tipo.condition(ctx)) return null;
            return (
              <DocTypeRow
                key={tipo.id}
                tipo={tipo}
                docs={secaoDocs(sec.id)}
                leadId={uploadLeadId}
                obraId={uploadObraId}
                secao={sec.id}
                onUploaded={onUploaded}
                onDeleted={onDeleted}
              />
            );
          })}

          {/* Subseções (cônjuge, dependente) */}
          {sec.subsecoes?.map((sub) => {
            if (sub.condition && !sub.condition(ctx)) return null;
            return (
              <SubAccordion key={sub.id} titulo={sub.titulo} badgeCount={secaoCount(sub.id)}>
                {sub.tipos.map((tipo) => (
                  <DocTypeRow
                    key={tipo.id}
                    tipo={tipo}
                    docs={secaoDocs(sub.id)}
                    leadId={uploadLeadId}
                    obraId={uploadObraId}
                    secao={sub.id}
                    onUploaded={onUploaded}
                    onDeleted={onDeleted}
                  />
                ))}
              </SubAccordion>
            );
          })}
        </Accordion>
      ))}

      {/* Seção 5 — Medições / PLS (somente a partir de execucao) */}
      {etapa && gte(etapa, "execucao") && (
        <Accordion
          numero="5"
          titulo="Medições"
          badgeCount={docs.filter((d) => d.secao.startsWith("medicoes_")).length}
        >
          {PLS_NUMS.map((pls) => {
            const secaoId = `medicoes_pls_${pls}`;
            return (
              <SubAccordion key={pls} titulo={`PLS ${pls}`} badgeCount={secaoCount(secaoId)}>
                {PLS_TIPOS.map((tipo) => (
                  <DocTypeRow
                    key={tipo.id}
                    tipo={tipo}
                    docs={secaoDocs(secaoId)}
                    leadId={uploadLeadId}
                    obraId={uploadObraId}
                    secao={secaoId}
                    onUploaded={onUploaded}
                    onDeleted={onDeleted}
                  />
                ))}
              </SubAccordion>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
