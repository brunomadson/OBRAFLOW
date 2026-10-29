"use client";
import { useState, useEffect, useCallback } from "react";
import { getServicos, createServico, updateServico, registrarLogServico } from "@/services/servicos.service";
import { registrarHistorico } from "@/services/historico.service";
import { useAuth } from "@/contexts/AuthContext";
import { ETAPAS_SERVICO } from "@/constants/etapas";
import type { Servico, EtapaServico } from "@/types/app.types";
import toast from "react-hot-toast";

function labelEtapaServico(etapa: string) {
  return ETAPAS_SERVICO.find((e) => e.id === etapa)?.label ?? etapa;
}

export function useServicos() {
  const { profile } = useAuth();
  const nomeUsuario = profile?.nome ?? "Sistema";
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServicos(await getServicos());
    } catch {
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const salvar = useCallback(async (servico: Partial<Servico>): Promise<Servico | null> => {
    try {
      if (servico.id) {
        const atualizado = await updateServico(servico.id, servico);
        setServicos((prev) => prev.map((s) => (s.id === atualizado.id ? { ...s, ...atualizado } : s)));
        await registrarHistorico({
          lead_id: null, obra_id: null, servico_id: servico.id,
          tipo: "servico_tecnico", acao: "editou as informações do serviço.",
          usuario_nome: nomeUsuario, usuario_id: null, setor: "servicos-tecnicos", etapa: atualizado.etapa,
        }).catch(() => {});
        toast.success("Serviço atualizado!");
        return atualizado;
      } else {
        const novo = await createServico(servico as never);
        await registrarLogServico(novo.id, "novo_lead");
        await registrarHistorico({
          lead_id: null, obra_id: null, servico_id: novo.id,
          tipo: "servico_tecnico", acao: "criou o serviço.",
          usuario_nome: nomeUsuario, usuario_id: null, setor: "servicos-tecnicos", etapa: "novo_lead",
        }).catch(() => {});
        setServicos((prev) => [novo, ...prev]);
        toast.success("Serviço cadastrado!");
        return novo;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar serviço");
      return null;
    }
  }, [nomeUsuario]);

  const avancarEtapa = useCallback(
    async (servicoId: string, novaEtapa: EtapaServico, dadosExtras: Record<string, unknown> = {}): Promise<Servico | null> => {
      try {
        const servicoAtual = servicos.find((s) => s.id === servicoId);
        const etapaAnterior = servicoAtual?.etapa;
        // Serviços da mesma proposta (Sprint 13.9/13.11) andam juntos no funil
        // comercial — mover um move o grupo inteiro, não só o item clicado.
        // proposta_id null = serviço avulso, grupo de 1 (comportamento de
        // sempre).
        const grupo = servicoAtual?.proposta_id
          ? servicos.filter((s) => s.proposta_id === servicoAtual.proposta_id)
          : servicoAtual ? [servicoAtual] : [];

        const atualizados = await Promise.all(
          grupo.map((s) => updateServico(s.id, { etapa: novaEtapa, ...dadosExtras }))
        );
        await Promise.all(grupo.map((s) => registrarLogServico(s.id, novaEtapa, dadosExtras)));

        const logEntry = { id: "", servico_id: servicoId, etapa: novaEtapa, dados_extras: dadosExtras, criado_em: new Date().toISOString() };
        setServicos((prev) =>
          prev.map((s) => {
            const atualizado = atualizados.find((a) => a.id === s.id);
            if (!atualizado) return s;
            return { ...s, ...atualizado, log: s.id === servicoId ? [...(s.log ?? []), logEntry] : s.log };
          })
        );

        const acaoText = etapaAnterior
          ? `moveu o serviço de "${labelEtapaServico(etapaAnterior)}" para "${labelEtapaServico(novaEtapa)}".`
          : `moveu o serviço para "${labelEtapaServico(novaEtapa)}".`;
        await Promise.all(
          grupo.map((s) =>
            registrarHistorico({
              lead_id: null, obra_id: null, servico_id: s.id,
              tipo: "servico_tecnico", acao: acaoText,
              usuario_nome: nomeUsuario, usuario_id: null, setor: "servicos-tecnicos", etapa: novaEtapa,
            }).catch(() => {})
          )
        );

        toast.success(
          grupo.length > 1
            ? `${grupo.length} serviços da proposta movidos para "${labelEtapaServico(novaEtapa)}"`
            : `Serviço movido para "${labelEtapaServico(novaEtapa)}"`
        );
        return atualizados.find((a) => a.id === servicoId) ?? null;
      } catch {
        toast.error("Erro ao avançar etapa");
        return null;
      }
    },
    [servicos, nomeUsuario]
  );

  return { servicos, loading, salvar, avancarEtapa, reload: load };
}
