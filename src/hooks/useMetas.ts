"use client";
import { useState, useEffect, useCallback } from "react";
import { getMetas, periodoAtual } from "@/services/metas.service";
import type { IndicadorMeta } from "@/types/app.types";

// Metas do mês atual, prontas pro uso direto nas dashboards. Indicador sem
// meta cadastrada fica undefined — cada dashboard decide como reagir (em
// geral, só não mostra o comparativo em vez de inventar um valor fixo).
export function useMetas(): Partial<Record<IndicadorMeta, number>> {
  const [metas, setMetas] = useState<Partial<Record<IndicadorMeta, number>>>({});

  const load = useCallback(() => {
    getMetas(periodoAtual())
      .then((rows) => {
        const map: Partial<Record<IndicadorMeta, number>> = {};
        rows.forEach((r) => { map[r.indicador] = Number(r.valor_meta); });
        setMetas(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  return metas;
}
