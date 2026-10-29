"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getDocumentos, uploadDocumento, getDocumentoUrl, deleteDocumento } from "@/services/documentos.service";
import { registrarHistorico } from "@/services/historico.service";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissoes } from "@/hooks/usePermissoes";
import type { Documento } from "@/types/app.types";
import toast from "react-hot-toast";

// Serviços Técnicos não tem um checklist fixo de documentos obrigatórios
// (isso é específico do financiamento Caixa em Obras/AbaDocumentos.tsx) —
// aqui é upload livre, reaproveitando a mesma tabela `documentos` e o mesmo
// serviço de storage híbrido, só com uma UI mais simples (lista + enviar).

function fmtBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function fmtDt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  servicoId: string;
}

export default function AbaArquivosServico({ servicoId }: Props) {
  const { profile } = useAuth();
  const { pode } = usePermissoes();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nomeUsuario = profile?.nome ?? "Sistema";

  const load = useCallback(() => {
    setLoading(true);
    getDocumentos({ servico_id: servicoId })
      .then(setDocs)
      .catch(() => toast.error("Erro ao carregar arquivos"))
      .finally(() => setLoading(false));
  }, [servicoId]);

  useEffect(() => { load(); }, [load]);

  const podeCriar = pode("documentos", "criar") && pode("servicos-tecnicos", "criar");
  const podeExcluir = pode("documentos", "excluir");

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const novo = await uploadDocumento({ file, servico_id: servicoId, secao: "arquivos", tipo_doc: "arquivo" });
        setDocs((prev) => [...prev, novo]);
        await registrarHistorico({
          lead_id: null, obra_id: null, servico_id: servicoId,
          tipo: "servico_tecnico", acao: `anexou o arquivo "${file.name}".`,
          usuario_nome: nomeUsuario, usuario_id: null, setor: "servicos-tecnicos", etapa: null,
        }).catch(() => {});
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
    if (!confirm(`Remover "${doc.nome_arquivo}"?`)) return;
    try {
      await deleteDocumento(doc);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      await registrarHistorico({
        lead_id: null, obra_id: null, servico_id: servicoId,
        tipo: "servico_tecnico", acao: `removeu o arquivo "${doc.nome_arquivo}".`,
        usuario_nome: nomeUsuario, usuario_id: null, setor: "servicos-tecnicos", etapa: null,
      }).catch(() => {});
    } catch {
      toast.error("Erro ao remover arquivo");
    }
  };

  const handleDownload = async (doc: Documento) => {
    const url = await getDocumentoUrl(doc.id);
    window.open(url, "_blank");
  };

  if (loading) {
    return <p className="text-xs text-slate-400 text-center py-8">Carregando arquivos...</p>;
  }

  return (
    <div>
      {podeCriar && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full border-[1.5px] border-dashed border-slate-300 bg-transparent rounded-xl py-3 text-xs text-slate-500 cursor-pointer font-semibold hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
          >
            {uploading ? "Enviando..." : "+ Enviar Arquivo"}
          </button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        </div>
      )}

      {docs.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
          <p className="text-xs text-slate-400">Nenhum arquivo enviado ainda.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 py-2 px-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 truncate">{doc.nome_arquivo}</p>
                <p className="text-[10px] text-slate-400 truncate">{fmtBytes(doc.tamanho_bytes)} · {fmtDt(doc.created_at)}</p>
              </div>
              <button onClick={() => handleDownload(doc)} title="Baixar" className="text-blue-400 hover:text-blue-600 p-1 flex-shrink-0 text-xs">
                ⬇
              </button>
              {podeExcluir && (
                <button onClick={() => handleDelete(doc)} title="Remover" className="text-slate-300 hover:text-red-400 p-1 flex-shrink-0 text-xs">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
