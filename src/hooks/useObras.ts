"use client";
import { useState, useEffect, useCallback } from "react";
import { getObras, createObra, updateObra, registrarLogObra, upsertMedicao, deleteMedicao } from "@/services/obras.service";
import type { Obra, Medicao, EtapaObra } from "@/types/app.types";
import toast from "react-hot-toast";

export function useObras() {
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
      await updateObra(obra.id, { etapa: novaEtapa });
      await registrarLogObra(obra.id, novaEtapa);
      setObras((prev) =>
        prev.map((o) =>
          o.id === obra.id
            ? { ...o, etapa: novaEtapa, log: [...(o.log ?? []), { id: "", obra_id: obra.id, etapa: novaEtapa, criado_em: new Date().toISOString() }] }
            : o
        )
      );
      toast.success(`Obra avançada para ${novaEtapa}`);
    } catch {
      toast.error("Erro ao avançar etapa");
    }
  }, []);

  const salvarMedicao = useCallback(async (obraId: string, medicao: Partial<Medicao>): Promise<Medicao | null> => {
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
      toast.success("Medição salva!");
      return salva;
    } catch {
      toast.error("Erro ao salvar medição");
      return null;
    }
  }, []);

  const removerMedicao = useCallback(async (obraId: string, medicaoId: string): Promise<void> => {
    try {
      await deleteMedicao(medicaoId);
      setObras((prev) =>
        prev.map((o) =>
          o.id === obraId
            ? { ...o, medicoes: (o.medicoes ?? []).filter((m) => m.id !== medicaoId) }
            : o
        )
      );
      toast.success("Medição removida");
    } catch {
      toast.error("Erro ao remover medição");
    }
  }, []);

  return { obras, loading, salvar, avancarEtapa, salvarMedicao, removerMedicao, reload: load };
}
