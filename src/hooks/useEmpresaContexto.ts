"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceNome } from "@/services/workspace.service";

// Dados institucionais usados no cabeçalho dos relatórios em PDF.
export function useEmpresaContexto() {
  const { profile } = useAuth();
  const [empresaNome, setEmpresaNome] = useState("ObraFlow");

  useEffect(() => {
    if (profile?.workspace_id) {
      getWorkspaceNome(profile.workspace_id).then(setEmpresaNome).catch(() => {});
    }
  }, [profile?.workspace_id]);

  return { empresaNome, usuarioNome: profile?.nome ?? "—" };
}
