"use client";
import { useState, useEffect } from "react";
import { getConfig } from "@/services/config.service";
import { CONFIG_PADRAO } from "@/constants/config";
import type { ConfigPrazos } from "@/types/app.types";

// Carrega os prazos configurados pro workspace atual. Enquanto carrega
// (ou se ainda não existe linha salva), usa os padrões do código — os
// mesmos já usados como fallback em toda a base.
export function useConfig(): ConfigPrazos {
  const [config, setConfig] = useState<ConfigPrazos>(CONFIG_PADRAO);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

  return config;
}
