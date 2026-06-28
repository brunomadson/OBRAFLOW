"use client";
import { useState, useEffect, useCallback } from "react";
import { getObras, createObra, updateObra, registrarLogObra, upsertMedicao, deleteMedicao } from "@/services/obras.service";
import { registrarHistorico } from "@/services/historico.service";
import { useAuth } from "@/contexts/AuthContext";
import { ETAPAS_OBRA } from "@/constants/etapas";
import { STATUS_MEDICAO_LABEL } from "@/constants/dominios";
import type { Obra, Medicao, EtapaObra } from "@/types/app.types";
import toast from "react-hot-toast";

function labelEtapaObra(etapa: string) {
  return ETAPAS_OBRA.find((e) => e.id === etapa)?.label ?? etapa;
}

export function useObras() {
  const { profile } = useAuth();
  const nomeUsuario = profile?.nome ?? "Sistema";
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getObras();
      setObras(data);
    } catch {
      toast.error("Erro ao carregar obras");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const salvar = useCallback(async (obra: Partial<Obra>): Promise<Obra | null> => {
    try {
      if (obra.id) {
        const atualizada = await updateObra(obra.id, obra);
        setObras((prev) => prev.map((o) => (o.id === atualizada.id ? { ...atualizada, medicoes: obra.medicoes, log: obra.log } : o)));
        toast.success("Obra salva!");
        return atualizada;
      } else {
        const nova = await createObra(obra as never);
        await registrarLogObra(nova.id, nova.etapa);
        setObras((prev) => [nova, ...prev]);
        toast.success("Obra criada!");
        return nova;
      }
    } catch {
      toast.error("Erro ao salvar obra");
      return null;
    }
  }, []);

  const avancarEtapa = useCallback(async (obra: Obra, novaEtapa: EtapaObra): Promise<void> => {
    try {
      const etapaAnterior = obra.etapa;
      await updateObra(obra.id, { etapa: novaEtapa });
      await registrarLogObra(obra.id, novaEtapa);
      setObras((prev) =>
        prev.map((o) =>
          o.id === obra.id
            ? { ...o, etapa: novaEtapa, log: [...(o.log ?? []), { id: "", obra_id: obra.id, etapa: novaEtapa, created_at: new Date().toISOString() }] }
            : o
        )
      );
      const acaoText = `moveu o cliente de "${labelEtapaObra(etapaAnterior)}" para "${labelEtapaObra(novaEtapa)}".`;
      await registrarHistorico({
        obra_id: obra.id, lead_id: obra.lead_id,
        tipo: "obras", acao: acaoText,
        usuario_nome: nomeUsuario, usuario_id: null, setor: "obras", etapa: novaEtapa,
      }).catch(() => {});
      toast.success(`Obra avançada para ${novaEtapa}`);
    } catch {
      toast.error("Erro ao avançar etapa");
    }
  }, [nomeUsuario]);

  const salvarMedicao = useCallback(async (obraId: string, medicao: Partial<Medicao>): Promise<Medicao | null> => {
    const isNova = !medicao.id;
    const obra = obras.find((o) => o.id === obraId);
    const medicaoAntiga = obra?.medicoes?.find((m) => m.id === medicao.id);
    const statusAntigo = medicaoAntiga?.status;

    try {
      const salva = await upsertMedicao({ ...medicao, obra_id: obraId });
      setObras((prev) =>
        prev.map((o) => {
          if (o.id !== obraId) return o;
          const meds = o.medicoes ?? [];
          const existe = meds.find((m) => m.id === salva.id);
          return {
            ...o,
            medicoes: existe
              ? meds.map((m) => (m.id === salva.id ? salva : m))
              : [...meds, salva],
          };
        })
      );
      const nomeMed = salva.nome || "Medição";

      if (isNova) {
        await registrarHistorico({
          obra_id: obraId, lead_id: obra?.lead_id ?? null,
          tipo: "medicao", acao: `criou a Medição "${nomeMed}".`,
          usuario_nome: nomeUsuario, usuario_id: null, setor: "obras", etapa: obra?.etapa ?? null,
        }).catch(() => {});
      } else {
        // Registra mudança de status se houver
        if (medicao.status && medicao.status !== statusAntigo) {
          const labelAntigo = STATUS_MEDICAO_LABEL[statusAntigo ?? ""] ?? statusAntigo ?? "—";
          const labelNovo = STATUS_MEDICAO_LABEL[medicao.status] ?? medicao.status;
          await registrarHistorico({
            obra_id: obraId, lead_id: obra?.lead_id ?? null,
            tipo: "medicao",
            acao: `alterou o status da Medição "${nomeMed}" de "${labelAntigo}" para "${labelNovo}".`,
            usuario_nome: nomeUsuario, usuario_id: null, setor: "obras", etapa: obra?.etapa ?? null,
          }).catch(() => {});
        } else {
          await registrarHistorico({
            obra_id: obraId, lead_id: obra?.lead_id ?? null,
            tipo: "medicao", acao: `atualizou os dados da Medição "${nomeMed}".`,
            usuario_nome: nomeUsuario, usuario_id: null, setor: "obras", etapa: obra?.etapa ?? null,
          }).catch(() => {});
        }
      }

      return salva;
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "Erro desconhecido";
      toast.error(`Erro ao salvar medição: ${msg}`);
      throw err;
    }
  }, [obras, nomeUsuario]);

  const removerMedicao = useCallback(async (obraId: string, medicaoId: string): Promise<void> => {
    try {
      const obra = obras.find((o) => o.id === obraId);
      const medicao = obra?.medicoes?.find((m) => m.id === medicaoId);
      await deleteMedicao(medicaoId);
      setObras((prev) =>
        prev.map((o) =>
          o.id === obraId
            ? { ...o, medicoes: (o.medicoes ?? []).filter((m) => m.id !== medicaoId) }
            : o
        )
      );
      await registrarHistorico({
        obra_id: obraId, lead_id: obra?.lead_id ?? null,
        tipo: "medicao", acao: `removeu a Medição "${medicao?.nome ?? "Medição"}".`,
        usuario_nome: nomeUsuario, usuario_id: null, setor: "obras", etapa: obra?.etapa ?? null,
      }).catch(() => {});
      toast.success("Medição removida");
    } catch {
      toast.error("Erro ao remover medição");
    }
  }, [obras, nomeUsuario]);

  return { obras, loading, salvar, avancarEtapa, salvarMedicao, removerMedicao, reload: load };
}
