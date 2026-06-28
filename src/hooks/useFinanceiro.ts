"use client";
import { useState, useCallback, useEffect } from "react";
import {
  getLancamentos, createLancamento, updateLancamento,
  pagarLancamento, deleteLancamento,
} from "@/services/financeiro.service";
import type { Lancamento } from "@/types/app.types";
import toast from "react-hot-toast";

export function useFinanceiro() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLancamentos();
      setLancamentos(data as unknown as Lancamento[]);
    } catch {
      toast.error("Erro ao carregar lançamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criar = useCallback(async (data: Omit<Lancamento, "id" | "created_at">): Promise<Lancamento | null> => {
    try {
      const novo = await createLancamento(data);
      setLancamentos((p) => [novo as unknown as Lancamento, ...p]);
      return novo as unknown as Lancamento;
    } catch {
      toast.error("Erro ao criar lançamento");
      return null;
    }
  }, []);

  const criarVarios = useCallback(async (lista: Omit<Lancamento, "id" | "created_at">[]): Promise<void> => {
    try {
      const criados = await Promise.all(lista.map((d) => createLancamento(d)));
      setLancamentos((p) => [...(criados as unknown as Lancamento[]).reverse(), ...p]);
      toast.success(`${criados.length} parcelas criadas!`);
    } catch {
      toast.error("Erro ao criar parcelas");
    }
  }, []);

  const editar = useCallback(async (id: string, data: Partial<Lancamento>): Promise<void> => {
    try {
      const atualizado = await updateLancamento(id, data);
      setLancamentos((p) => p.map((l) => l.id === id ? atualizado as unknown as Lancamento : l));
      toast.success("Lançamento atualizado!");
    } catch {
      toast.error("Erro ao atualizar lançamento");
    }
  }, []);

  const pagar = useCallback(async (id: string): Promise<void> => {
    try {
      const atualizado = await pagarLancamento(id);
      setLancamentos((p) => p.map((l) => l.id === id ? atualizado as unknown as Lancamento : l));
      toast.success("Marcado como pago!");
    } catch {
      toast.error("Erro ao marcar como pago");
    }
  }, []);

  const remover = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteLancamento(id);
      setLancamentos((p) => p.filter((l) => l.id !== id));
      toast.success("Lançamento removido.");
    } catch {
      toast.error("Erro ao remover lançamento");
    }
  }, []);

  return { lancamentos, loading, criar, criarVarios, editar, pagar, remover, reload: load };
}
