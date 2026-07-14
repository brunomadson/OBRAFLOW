"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Só pra decidir se mostra o alerta de "pagamento atrasado" (Etapa 9). O
// bloqueio de verdade (canceled/expired) já acontece no middleware, antes
// da página carregar — este hook nunca precisa reagir a isso.
export function useAssinaturaStatus() {
  const [pastDue, setPastDue] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("get_workspace_access_status").then(({ data }) => {
      setPastDue(data === "past_due");
    });
  }, []);

  return { pastDue };
}
