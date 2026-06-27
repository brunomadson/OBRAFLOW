"use client";
import { useState, useCallback, useEffect } from "react";
import { getLancamentos, createLancamento, deleteLancamento } from "@/services/financeiro.service";
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

  const criar = useCallback(async (data: Omit<Lancamento, "id" | "created_at">) => {
    const novo = await createLancamento(data as Parameters<typeof createLancamento>[0]);
    if (novo) setLancamentos((p) => [novo as unknown as Lancamento, ...p]);
  }, []);

  const remover = useCallback(async (id: string) => {
    await deleteLancamento(id);
    setLancamentos((p) => p.filter((l) => l.id !== id));
  }, []);

  return { lancamentos, loading, criar, remover, reload: load };
}
