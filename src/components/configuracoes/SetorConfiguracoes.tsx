"use client";
import { useState, useEffect, useCallback } from "react";
import ModalMembro from "./ModalMembro";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { GRUPOS_CONFIG, CONFIG_PADRAO, GRUPOS_METAS } from "@/constants/config";
import { getConfig, saveConfig } from "@/services/config.service";
import { getMetas, upsertMeta, periodoAtual } from "@/services/metas.service";
import { getIntegracoes, conectarIntegracao } from "@/services/integracoes.service";
import { ICONE_INTEGRACAO } from "@/constants/integracoes";
import CurrencyInput from "@/components/ui/CurrencyInput";
import Modal, { ModalHeader } from "@/components/ui/Modal";
import { getProfiles, upsertProfile } from "@/services/profiles.service";
import { getCargosComPermissoes, criarCargo, excluirCargo, atualizarPermissao } from "@/services/cargos.service";
import { registrarHistorico } from "@/services/historico.service";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ConfigPrazos, IndicadorMeta, IntegracaoComStatus, CargoComPermissoes, SetorPermissao } from "@/types/app.types";
import toast from "react-hot-toast";

type Aba = "prazos" | "metas" | "membros" | "cargos" | "integracoes";

/* ---- Aba Metas ---- */
function AbaMetas() {
  const [valores, setValores] = useState<Partial<Record<IndicadorMeta, number>>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<IndicadorMeta | null>(null);
  const periodo = periodoAtual();

  useEffect(() => {
    getMetas(periodo)
      .then((rows) => {
        const map: Partial<Record<IndicadorMeta, number>> = {};
        rows.forEach((r) => { map[r.indicador] = Number(r.valor_meta); });
        setValores(map);
      })
      .finally(() => setLoading(false));
  }, [periodo]);

  const handleSave = async (indicador: IndicadorMeta) => {
    setSavingKey(indicador);
    try {
      await upsertMeta(indicador, periodo, valores[indicador] ?? 0);
      toast.success("Meta salva!");
    } catch { toast.error("Erro ao salvar meta."); }
    finally { setSavingKey(null); }
  };

  if (loading) return <p className="text-sm text-slate-400">Carregando...</p>;

  const mesLabel = new Date(periodo + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-slate-400 mb-4">
        Metas de <span className="font-semibold text-slate-600 capitalize">{mesLabel}</span> — usadas nos comparativos &quot;Meta x Realizado&quot; das dashboards. Cada mês tem sua própria meta.
      </p>
      {GRUPOS_METAS.map((grupo) => (
        <div key={grupo.id} className="card p-5 mb-4">
          <p className="text-[13px] font-bold text-slate-900 mb-3">{grupo.emoji} {grupo.label}</p>
          <div className="space-y-3">
            {grupo.itens.map((campo) => (
              <div key={campo.indicador} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] text-slate-700 font-medium">{campo.label}</p>
                  <p className="text-[11px] text-slate-400">{campo.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  {campo.tipo === "moeda" ? (
                    <CurrencyInput
                      value={valores[campo.indicador] ?? null}
                      onChange={(v) => setValores((p) => ({ ...p, [campo.indicador]: v }))}
                      className="w-32 text-center"
                    />
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={campo.tipo === "percentual" ? 100 : undefined}
                      value={valores[campo.indicador] ?? 0}
                      onChange={(e) => setValores((p) => ({ ...p, [campo.indicador]: Number(e.target.value) }))}
                      className="input-base w-24 text-center"
                    />
                  )}
                  <span className="text-xs text-slate-400 w-4">{campo.tipo === "percentual" ? "%" : ""}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={savingKey === campo.indicador}
                    onClick={() => handleSave(campo.indicador)}
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Aba Prazos ---- */
function AbaPrazos() {
  const [config, setConfig] = useState<ConfigPrazos>(CONFIG_PADRAO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(config);
      toast.success("Configurações salvas!");
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  };

  const handleRestaurarPadrao = () => {
    setConfig(CONFIG_PADRAO);
    toast.success("Valores padrão restaurados. Clique em \"Salvar Configurações\" para aplicar.");
  };

  if (loading) return <p className="text-sm text-slate-400">Carregando...</p>;

  return (
    <div className="max-w-2xl">
      {GRUPOS_CONFIG.map((grupo) => (
        <div key={grupo.id} className="card p-5 mb-4">
          <p className="text-[13px] font-bold text-slate-900 mb-1">{grupo.label}</p>
          <div className="space-y-3">
            {grupo.itens.map((campo) => (
              <div key={campo.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] text-slate-700 font-medium">{campo.label}</p>
                  {campo.desc && <p className="text-[11px] text-slate-400">{campo.desc}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={(config as unknown as Record<string, number>)[campo.key] ?? 0}
                    onChange={(e) => setConfig((p) => ({ ...p, [campo.key]: Number(e.target.value) }))}
                    className="input-base w-20 text-center"
                  />
                  <span className="text-xs text-slate-400">{campo.unidade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="primary" onClick={handleSave} loading={saving}>Salvar Configurações</Button>
        <Button variant="secondary" onClick={handleRestaurarPadrao} disabled={saving}>Restaurar Padrão</Button>
      </div>
    </div>
  );
}

/* ---- Aba Membros ---- */
function AbaMembros() {
  const { profile } = useAuth();
  const [membros, setMembros]   = useState<Profile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<Profile | "novo" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMembros(await getProfiles() as Profile[]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Partial<Profile>) => {
    const antes = typeof modal === "object" ? modal : null;
    const depois = await upsertProfile(data as Parameters<typeof upsertProfile>[0]);

    if (antes && antes.cargo_id !== depois.cargo_id) {
      await registrarHistorico({
        tipo: "sistema",
        acao: `Alterou o cargo de ${antes.nome ?? "um membro"} de "${antes.cargo}" para "${depois.cargo}"`,
        usuario_id: profile?.id ?? null,
        usuario_nome: profile?.nome ?? "Sistema",
        lead_id: null,
        obra_id: null,
        setor: null,
        etapa: null,
        workspace_id: profile?.workspace_id ?? null,
      });
    }

    await load();
    setModal(null);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-[13px] font-bold text-slate-700">Equipe ({membros.length})</p>
        <Button variant="primary" size="sm" onClick={() => setModal("novo")}>+ Convidar Membro</Button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : (
        <div className="space-y-2.5">
          {membros.map((m) => (
            <div
              key={m.id}
              onClick={() => setModal(m)}
              className="card p-4 flex justify-between items-center cursor-pointer hover:shadow-card-hover"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
                  {(m.nome ?? "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">{m.nome}</p>
                  <p className="text-[11px] text-slate-400">{m.cargo}</p>
                </div>
              </div>
              <Badge color={m.ativo ? "#10B981" : "#94A3B8"}>{m.ativo ? "Ativo" : "Inativo"}</Badge>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <ModalMembro
          membro={modal === "novo" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

/* ---- Aba Cargos ---- */
const SETORES_MATRIZ: { id: SetorPermissao; label: string }[] = [
  { id: "comercial",     label: "Comercial" },
  { id: "obras",         label: "Obras" },
  { id: "financeiro",    label: "Financeiro" },
  { id: "notificacoes",  label: "Alertas" },
  { id: "configuracoes", label: "Configurações (Prazos)" },
  { id: "metas",         label: "Metas" },
  { id: "membros",       label: "Membros" },
  { id: "integracoes",   label: "Integrações" },
  { id: "documentos",    label: "Documentos" },
];
const ACOES_MATRIZ: { campo: "pode_visualizar" | "pode_criar" | "pode_editar" | "pode_excluir"; label: string }[] = [
  { campo: "pode_visualizar", label: "Ver" },
  { campo: "pode_criar",      label: "Criar" },
  { campo: "pode_editar",     label: "Editar" },
  { campo: "pode_excluir",    label: "Excluir" },
];

function AbaCargos() {
  const { profile } = useAuth();
  const [cargos, setCargos] = useState<CargoComPermissoes[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCargos(await getCargosComPermissoes()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (
    cargo: CargoComPermissoes,
    setor: SetorPermissao,
    campo: "pode_visualizar" | "pode_criar" | "pode_editar" | "pode_excluir",
    valorAtual: boolean
  ) => {
    const permissao = cargo.permissoes.find((p) => p.setor === setor);
    if (!permissao) return;

    setCargos((prev) => prev.map((c) => c.id !== cargo.id ? c : {
      ...c,
      permissoes: c.permissoes.map((p) => p.id === permissao.id ? { ...p, [campo]: !valorAtual } : p),
    }));

    try {
      await atualizarPermissao(permissao.id, campo, !valorAtual);
      await registrarHistorico({
        tipo: "sistema",
        acao: `Alterou a permissão "${ACOES_MATRIZ.find((a) => a.campo === campo)?.label}" de ${SETORES_MATRIZ.find((s) => s.id === setor)?.label} no cargo "${cargo.nome}" para ${!valorAtual ? "permitido" : "bloqueado"}`,
        usuario_id: profile?.id ?? null,
        usuario_nome: profile?.nome ?? "Sistema",
        lead_id: null,
        obra_id: null,
        setor: null,
        etapa: null,
        workspace_id: profile?.workspace_id ?? null,
      });
    } catch {
      toast.error("Erro ao salvar permissão.");
      await load();
    }
  };

  const handleCriar = async () => {
    if (!novoNome.trim()) { toast.error("Informe o nome do cargo"); return; }
    if (!profile?.workspace_id) return;
    setCriando(true);
    try {
      await criarCargo(novoNome.trim(), profile.workspace_id);
      setNovoNome("");
      toast.success("Cargo criado! Ajuste as permissões abaixo.");
      await load();
    } catch {
      toast.error("Erro ao criar cargo.");
    } finally {
      setCriando(false);
    }
  };

  const handleExcluir = async (cargo: CargoComPermissoes) => {
    if (!confirm(`Excluir o cargo "${cargo.nome}"? Membros com esse cargo perderão o acesso até serem reatribuídos.`)) return;
    try {
      await excluirCargo(cargo.id);
      await load();
    } catch {
      toast.error("Não foi possível excluir esse cargo.");
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Carregando...</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-end gap-3 mb-4">
        <p className="text-[13px] font-bold text-slate-700">Cargos e Permissões ({cargos.length})</p>
        <div className="flex gap-2">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do novo cargo"
            className="input-base text-xs w-52"
          />
          <Button variant="primary" size="sm" onClick={handleCriar} loading={criando}>+ Novo Cargo</Button>
        </div>
      </div>

      <div className="space-y-4">
        {cargos.map((cargo) => (
          <div key={cargo.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold text-slate-900">{cargo.nome}</p>
                {cargo.sistema && <Badge color="#94A3B8">Padrão do sistema</Badge>}
              </div>
              {!cargo.sistema && (
                <button onClick={() => handleExcluir(cargo)} className="text-[11px] text-red-500 hover:text-red-600">
                  Excluir cargo
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="font-medium pb-1.5 pr-3">Setor</th>
                    {ACOES_MATRIZ.map((a) => <th key={a.campo} className="font-medium pb-1.5 px-2 text-center">{a.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {SETORES_MATRIZ.map((setor) => {
                    const permissao = cargo.permissoes.find((p) => p.setor === setor.id);
                    return (
                      <tr key={setor.id} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3 text-slate-600">{setor.label}</td>
                        {ACOES_MATRIZ.map((a) => (
                          <td key={a.campo} className="py-1.5 px-2 text-center">
                            <input
                              type="checkbox"
                              className="accent-blue-500"
                              checked={permissao?.[a.campo] ?? false}
                              onChange={() => permissao && handleToggle(cargo, setor.id, a.campo, permissao[a.campo])}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Aba Integrações ---- */
function AbaIntegracoes() {
  const [integracoes, setIntegracoes] = useState<IntegracaoComStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [conectando, setConectando] = useState<string | null>(null);
  const [modal, setModal] = useState<"configurar" | "upgrade" | null>(null);

  const load = useCallback(() => {
    getIntegracoes().then(setIntegracoes).catch(() => toast.error("Erro ao carregar integrações.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConectar = async (integracao: IntegracaoComStatus) => {
    setConectando(integracao.id);
    try {
      await conectarIntegracao(integracao.id);
      toast.success(`${integracao.nome} conectado!`);
      await load();
    } catch { toast.error("Erro ao conectar."); }
    finally { setConectando(null); }
  };

  if (loading) return <p className="text-sm text-slate-400">Carregando...</p>;

  return (
    <div className="max-w-2xl">
      <p className="text-xs text-slate-400 mb-4">
        Conexões externas opcionais, de acordo com o seu plano. Integrações internas da plataforma não aparecem aqui.
      </p>
      <div className="space-y-3">
        {integracoes.map((i) => (
          <div key={i.id} className={`card p-5 ${!i.disponivelNoPlano ? "opacity-70" : ""}`}>
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl flex-shrink-0">{ICONE_INTEGRACAO[i.codigo]}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 mb-0.5">{i.nome}</p>
                  <p className="text-xs text-slate-400">{i.descricao}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {!i.disponivelNoPlano ? (
                  <Badge color="#94A3B8">Plano superior</Badge>
                ) : i.status === "conectado" ? (
                  <Badge color="#10B981">Conectado</Badge>
                ) : (
                  <Badge color="#94A3B8">Não conectado</Badge>
                )}

                {!i.disponivelNoPlano ? (
                  <Button variant="secondary" size="sm" onClick={() => setModal("upgrade")}>Upgrade</Button>
                ) : i.status === "conectado" ? (
                  <Button variant="secondary" size="sm" onClick={() => setModal("configurar")}>Configurar</Button>
                ) : (
                  <Button variant="primary" size="sm" loading={conectando === i.id} onClick={() => handleConectar(i)}>Conectar</Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal onClose={() => setModal(null)} size="sm">
          <ModalHeader title={modal === "upgrade" ? "Upgrade de plano" : "Configurar integração"} onClose={() => setModal(null)} />
          <div className="p-5">
            <p className="text-sm text-slate-600">
              {modal === "upgrade"
                ? "Essa integração está disponível em um plano superior. Fale com o time ObraFlow para fazer upgrade do seu plano."
                : "As opções de configuração dessa integração chegam em breve."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---- Main ---- */
export default function SetorConfiguracoes() {
  const [aba, setAba] = useState<Aba>("prazos");
  const tabs: [Aba, string][] = [["prazos", "Prazos"], ["metas", "Metas"], ["membros", "Membros"], ["cargos", "Cargos"], ["integracoes", "Integrações"]];

  return (
    <div>
      <div className="bg-white border-b border-slate-100 px-6 flex gap-1">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} className={`tab-btn ${aba === id ? "active" : ""}`}>{label}</button>
        ))}
      </div>
      <div className="p-6 max-w-[1400px] mx-auto">
        {aba === "prazos"      && <AbaPrazos />}
        {aba === "metas"       && <AbaMetas />}
        {aba === "membros"     && <AbaMembros />}
        {aba === "cargos"      && <AbaCargos />}
        {aba === "integracoes" && <AbaIntegracoes />}
      </div>
    </div>
  );
}
