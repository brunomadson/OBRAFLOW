"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AcaoPermissao, PermissaoCargo, SetorPermissao } from "@/types/app.types";

const supabase = createClient();

// A garantia de verdade é a RLS (has_permission() no banco) — este hook só
// controla o que aparece na tela (esconder/desabilitar botão). Ver
// migrations 027/030.
export function usePermissoes() {
  const { profile } = useAuth();
  const [permissoes, setPermissoes] = useState<PermissaoCargo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function load() {
      if (!profile?.cargo_id) { setPermissoes([]); setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from("permissoes_cargo")
        .select("*")
        .eq("cargo_id", profile.cargo_id);
      if (ativo) {
        setPermissoes(error ? [] : ((data ?? []) as PermissaoCargo[]));
        setLoading(false);
      }
    }
    load();
    return () => { ativo = false; };
  }, [profile?.cargo_id]);

  const pode = useCallback(
    (setor: SetorPermissao, acao: AcaoPermissao): boolean => {
      const p = permissoes.find((x) => x.setor === setor);
      if (!p) return false;
      if (acao === "visualizar") return p.pode_visualizar;
      if (acao === "criar") return p.pode_criar;
      if (acao === "editar") return p.pode_editar;
      return p.pode_excluir;
    },
    [permissoes]
  );

  return { pode, loading };
}
