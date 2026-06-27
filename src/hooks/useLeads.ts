"use client";
import { useState, useEffect, useCallback } from "react";
import { getLeads, createLead, updateLead, registrarLogLead } from "@/services/leads.service";
import type { Lead, EtapaLead } from "@/types/app.types";
import toast from "react-hot-toast";

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeads();
      setLeads(data);
    } catch {
      toast.error("Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const salvar = useCallback(async (lead: Partial<Lead>): Promise<Lead | null> => {
    try {
      if (lead.id) {
        const atualizado = await updateLead(lead.id, lead);
        setLeads((prev) => prev.map((l) => (l.id === atualizado.id ? { ...l, ...atualizado } : l)));
        toast.success("Lead atualizado!");
        return atualizado;
      } else {
        const novo = await createLead(lead as never);
        await registrarLogLead(novo.id, "leads");
        setLeads((prev) => [novo, ...prev]);
        toast.success("Lead cadastrado!");
        return novo;
      }
    } catch {
      toast.error("Erro ao salvar lead");
      return null;
    }
  }, []);

  const avancarEtapa = useCallback(
    async (leadId: string, novaEtapa: EtapaLead, dadosExtras: Record<string, unknown> = {}): Promise<Lead | null> => {
      try {
        const atualizado = await updateLead(leadId, { etapa: novaEtapa, ...dadosExtras });
        await registrarLogLead(leadId, novaEtapa, dadosExtras);
        const logEntry = { id: "", lead_id: leadId, etapa: novaEtapa, dados_extras: dadosExtras, criado_em: new Date().toISOString() };
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, ...atualizado, log: [...(l.log ?? []), logEntry] }
              : l
          )
        );
        toast.success(`Lead avançado para ${novaEtapa}`);
        return atualizado;
      } catch {
        toast.error("Erro ao avançar etapa");
        return null;
      }
    },
    []
  );

  const enviarParaObras = useCallback(async (leadId: string): Promise<boolean> => {
    try {
      await updateLead(leadId, {
        enviado_para_obras: true,
        data_envio_obras: new Date().toISOString(),
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, enviado_para_obras: true, data_envio_obras: new Date().toISOString() }
            : l
        )
      );
      toast.success("Lead enviado para o setor de Obras!");
      return true;
    } catch {
      toast.error("Erro ao enviar para Obras");
      return false;
    }
  }, []);

  return { leads, loading, salvar, avancarEtapa, enviarParaObras, reload: load };
}
