"use client";
import { useState, useEffect, useCallback } from "react";
import { getLeads, createLead, updateLead, registrarLogLead } from "@/services/leads.service";
import { createObra, registrarLogObra } from "@/services/obras.service";
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
        const logEntry = { id: "", lead_id: leadId, etapa: novaEtapa, dados_extras: dadosExtras, created_at: new Date().toISOString() };
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
    // Busca o lead do estado local para ter todos os dados
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) {
      toast.error("Lead não encontrado");
      return false;
    }

    try {
      // 1. Cria a obra com todos os dados do lead
      const novaObra = await createObra({
        lead_id: leadId,
        cliente: lead.nome,
        nome: lead.nome,
        cpf: lead.cpf,
        telefone: lead.telefone,
        email: lead.email,
        nascimento: lead.nascimento,
        cidade: lead.cidade,
        modalidade: lead.modalidade ?? undefined,
        renda_bruta: lead.renda_bruta ?? undefined,
        tipo_renda: lead.tipo_renda,
        dependente: lead.dependente,
        fgts_3anos: lead.fgts_3anos,
        com_conjuge: lead.com_conjuge,
        com_muro: lead.com_muro,
        tamanho_imovel: lead.tamanho_imovel,
        valor_caixa: lead.valor_caixa ?? undefined,
        valor_venda: lead.valor_venda ?? undefined,
        valor_lote: lead.valor_lote ?? undefined,
        valor_subsidio: lead.valor_subsidio ?? undefined,
        valor_financiamento: lead.valor_financiamento ?? undefined,
        correspondente_id: lead.correspondente_id,
        data_contato: lead.data_contato,
        data_reuniao: lead.data_reuniao,
        obs: lead.obs,
        origem: lead.origem,
        corretor: lead.corretor,
        corretor_id: lead.corretor_id,
        indicado_por: lead.indicado_por,
        origem_recurso: lead.origem_recurso,
        etapa: "projeto",
        progresso: 0,
      } as never);

      // Registra log inicial da etapa "projeto" (trigger só dispara em UPDATE)
      await registrarLogObra(novaObra.id, "projeto").catch(() => {});

      // 2. Marca o lead como enviado
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

      toast.success("Obra criada! O cliente aparece agora na etapa Projetos.");
      return true;
    } catch (err) {
      console.error("Erro ao enviar para obras:", err);
      toast.error("Erro ao enviar para Obras");
      return false;
    }
  }, [leads]);

  const enviarParaObrasReload = useCallback(async (leadId: string, reloadObras?: () => void): Promise<boolean> => {
    const ok = await enviarParaObras(leadId);
    if (ok && reloadObras) reloadObras();
    return ok;
  }, [enviarParaObras]);

  return { leads, loading, salvar, avancarEtapa, enviarParaObras, enviarParaObrasReload, reload: load };
}
