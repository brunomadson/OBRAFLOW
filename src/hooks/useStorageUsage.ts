"use client";
import { useEffect, useState } from "react";

// Só mostra alerta quando o plano tem storage_limit_mb definido (Sprint
// 11.2 deixou o dado preparado, mas nenhum plano tem valor ainda — até
// alguém definir um limite pra um plano, esse hook nunca aciona nada).
export function useStorageUsage() {
  const [percentUsed, setPercentUsed] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/storage/usage")
      .then((r) => r.json())
      .then((d) => setPercentUsed(d.percentUsed ?? null))
      .catch(() => {});
  }, []);

  return { percentUsed, proximoDoLimite: percentUsed !== null && percentUsed >= 80 };
}
