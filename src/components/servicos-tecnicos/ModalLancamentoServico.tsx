"use client";
import { useState, useCallback } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import CurrencyInput from "@/components/ui/CurrencyInput";
import { createLancamento } from "@/services/financeiro.service";
import { criarParcelasCliente } from "@/services/lancamentosServico.service";
import { CATEGORIAS_SAIDA, GRUPO_DE_CATEGORIA, FORMAS_PAGAMENTO } from "@/constants/financeiro";
import { fmtBRL } from "@/lib/utils";
import type { Servico, Lancamento, StatusPagamento } from "@/types/app.types";
import toast from "react-hot-toast";

function hoje(): string { return new Date().toISOString().slice(0, 10); }

interface Props {
  servico: Servico;
  onClose: () => void;
  onCreated: (lancamentos: Lancamento[]) => void;
}

export default function ModalLancamentoServico({ servico, onClose, onCreated }: Props) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");

  // Entrada — pagamento do cliente, com parcelamento (gera comissão junto)
  const [valorTotal, setValorTotal] = useState(0);
  const [nParcelas, setNParcelas] = useState(1);
  const [dataBase, setDataBase] = useState(hoje());
  const [forma, setForma] = useState("Pix");
  const [obs, setObs] = useState("");

  // Saída — despesa avulsa do serviço (sem parcelamento)
  const [categoriaSaida, setCategoriaSaida] = useState("");
  const [descricaoSaida, setDescricaoSaida] = useState("");
  const [valorSaida, setValorSaida] = useState(0);
  const [dataSaida, setDataSaida] = useState(hoje());
  const [statusSaida, setStatusSaida] = useState<StatusPagamento>("pendente");

  const [saving, setSaving] = useState(false);

  const temComissao = !!servico.indicador_id && (servico.indicador_pct ?? 0) > 0;
  const valorParcela = nParcelas > 0 ? valorTotal / nParcelas : valorTotal;
  const valorComissaoParcela = temComissao ? (valorParcela * (servico.indicador_pct ?? 0)) / 100 : 0;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (tipo === "entrada") {
        if (valorTotal <= 0) { toast.error("Informe o valor"); return; }
        const criados = await criarParcelasCliente({
          servico,
          nomeCliente: servico.cliente?.nome ?? "Cliente",
          valorTotal,
          nParcelas,
          dataBase,
          formaPagamento: forma,
          obs: obs || null,
        });
        onCreated(criados);
        toast.success(
          nParcelas > 1
            ? `${nParcelas} parcelas criadas${temComissao ? ` + ${nParcelas} de comissão` : ""}!`
            : "Lançamento criado!"
        );
      } else {
        if (!descricaoSaida.trim()) { toast.error("Informe a descrição"); return; }
        if (!categoriaSaida) { toast.error("Selecione a categoria"); return; }
        if (valorSaida <= 0) { toast.error("Informe o valor"); return; }
        const criado = await createLancamento({
          obra_id: null,
          servico_id: servico.id,
          tipo: "saida",
          categoria: categoriaSaida,
          grupo: GRUPO_DE_CATEGORIA[categoriaSaida] ?? null,
          descricao: descricaoSaida,
          valor: valorSaida,
          data: dataSaida,
          data_vencimento: dataSaida,
          data_confirmacao: statusSaida === "pago" ? new Date().toISOString() : null,
          forma_pagamento: forma,
          status_pagamento: statusSaida,
          parcela_num: null,
          parcela_total: null,
          conta_bancaria_id: null,
          obs: null,
        });
        onCreated([criado]);
        toast.success("Lançamento criado!");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar lançamento.");
    } finally {
      setSaving(false);
    }
  }, [tipo, valorTotal, nParcelas, dataBase, forma, obs, servico, temComissao, onCreated, onClose, categoriaSaida, descricaoSaida, valorSaida, dataSaida, statusSaida]);

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Novo Lançamento" onClose={onClose} subtitle={servico.cliente?.nome} />
      <div className="p-5 space-y-4">
        <div className="flex gap-3">
          {(["entrada", "saida"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-colors ${
                tipo === t
                  ? t === "entrada"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-red-500 bg-red-50 text-red-700"
                  : "border-slate-200 text-slate-400 hover:border-slate-300"
              }`}
            >
              {t === "entrada" ? "⬆ Pagamento do Cliente" : "⬇ Outra Despesa"}
            </button>
          ))}
        </div>

        {tipo === "entrada" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Valor Total (R$) *</label>
                <CurrencyInput value={valorTotal} onChange={setValorTotal} className="font-bold text-emerald-600" placeholder="0,00" />
              </div>
              <div>
                <label className="field-label">Data da 1ª Parcela</label>
                <input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="field-label">Nº de Parcelas</label>
                <input
                  type="number" min={1} max={36} value={nParcelas}
                  onChange={(e) => setNParcelas(Math.max(1, Math.min(36, Number(e.target.value))))}
                  className="input-base"
                />
              </div>
              <div>
                <label className="field-label">Forma de Pagamento</label>
                <select value={forma} onChange={(e) => setForma(e.target.value)} className="input-base">
                  {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="field-label">Observações</label>
              <input value={obs} onChange={(e) => setObs(e.target.value)} className="input-base" placeholder="Opcional" />
            </div>

            {valorTotal > 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-1.5 text-[12px]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">{nParcelas}x de</span>
                  <span className="font-bold text-emerald-600">{fmtBRL(valorParcela)}</span>
                </div>
                {temComissao && (
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                    <span className="text-slate-500">Comissão ({servico.indicador?.nome ?? "indicador"}, {servico.indicador_pct}%)</span>
                    <span className="font-bold text-purple-500">{nParcelas}x de {fmtBRL(valorComissaoParcela)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="field-label">Categoria *</label>
              <select value={categoriaSaida} onChange={(e) => setCategoriaSaida(e.target.value)} className="input-base">
                <option value="">Selecione a categoria</option>
                {Object.entries(CATEGORIAS_SAIDA).map(([grp, itens]) => (
                  <optgroup key={grp} label={grp}>
                    {itens.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Descrição *</label>
              <input value={descricaoSaida} onChange={(e) => setDescricaoSaida(e.target.value)} className="input-base" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Valor (R$) *</label>
                <CurrencyInput value={valorSaida} onChange={setValorSaida} className="font-bold text-red-500" placeholder="0,00" />
              </div>
              <div>
                <label className="field-label">Data</label>
                <input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="field-label">Forma de Pagamento</label>
                <select value={forma} onChange={(e) => setForma(e.target.value)} className="input-base">
                  {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select value={statusSaida} onChange={(e) => setStatusSaida(e.target.value as StatusPagamento)} className="input-base">
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" size="sm" onClick={handleSave} loading={saving}>
            {tipo === "entrada" && nParcelas > 1 ? `Gerar ${nParcelas} parcelas` : "Criar Lançamento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
