"use client";
import { useState, useCallback, useEffect } from "react";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Timeline from "@/components/shared/Timeline";
import StatusBadgeMedicao from "@/components/shared/StatusBadgeMedicao";
import AbaDocumentos from "@/components/shared/AbaDocumentos";
import AbaHistorico from "@/components/shared/AbaHistorico";
import { registrarHistorico } from "@/services/historico.service";
import { useAuth } from "@/contexts/AuthContext";
import ModalMedicao from "./ModalMedicao";
import { usePermissoes } from "@/hooks/usePermissoes";
import { ETAPAS_OBRA, FLUXO_OBRA, etapaAntesDoStandBy } from "@/constants/etapas";
import { CIDADES, ENGENHEIROS, MODALIDADES, ORIGENS, ORIGENS_RECURSO, TIPOS_RENDA } from "@/constants/dominios";
import { fmtBRL, fmtDate, maskCPF, maskPhone, validarCPF } from "@/lib/utils";
import { getCorrespondentes, createCorrespondente, deleteCorrespondente } from "@/services/correspondentes.service";
import { getCorretores, createCorretor, deleteCorretor } from "@/services/corretores.service";
import { buscarClientePorCpfCnpj, getCliente, updateCliente } from "@/services/clientes.service";
import ModalCliente from "@/components/clientes/ModalCliente";
import { calcularCronogramaMensal } from "@/lib/cronogramaFinanceiro";
import AvisoComposicaoVenda from "@/components/shared/AvisoComposicaoVenda";
import type {
  Obra, Medicao, EtapaObra, EngCaixaObra, ConformidadeObra, StatusItem, Correspondente, Corretor,
  ItemComposicaoCusto, EtapaCronogramaMensal, Cliente,
} from "@/types/app.types";
import toast from "react-hot-toast";

/* ───────── helper: label do correspondente ──────────────────────────────── */
function corrLabel(c: Correspondente) {
  const ag = c.agencia || c.banco || "";
  return ag ? `${c.nome} — ${ag}` : c.nome;
}

/* ───────── ícone lixeira SVG ─────────────────────────────────────────────── */
function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6.5v4M8.5 6.5v4M3 3.5l.667 7.5a.5.5 0 00.5.5h5.667a.5.5 0 00.5-.5L11 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ───────── sub-modal: Gerenciar Correspondentes ──────────────────────────── */
function ModalNovoCorrespondente({
  onClose, onSaved, onDeleted, correspondentes,
}: {
  onClose: () => void;
  onSaved: (c: Correspondente) => void;
  onDeleted: (id: string) => void;
  correspondentes: Correspondente[];
}) {
  const [form, setForm] = useState({ nome: "", contato: "", email: "", cidade: "", agencia: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const novo = await createCorrespondente({
        nome: form.nome,
        contato: form.contato || null,
        email: form.email || null,
        cidade: form.cidade || null,
        agencia: form.agencia || null,
      });
      toast.success("Correspondente cadastrado!");
      setForm({ nome: "", contato: "", email: "", cidade: "", agencia: "" });
      onSaved(novo);
    } catch {
      toast.error("Erro ao cadastrar correspondente");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCorrespondente(id);
      onDeleted(id);
    } catch {
      toast.error("Erro ao remover correspondente");
    } finally { setDeletingId(null); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Gerenciar Correspondentes" onClose={onClose} />
      <div className="p-5 space-y-4">
        {/* Lista existente */}
        <div>
          <p className="field-label mb-2">Cadastrados ({correspondentes.length})</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {correspondentes.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum correspondente cadastrado</p>
            )}
            {correspondentes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm text-slate-700">{c.nome}</span>
                  {(c.agencia || c.banco) && (
                    <span className="text-[11px] text-slate-400 ml-2">— {c.agencia || c.banco}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  title="Remover correspondente"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5 flex-shrink-0 ml-2"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Formulário de adição */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="field-label">Adicionar Novo</p>
          <div>
            <label className="field-label">Nome *</label>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className="input-base" placeholder="Ex: Genilza" />
          </div>
          <div>
            <label className="field-label">Agência / Banco</label>
            <input value={form.agencia} onChange={(e) => set("agencia", e.target.value)} className="input-base" placeholder="Ex: Agência Presidente Dutra" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Telefone</label>
              <input value={form.contato} onChange={(e) => set("contato", maskPhone(e.target.value))} maxLength={15} className="input-base" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-base" placeholder="email@banco.com" />
            </div>
          </div>
          <div>
            <label className="field-label">Cidade</label>
            <select value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className="input-base">
              <option value="">Selecione</option>
              {CIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>Cadastrar</Button>
        </div>

        <Button variant="secondary" className="w-full" onClick={onClose} size="sm">Fechar</Button>
      </div>
    </Modal>
  );
}

/* ───────── sub-modal: Gerenciar Corretores ──────────────────────────────── */
function ModalNovoCorretor({ onClose, onSaved, onDeleted, corretores }: {
  onClose: () => void;
  onSaved: (c: Corretor) => void;
  onDeleted: (id: string) => void;
  corretores: Corretor[];
}) {
  const [form, setForm] = useState({ nome: "", telefone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const novo = await createCorretor({
        nome: form.nome,
        telefone: form.telefone || null,
        email: form.email || null,
      });
      toast.success("Corretor cadastrado!");
      setForm({ nome: "", telefone: "", email: "" });
      onSaved(novo);
    } catch {
      toast.error("Erro ao cadastrar corretor");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCorretor(id);
      onDeleted(id);
    } catch {
      toast.error("Erro ao remover corretor");
    } finally { setDeletingId(null); }
  };

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Gerenciar Corretores" onClose={onClose} />
      <div className="p-5 space-y-4">
        <div>
          <p className="field-label mb-2">Cadastrados ({corretores.length})</p>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            {corretores.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum corretor cadastrado</p>
            )}
            {corretores.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm text-slate-700">{c.nome}</span>
                  {c.telefone && (
                    <span className="text-[11px] text-slate-400 ml-2">— {c.telefone}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  title="Remover corretor"
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5 flex-shrink-0 ml-2"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="field-label">Adicionar Novo</p>
          <div>
            <label className="field-label">Nome *</label>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className="input-base" placeholder="Nome completo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Telefone</label>
              <input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} maxLength={15} className="input-base" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="input-base" placeholder="email@exemplo.com" />
            </div>
          </div>
          <Button variant="primary" className="w-full" loading={saving} onClick={handleSave}>Cadastrar</Button>
        </div>

        <Button variant="secondary" className="w-full" onClick={onClose} size="sm">Fechar</Button>
      </div>
    </Modal>
  );
}

type Tab = "perfil" | "medicoes" | "cronograma" | "documentos" | "historico" | "editar";

// Incidências padrão — modelo real de PCI usado nas obras da Concretize.
// Só entra quando a obra ainda não tem composição salva; editável e
// salva por obra a partir daí.
const ITENS_COMPOSICAO_PADRAO: ItemComposicaoCusto[] = [
  { item: "Barracão + lig. provisórias (água/luz) + projetos/aprovações", incidenciaPct: 3.73 },
  { item: "Infraestrutura (estacas, brocas, baldrames, sapatas)", incidenciaPct: 7.16 },
  { item: "Supraestrutura (vigas, pilares, cintas, escadas)", incidenciaPct: 16.71 },
  { item: "Paredes e Painéis", incidenciaPct: 9.57 },
  { item: "Esquadrias", incidenciaPct: 4.42 },
  { item: "Vidros e Plásticos", incidenciaPct: 0 },
  { item: "Coberturas (estrutura e telhas)", incidenciaPct: 10.95 },
  { item: "Impermeabilizações", incidenciaPct: 2.13 },
  { item: "Revestimentos Internos", incidenciaPct: 7.65 },
  { item: "Forros", incidenciaPct: 1.15 },
  { item: "Revestimentos Externos", incidenciaPct: 4.17 },
  { item: "Pinturas", incidenciaPct: 5.16 },
  { item: "Pisos", incidenciaPct: 8.88 },
  { item: "Acabamentos (soleiras, rodapés, peitoril etc.)", incidenciaPct: 1.31 },
  { item: "Instalações Elétricas e Telefônicas", incidenciaPct: 4.28 },
  { item: "Instalações Hidráulicas", incidenciaPct: 4.07 },
  { item: "Instalações: Esgoto e Águas Pluviais", incidenciaPct: 3.98 },
  { item: "Louças e Metais", incidenciaPct: 4.35 },
  { item: "Complementos (limpeza final e calafete)", incidenciaPct: 0.35 },
  { item: "Outros (discriminar em observações)", incidenciaPct: 0 },
];

/* ─── Aba Cronograma Físico-Financeiro ────────────────────────────────────────── */
function AbaCronogramaFisicoFinanceiro({ obra, onSave }: {
  obra: Obra;
  onSave: (data: Partial<Obra>) => Promise<void>;
}) {
  const custoMaximo = (obra.valor_venda ?? 0) - ((obra.valor_venda ?? 0) * (obra.lucro_previsto_pct ?? 0)) / 100;

  const [composicao, setComposicao] = useState<ItemComposicaoCusto[]>(
    () => obra.composicao_custos ?? ITENS_COMPOSICAO_PADRAO
  );
  const [meses, setMeses] = useState<EtapaCronogramaMensal[]>(() => obra.cronograma_financeiro ?? []);
  const [numMeses, setNumMeses] = useState(obra.cronograma_financeiro?.length ?? 0);
  const [saving, setSaving] = useState(false);

  const somaIncidencia = composicao.reduce((s, c) => s + (c.incidenciaPct || 0), 0);

  const setItemPct = (idx: number, v: number) => {
    setComposicao((prev) => prev.map((c, i) => (i === idx ? { ...c, incidenciaPct: v } : c)));
  };

  const handleNumMeses = (n: number) => {
    setNumMeses(n);
    setMeses((prev) => {
      const novo = [...prev];
      while (novo.length < n) novo.push({ mes: novo.length + 1, pctAcumulado: 0 });
      return novo.slice(0, n);
    });
  };

  const setMesPct = (idx: number, v: number) => {
    setMeses((prev) => prev.map((m, i) => (i === idx ? { ...m, pctAcumulado: v } : m)));
  };

  const handleSalvar = async () => {
    setSaving(true);
    try {
      await onSave({ id: obra.id, composicao_custos: composicao, cronograma_financeiro: meses });
      toast.success("Cronograma salvo!");
    } catch {
      toast.error("Erro ao salvar cronograma");
    } finally { setSaving(false); }
  };

  // Aqui em Obras é só planejamento (Previsto) — o comparativo com o
  // Realizado fica no Financeiro por Obra, aba "Orçado × Realizado".
  const linhasComSaldo = calcularCronogramaMensal(obra, []);

  const totalEntradaPrevisto = linhasComSaldo.reduce((s, l) => s + l.entradaPrevisto, 0);
  const totalSaidaPrevisto = linhasComSaldo.reduce((s, l) => s + l.saidaPrevisto, 0);

  return (
    <div className="space-y-6">
      {/* Composição de Custos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-bold text-slate-700">Composição de Custos</p>
          <p className={`text-[11px] font-bold ${Math.abs(somaIncidencia - 100) < 0.1 ? "text-emerald-600" : "text-amber-600"}`}>
            {somaIncidencia.toFixed(2)}%{Math.abs(somaIncidencia - 100) >= 0.1 ? " (deveria somar 100%)" : ""}
          </p>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">Custo Máximo Permitido: {fmtBRL(custoMaximo)}</p>
        <div className="border border-slate-100 rounded-xl overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-bold text-slate-500">Item</th>
                <th className="text-right px-3 py-2 font-bold text-slate-500 w-24">Incidência %</th>
                <th className="text-right px-3 py-2 font-bold text-slate-500 w-32">Custo Proposto</th>
              </tr>
            </thead>
            <tbody>
              {composicao.map((c, i) => (
                <tr key={i} className="border-t border-slate-50">
                  <td className="px-3 py-1.5 text-slate-700">{c.item}</td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number" min={0} max={100} step={0.01}
                      value={c.incidenciaPct || ""}
                      onChange={(e) => setItemPct(i, e.target.value ? Number(e.target.value) : 0)}
                      className="w-full text-right border border-slate-200 rounded px-1.5 py-0.5"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-slate-700">
                    {fmtBRL((c.incidenciaPct / 100) * custoMaximo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cronograma Mensal */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-bold text-slate-700">Cronograma Mensal (Previsto)</p>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500">Duração (meses)</label>
            <input
              type="number" min={0} max={60}
              value={numMeses || ""}
              onChange={(e) => handleNumMeses(e.target.value ? Number(e.target.value) : 0)}
              className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-[12px] text-right"
            />
          </div>
        </div>

        {meses.length === 0 ? (
          <p className="text-slate-400 text-[12px] text-center py-6">Informe a duração da obra pra gerar o cronograma.</p>
        ) : (
          <div className="border border-slate-100 rounded-xl overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-2 py-2 font-bold text-slate-500">Mês</th>
                  <th className="text-right px-2 py-2 font-bold text-slate-500">% Acum.</th>
                  <th className="text-right px-2 py-2 font-bold text-emerald-600">Entr. Previsto</th>
                  <th className="text-right px-2 py-2 font-bold text-red-500">Saída Previsto</th>
                  <th className="text-right px-2 py-2 font-bold text-slate-500">Saldo Previsto</th>
                  <th className="text-right px-2 py-2 font-bold text-blue-600">Saldo Acum.</th>
                </tr>
              </thead>
              <tbody>
                {linhasComSaldo.map((l, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    <td className="px-2 py-1.5 font-semibold text-slate-700">{l.mes}ºM</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min={0} max={100} step={0.01}
                        value={meses[i]?.pctAcumulado || ""}
                        onChange={(e) => setMesPct(i, e.target.value ? Number(e.target.value) : 0)}
                        className="w-16 text-right border border-slate-200 rounded px-1 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-emerald-600">{fmtBRL(l.entradaPrevisto)}</td>
                    <td className="px-2 py-1.5 text-right text-red-500">{fmtBRL(l.saidaPrevisto)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmtBRL(l.saldoPrevisto)}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-blue-600">{fmtBRL(l.saldoAcumuladoPrevisto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr className="border-t border-slate-200">
                  <td className="px-2 py-2" colSpan={2}>Total</td>
                  <td className="px-2 py-2 text-right text-emerald-700">{fmtBRL(totalEntradaPrevisto)}</td>
                  <td className="px-2 py-2 text-right text-red-600">{fmtBRL(totalSaidaPrevisto)}</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totalEntradaPrevisto - totalSaidaPrevisto)}</td>
                  <td className="px-2 py-2 text-right">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-1.5">
          O comparativo com o Realizado fica no Financeiro por Obra, aba &quot;Orçado × Realizado&quot;.
        </p>
      </div>

      <Button variant="primary" size="sm" onClick={handleSalvar} loading={saving}>Salvar Cronograma</Button>
    </div>
  );
}

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
  const { profile } = useAuth();
  const nomeUsuario = profile?.nome ?? "Sistema";
  const [eng, setEng] = useState<EngCaixaObra>(() => ({ ...EMPTY_ENG, ...(obra.eng_caixa ?? {}) }));
  const [saving, setSaving] = useState(false);

  const handleStep = useCallback(async (
    field: "solicitado" | "boletoPago" | "vistoriaRealizada" | "laudoEmitido",
    dtField: "dtSolicitado" | "dtBoletoPago" | "dtVistoria" | "dtLaudo",
    label: string,
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
      const acao = next === "concluido"
        ? `marcou "${label}" como concluído.`
        : `desmarcou "${label}".`;
      await registrarHistorico({
        obra_id: obra.id, lead_id: obra.lead_id, servico_id: null,
        tipo: "obras", acao,
        usuario_nome: nomeUsuario, usuario_id: null, setor: "obras", etapa: "eng_caixa",
      }).catch(() => {});
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
  }, [eng, obra.id, obra.lead_id, nomeUsuario, onSave, onAvancar, onClose]);

  const steps: Array<{
    field: "solicitado" | "boletoPago" | "vistoriaRealizada" | "laudoEmitido";
    dtField: "dtSolicitado" | "dtBoletoPago" | "dtVistoria" | "dtLaudo";
    label: string;
    isLaudo: boolean;
  }> = [
    { field: "solicitado",        dtField: "dtSolicitado", label: "Solicitado à Caixa",  isLaudo: false },
    { field: "boletoPago",        dtField: "dtBoletoPago", label: "Boleto Pago",          isLaudo: false },
    { field: "vistoriaRealizada", dtField: "dtVistoria",   label: "Vistoria Realizada",   isLaudo: false },
    { field: "laudoEmitido",      dtField: "dtLaudo",      label: "Laudo Emitido",        isLaudo: true  },
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
              onClick={() => handleStep(field, dtField, label, isLaudo)}
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
  const { profile } = useAuth();
  const nomeUsuario = profile?.nome ?? "Sistema";
  const [conf, setConf] = useState<ConformidadeObra>(() => ({ ...EMPTY_CONF, ...(obra.conformidade ?? {}) }));
  const [saving, setSaving] = useState(false);

  const handleStep = useCallback(async (
    field: "docsGerados" | "docsAssinados" | "docsEnviados",
    dtField: "dtDocsGerados" | "dtDocsAssinados" | "dtDocsEnviados",
    label: string,
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
      const acao = next === "concluido"
        ? `marcou "${label}" como concluído.`
        : `desmarcou "${label}".`;
      await registrarHistorico({
        obra_id: obra.id, lead_id: obra.lead_id, servico_id: null,
        tipo: "obras", acao,
        usuario_nome: nomeUsuario, usuario_id: null, setor: "obras", etapa: "conformidade",
      }).catch(() => {});
    } catch {
      setConf(conf);
    } finally {
      setSaving(false);
    }
  }, [conf, obra.id, obra.lead_id, nomeUsuario, onSave]);

  const steps: Array<{
    field: "docsGerados" | "docsAssinados" | "docsEnviados";
    dtField: "dtDocsGerados" | "dtDocsAssinados" | "dtDocsEnviados";
    label: string;
  }> = [
    { field: "docsGerados",   dtField: "dtDocsGerados",   label: "Formulários Gerados"         },
    { field: "docsAssinados", dtField: "dtDocsAssinados", label: "Formulários Assinados"        },
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
              onClick={() => handleStep(field, dtField, label)}
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
  onExcluir: (id: string) => Promise<boolean>;
  onSalvarMedicao: (obraId: string, data: Partial<Medicao>) => Promise<void>;
  onRemoverMedicao: (obraId: string, medicaoId: string) => Promise<void>;
}

export default function ModalObra({ obra, onClose, onSave, onAvancar, onExcluir, onSalvarMedicao, onRemoverMedicao }: Props) {
  const { pode } = usePermissoes();
  const isNovo   = !obra;
  const [tab, setTab]     = useState<Tab>(isNovo ? "editar" : "perfil");
  const [form, setForm]   = useState<Partial<Obra>>(obra ?? EMPTY_OBRA);
  const [saving, setSaving] = useState(false);
  const [editMedicao, setEditMedicao] = useState<{ medicao: Partial<Medicao> | null } | null>(null);
  const [correspondentes, setCorrespondentes] = useState<Correspondente[]>([]);
  const [showNovoCorrespondente, setShowNovoCorrespondente] = useState(false);
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [showNovoCorretor, setShowNovoCorretor] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteHistorico, setClienteHistorico] = useState<Cliente | null>(null);

  useEffect(() => { getCorrespondentes().then(setCorrespondentes).catch(() => {}); }, []);
  useEffect(() => { getCorretores().then(setCorretores).catch(() => {}); }, []);

  const etapaAtual = ETAPAS_OBRA.find((e) => e.id === form.etapa);
  const prox       = FLUXO_OBRA.indexOf(form.etapa ?? "contrato");
  const podeAvancar = !isNovo && prox !== -1 && prox < FLUXO_OBRA.length - 1;
  const proximaEtapa = podeAvancar ? ETAPAS_OBRA.find((e) => e.id === FLUXO_OBRA[prox + 1]) : null;

  const set = (k: keyof Obra, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  // Ao sair do campo CPF, busca se já existe um cliente com esse CPF —
  // autopreenche nome/telefone/email só onde ainda está vazio e liga a obra
  // a esse cliente. Mesmo comportamento do ModalLead (ver Sprint 13.1).
  const handleBlurCpf = async () => {
    if (!form.cpf || !validarCPF(form.cpf)) return;
    setBuscandoCliente(true);
    try {
      const cliente = await buscarClientePorCpfCnpj(form.cpf);
      if (cliente) {
        setForm((p) => ({
          ...p,
          cliente_id: cliente.id,
          cliente: p.cliente || cliente.nome,
          telefone: p.telefone || cliente.telefone || p.telefone,
          email: p.email || cliente.email || p.email,
        }));
        toast.success(`Cliente já cadastrado — dados preenchidos (${cliente.nome})`);
      }
    } catch {
      // busca falhou silenciosamente — não impede o preenchimento manual
    } finally {
      setBuscandoCliente(false);
    }
  };

  const handleVerHistoricoCliente = async () => {
    if (!form.cliente_id) return;
    try {
      const cliente = await getCliente(form.cliente_id);
      if (cliente) setClienteHistorico(cliente);
    } catch {
      toast.error("Erro ao carregar dados do cliente.");
    }
  };

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

  const emStandBy = obra?.etapa === "stand_by";
  const etapaRetomada = emStandBy
    ? ETAPAS_OBRA.find((e) => e.id === etapaAntesDoStandBy(obra?.log))
    : null;

  const handleStandBy = useCallback(async () => {
    if (!obra?.id) return;
    if (!window.confirm(`Colocar "${obra.cliente}" em Stand By? A obra fica pausada e pode ser retomada depois.`)) return;
    setSaving(true);
    try { await onAvancar(obra.id, "stand_by"); onClose(); }
    finally { setSaving(false); }
  }, [obra, onAvancar, onClose]);

  const handleRetomar = useCallback(async () => {
    if (!obra?.id) return;
    const destino = etapaAntesDoStandBy(obra.log);
    if (!destino) { toast.error("Não encontrei a etapa anterior ao Stand By."); return; }
    setSaving(true);
    try { await onAvancar(obra.id, destino as EtapaObra); onClose(); }
    finally { setSaving(false); }
  }, [obra, onAvancar, onClose]);

  const handleExcluir = useCallback(async () => {
    if (!obra?.id) return;
    if (!window.confirm(`Apagar a obra "${obra.cliente}" definitivamente? Medições, histórico e documentos vinculados também serão apagados. Esta ação não pode ser desfeita.`)) return;
    setSaving(true);
    try {
      const ok = await onExcluir(obra.id);
      if (ok) onClose();
    } finally { setSaving(false); }
  }, [obra, onExcluir, onClose]);

  const tabs: [Tab, string][] = isNovo
    ? [["editar", "Dados"]]
    : [["perfil", "Perfil"], ["medicoes", "Medições"], ["cronograma", "Cronograma Físico-Financeiro"], ["documentos", "Documentos"], ["historico", "Histórico"], ["editar", "Editar"]];

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

              {/* Financiado / Recursos Próprios / Lucro Previsto */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Valor Financiado",  valor: fmtBRL(obra.valor_financiamento), cor: "text-cyan-600" },
                  { label: "Recursos Próprios",  valor: fmtBRL(obra.recursos_proprios),   cor: "text-slate-700" },
                  { label: "Lucro Previsto (%)", valor: obra.lucro_previsto_pct != null ? `${obra.lucro_previsto_pct}%` : "—", cor: "text-emerald-600" },
                  { label: "Lucro Previsto (R$)", valor: fmtBRL(((obra.valor_venda ?? 0) * (obra.lucro_previsto_pct ?? 0)) / 100), cor: "text-emerald-600 font-extrabold" },
                  { label: "Custo Máximo", valor: fmtBRL((obra.valor_venda ?? 0) - ((obra.valor_venda ?? 0) * (obra.lucro_previsto_pct ?? 0)) / 100), cor: "text-slate-900" },
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

          {/* ── CRONOGRAMA FÍSICO-FINANCEIRO ───────────────────────────────────── */}
          {tab === "cronograma" && obra && (
            <AbaCronogramaFisicoFinanceiro
              obra={obra}
              onSave={async (updates) => { await onSave({ id: obra.id, ...updates }); }}
            />
          )}

          {/* ── DOCUMENTOS ──────────────────────────────────────────────────── */}
          {tab === "documentos" && obra && (
            <AbaDocumentos
              leadId={obra.lead_id ?? undefined}
              obraId={obra.id}
              etapa={obra.etapa}
              comConjuge={obra.com_conjuge}
              dependente={obra.dependente}
              tipoRenda={obra.tipo_renda}
              fgts3anos={obra.fgts_3anos}
            />
          )}

          {/* ── HISTÓRICO ───────────────────────────────────────────────────── */}
          {tab === "historico" && obra && (
            <AbaHistorico
              leadId={obra.lead_id ?? undefined}
              obraId={obra.id}
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
                    <label className="field-label">CPF{buscandoCliente ? " (buscando...)" : ""}</label>
                    <input
                      value={form.cpf ?? ""}
                      onChange={(e) => set("cpf", maskCPF(e.target.value))}
                      onBlur={handleBlurCpf}
                      maxLength={14}
                      className="input-base"
                    />
                    {form.cliente_id && (
                      <p className="text-[10px] text-emerald-600 mt-0.5">
                        ★ Cliente já cadastrado no sistema —{" "}
                        <button type="button" onClick={handleVerHistoricoCliente} className="underline hover:text-emerald-800">
                          ver histórico
                        </button>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="field-label">Telefone</label>
                    <input value={form.telefone ?? ""} onChange={(e) => set("telefone", maskPhone(e.target.value))} maxLength={15} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">E-mail</label>
                    <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="field-label">Data de Nascimento</label>
                    <input type="date" value={form.nascimento ?? ""} onChange={(e) => set("nascimento", e.target.value)} className="input-base" />
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
                  <div>
                    <label className="field-label">Tipo de Renda</label>
                    <select value={form.tipo_renda ?? ""} onChange={(e) => set("tipo_renda", e.target.value)} className="input-base">
                      <option value="">Selecione</option>
                      {TIPOS_RENDA.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-5 flex-wrap mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.com_conjuge} onChange={(e) => set("com_conjuge", e.target.checked)} className="accent-blue-500" />
                    <span className="text-xs text-slate-700">Possui cônjuge</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.dependente} onChange={(e) => set("dependente", e.target.checked)} className="accent-blue-500" />
                    <span className="text-xs text-slate-700">Possui dependente</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.fgts_3anos} onChange={(e) => set("fgts_3anos", e.target.checked)} className="accent-blue-500" />
                    <span className="text-xs text-slate-700">FGTS 3+ anos</span>
                  </label>
                </div>
              </div>

              {/* Origem */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Canal e Origem</p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="field-label">Canal de Origem</label>
                    <select value={form.origem ?? ""} onChange={(e) => set("origem", e.target.value)} className="input-base">
                      <option value="">Selecione</option>
                      {ORIGENS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Origem do Recurso</label>
                    <select value={form.origem_recurso ?? ""} onChange={(e) => set("origem_recurso", e.target.value || null)} className="input-base">
                      <option value="">Selecione</option>
                      {ORIGENS_RECURSO.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Corretor</label>
                    <div className="flex gap-1.5">
                      <select
                        value={form.corretor_id ?? ""}
                        onChange={(e) => {
                          const sel = corretores.find((c) => c.id === e.target.value);
                          set("corretor_id", e.target.value || null);
                          set("corretor", sel?.nome ?? null);
                        }}
                        className="input-base flex-1"
                      >
                        <option value="">Selecionar corretor</option>
                        {corretores.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}{c.telefone ? ` — ${c.telefone}` : ""}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNovoCorretor(true)}
                        title="Cadastrar novo corretor"
                        className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-500 flex items-center justify-center text-lg font-bold transition-colors"
                      >+</button>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Indicado por</label>
                    <input value={form.indicado_por ?? ""} onChange={(e) => set("indicado_por", e.target.value)} className="input-base" placeholder="Nome de quem indicou" />
                  </div>
                </div>
              </div>

              {/* Correspondente Bancário */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Correspondente Bancário</p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="col-span-2">
                    <label className="field-label">Correspondente</label>
                    <div className="flex gap-1.5">
                      <select
                        value={form.correspondente_id ?? ""}
                        onChange={(e) => set("correspondente_id", e.target.value || null)}
                        className="input-base flex-1"
                      >
                        <option value="">Selecionar correspondente</option>
                        {correspondentes.map((c) => (
                          <option key={c.id} value={c.id}>{corrLabel(c)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowNovoCorrespondente(true)}
                        title="Cadastrar novo correspondente"
                        className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-500 flex items-center justify-center text-lg font-bold transition-colors"
                      >+</button>
                    </div>
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
                    <CurrencyInput value={form.valor_caixa} onChange={(v) => set("valor_caixa", v)} />
                  </div>
                  <div>
                    <label className="field-label">Valor de Venda</label>
                    <CurrencyInput value={form.valor_venda} onChange={(v) => set("valor_venda", v)} />
                  </div>
                  <div>
                    <label className="field-label">Valor Financiado</label>
                    <CurrencyInput value={form.valor_financiamento} onChange={(v) => set("valor_financiamento", v)} />
                  </div>
                  <div>
                    <label className="field-label">Recursos Próprios</label>
                    <CurrencyInput value={form.recursos_proprios} onChange={(v) => set("recursos_proprios", v)} />
                  </div>
                  <div>
                    <label className="field-label">Subsídio</label>
                    <CurrencyInput value={form.valor_subsidio} onChange={(v) => set("valor_subsidio", v)} />
                  </div>
                  <div>
                    <label className="field-label">Valor Terreno (Lote)</label>
                    <CurrencyInput value={form.valor_lote} onChange={(v) => set("valor_lote", v)} />
                  </div>
                  <div>
                    <label className="field-label">Renda Bruta</label>
                    <CurrencyInput value={form.renda_bruta} onChange={(v) => set("renda_bruta", v)} />
                  </div>
                </div>
                <AvisoComposicaoVenda
                  financiado={form.valor_financiamento}
                  recursosProprios={form.recursos_proprios}
                  subsidio={form.valor_subsidio}
                  venda={form.valor_venda}
                />
              </div>

              {/* Margem / Lucro */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Margem / Lucro</p>
                <div className="grid grid-cols-3 gap-3.5">
                  <div>
                    <label className="field-label">Lucro Previsto (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={form.lucro_previsto_pct ?? ""}
                        onChange={(e) => set("lucro_previsto_pct", e.target.value ? Number(e.target.value) : null)}
                        className="input-base pr-8"
                        placeholder="Ex: 20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Lucro Previsto (R$)</label>
                    <div className="input-base bg-slate-50 text-emerald-600 font-bold flex items-center">
                      {fmtBRL(((form.valor_venda ?? 0) * (form.lucro_previsto_pct ?? 0)) / 100)}
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Custo Máximo Permitido</label>
                    <div className="input-base bg-slate-50 text-slate-700 font-bold flex items-center">
                      {fmtBRL((form.valor_venda ?? 0) - ((form.valor_venda ?? 0) * (form.lucro_previsto_pct ?? 0)) / 100)}
                    </div>
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

              {/* Zona de perigo — só pra quem tem permissão de excluir */}
              {!isNovo && obra && pode("obras", "excluir") && (
                <div className="border border-red-200 bg-red-50/50 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-bold text-red-700">Apagar obra</p>
                    <p className="text-[11px] text-red-600/80">
                      Remove a obra, medições, histórico e documentos vinculados. Não dá pra desfazer.
                    </p>
                  </div>
                  <Button variant="danger" size="sm" onClick={handleExcluir} loading={saving}>
                    Apagar obra
                  </Button>
                </div>
              )}
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
            {!isNovo && tab === "perfil" && emStandBy && (
              <Button variant="success" onClick={handleRetomar} loading={saving} size="sm">
                ▶ Retomar{etapaRetomada ? ` em ${etapaRetomada.label}` : ""}
              </Button>
            )}
            {!isNovo && tab === "perfil" && !emStandBy && obra?.etapa !== "entregue" && (
              <Button variant="secondary" onClick={handleStandBy} loading={saving} size="sm">
                ⏸ Stand By
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

      {showNovoCorrespondente && (
        <ModalNovoCorrespondente
          correspondentes={correspondentes}
          onClose={() => setShowNovoCorrespondente(false)}
          onSaved={(novo) => {
            setCorrespondentes((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
            set("correspondente_id", novo.id);
            setShowNovoCorrespondente(false);
          }}
          onDeleted={(id) => {
            setCorrespondentes((prev) => prev.filter((c) => c.id !== id));
            if (form.correspondente_id === id) set("correspondente_id", null);
          }}
        />
      )}

      {showNovoCorretor && (
        <ModalNovoCorretor
          corretores={corretores}
          onClose={() => setShowNovoCorretor(false)}
          onSaved={(novo) => {
            setCorretores((prev) => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
            set("corretor_id", novo.id);
            set("corretor", novo.nome);
            setShowNovoCorretor(false);
          }}
          onDeleted={(id) => {
            setCorretores((prev) => prev.filter((c) => c.id !== id));
            if (form.corretor_id === id) { set("corretor_id", null); set("corretor", null); }
          }}
        />
      )}

      {clienteHistorico && (
        <ModalCliente
          cliente={clienteHistorico}
          onClose={() => setClienteHistorico(null)}
          onSave={async (data) => {
            if (!clienteHistorico.id) return;
            await updateCliente(clienteHistorico.id, data);
          }}
        />
      )}
    </>
  );
}
