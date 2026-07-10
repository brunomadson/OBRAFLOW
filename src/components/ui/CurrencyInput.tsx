"use client";
import { useState } from "react";
import { formatCurrency, parseCurrency } from "@/utils/currency";
import { cn } from "@/lib/utils";

interface Props {
  value: number | null | undefined;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

// Exibe formatado ("R$ 43.240,00") quando não está em edição; enquanto o
// usuário digita, mostra o texto bruto para não brigar com o cursor. O valor
// entregue ao onChange é sempre um number puro — nada muda no schema/DB.
export default function CurrencyInput({ value, onChange, className, placeholder }: Props) {
  const [editando, setEditando] = useState<string | null>(null);

  const exibido = editando ?? (value ? formatCurrency(value) : "");

  return (
    <input
      type="text"
      inputMode="decimal"
      value={exibido}
      placeholder={placeholder}
      className={cn("input-base", className)}
      onFocus={() => setEditando(value ? String(value).replace(".", ",") : "")}
      onChange={(e) => setEditando(e.target.value)}
      onBlur={() => {
        const num = parseCurrency(editando ?? "");
        onChange(num);
        setEditando(null);
      }}
    />
  );
}
