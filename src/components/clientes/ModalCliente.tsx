"use client";
import { useState, useEffect, useCallback } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { getLeadsPorCliente } from "@/services/leads.service";
import { getObrasPorCliente } from "@/services/obras.service";
import { getServicosPorCliente } from "@/services/servicos.service";
import { ETAPAS_LEAD, ETAPAS_OBRA, ETAPAS_SERVICO } from "@/constants/etapas";
import { fmtDate } from "@/lib/utils";
import type { Cliente } from "@/types/app.types";
import toast from "react-hot-toast";

type Tab = "dados" | "historico";

interface MovimentacaoItem {
  id: string;
  origem: "Comercial" | "Obras" | "Serviços Técnicos";
  nome: string;
  etapaLabel: string;
  etapaCor: string;
  data: string;
}

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
  onSave: (data: Partial<Cliente>) => Promise<void>;
}

export default function ModalCliente({ cliente, onClose, onSave }: Props) {
  const isNovo = !cliente;
  const [tab, setTab] = useState<Tab>("dados");
  const [form, setForm] = useState<Partial<Cliente>>(
    cliente ?? { nome: "", cpf_cnpj: "", telefone: "", email: "" }
  );
  const [saving, setSaving] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoItem[] | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  const set = (k: keyof Cliente, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const carregarHistorico = useCallback(async () => {
    if (!cliente?.id) return;
    setCarregandoHistorico(true);
    try {
      const [leads, obras, servicos] = await Promise.all([
        getLeadsPorCliente(cliente.id),
        getObrasPorCliente(cliente.id),
        getServicosPorCliente(cliente.id),
      ]);

      const itensLead: MovimentacaoItem[] = leads.map((l) => {
        const etapa = ETAPAS_LEAD.find((e) => e.id === l.etapa);
        return {
          id: `lead-${l.id}`,
          origem: "Comercial",
          nome: l.nome,
          etapaLabel: etapa?.label ?? l.etapa,
          etapaCor: etapa?.cor ?? "#6B7280",
          data: l.created_at,
        };
      });

      const itensObra: MovimentacaoItem[] = obras.map((o) => {
        const etapa = ETAPAS_OBRA.find((e) => e.id === o.etapa);
        return {
          id: `obra-${o.id}`,
          origem: "Obras",
          nome: o.cliente ?? o.nome ?? "Obra",
          etapaLabel: etapa?.label ?? o.etapa,
          etapaCor: etapa?.cor ?? "#6B7280",
          data: o.created_at,
        };
      });

      const itensServico: MovimentacaoItem[] = servicos.map((s) => {
        const etapa = ETAPAS_SERVICO.find((e) => e.id === s.etapa);
        return {
          id: `servico-${s.id}`,
          origem: "Serviços Técnicos",
          nome: s.catalogoServico?.nome ?? "Serviço",
          etapaLabel: etapa?.label ?? s.etapa,
          etapaCor: etapa?.cor ?? "#6B7280",
          data: s.created_at,
        };
      });

      setMovimentacoes(
        [...itensLead, ...itensObra, ...itensServico].sort((a, b) => (a.data < b.data ? 1 : -1))
      );
    } catch {
      toast.error("Erro ao carregar histórico do cliente.");
    } finally {
      setCarregandoHistorico(false);
    }
  }, [cliente?.id]);

  useEffect(() => {
    if (tab === "historico" && movimentacoes === null) carregarHistorico();
  }, [tab, movimentacoes, carregarHistorico]);

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome do cliente"); return; }
    setSaving(true);
    try {
      await onSave(form);
      toast.success(isNovo ? "Cliente criado!" : "Cliente atualizado!");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title={isNovo ? "Novo Cliente" : form.nome ?? "Cliente"} onClose={onClose} />

      {!isNovo && (
        <div className="border-b border-slate-100 px-5 flex gap-1">
          <button onClick={() => setTab("dados")} className={`tab-btn ${tab === "dados" ? "active" : ""}`}>Dados</button>
          <button onClick={() => setTab("historico")} className={`tab-btn ${tab === "historico" ? "active" : ""}`}>Histórico de Movimentações</button>
        </div>
      )}

      {tab === "dados" && (
        <div className="p-5 space-y-3">
          <div>
            <label className="field-label">Nome *</label>
            <input
              value={form.nome ?? ""}
              onChange={(e) => set("nome", e.target.value)}
              className="input-base"
              placeholder="Nome do cliente"
            />
          </div>

          <div>
            <label className="field-label">CPF/CNPJ</label>
            <input
              value={form.cpf_cnpj ?? ""}
              onChange={(e) => set("cpf_cnpj", e.target.value)}
              className="input-base"
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <label className="field-label">Telefone</label>
            <input
              value={form.telefone ?? ""}
              onChange={(e) => set("telefone", e.target.value)}
              className="input-base"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className="field-label">E-mail</label>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              className="input-base"
              placeholder="email@cliente.com"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" className="flex-1" size="sm" onClick={handleSave} loading={saving}>
              {isNovo ? "Criar Cliente" : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {tab === "historico" && (
        <div className="p-5">
          {carregandoHistorico && (
            <p className="text-xs text-slate-400">Carregando histórico...</p>
          )}
          {!carregandoHistorico && movimentacoes?.length === 0 && (
            <p className="text-xs text-slate-400">Nenhuma movimentação encontrada para esse cliente ainda.</p>
          )}
          {!carregandoHistorico && movimentacoes && movimentacoes.length > 0 && (
            <ul className="space-y-2">
              {movimentacoes.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{m.nome}</p>
                    <p className="text-[10px] text-slate-400">
                      {m.origem} · {fmtDate(m.data)}
                    </p>
                  </div>
                  <Badge color={m.etapaCor}>{m.etapaLabel}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
